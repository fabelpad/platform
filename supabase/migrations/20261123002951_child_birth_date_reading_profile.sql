-- Add calendar birth dates and an explicit parent reading-level override.
-- Existing snapshots are not rewritten and legacy profiles need no invented date.
-- A profile first introduced by a write must have a valid birth date. Existing
-- consent, lifecycle, CAS and own-family access remain the only write route.
alter function private.valid_family_snapshot_with_profiles(jsonb)
  rename to valid_family_snapshot_before_birth_dates;
revoke all on function private.valid_family_snapshot_before_birth_dates(jsonb) from public, anon, authenticated, service_role;

create function private.valid_child_birth_date(p jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare value text; parsed date;
begin
  if jsonb_typeof(p) is distinct from 'string' then return false; end if;
  value := p #>> '{}';
  if value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  -- PostgreSQL rejects impossible dates; the roundtrip rejects alternate input
  -- syntax and year zero. No timezone is ever attached to the birth date.
  parsed := value::date;
  return to_char(parsed, 'YYYY-MM-DD') = value
    and parsed <= (current_timestamp at time zone 'Europe/Amsterdam')::date;
exception when others then return false;
end;
$$;
revoke all on function private.valid_child_birth_date(jsonb) from public, anon, authenticated, service_role;

create function private.valid_family_snapshot_with_profiles(p jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare child jsonb; stripped jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p #> '{family,children}') is distinct from 'array' then return false; end if;
  for child in select * from jsonb_array_elements(p #> '{family,children}') loop
    if jsonb_typeof(child) is distinct from 'object' then return false; end if;
    if child ? 'birthDate' and not private.valid_child_birth_date(child->'birthDate') then return false; end if;
    if child ? 'readingLevelOverride' and (jsonb_typeof(child->'readingLevelOverride') is distinct from 'string'
      or child->>'readingLevelOverride' not in ('under6','6to8','9plus')) then return false; end if;
    stripped := stripped || jsonb_build_array(child - 'birthDate' - 'readingLevelOverride');
  end loop;
  -- The previous strict validator still checks every other key and route field.
  return private.valid_family_snapshot_before_birth_dates(jsonb_set(p, '{family,children}', stripped));
exception when others then return false;
end;
$$;
revoke all on function private.valid_family_snapshot_with_profiles(jsonb) from public, anon, authenticated, service_role;

-- Rebind the wrapper to the new validator, and correctly describe the
-- current Dutch calendar-day check as STABLE rather than IMMUTABLE.
create or replace function private.valid_family_snapshot(p jsonb) returns boolean
language sql stable set search_path = '' as $$
  select p = '{"schemaVersion":1,"family":{"version":1,"children":[],"activeId":""},"data":{}}'::jsonb
    or private.valid_family_snapshot_with_profiles(p)
$$;
revoke all on function private.valid_family_snapshot(jsonb) from public, anon, authenticated, service_role;

create or replace function private.save_family_snapshot(p_base_revision bigint,p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare actor uuid := private.lifecycle_identity(); changed bigint; row public.family_documents; child jsonb; previous_child jsonb;
begin
  -- Lock in the same order as consent withdrawal and account deletion.
  perform 1 from private.account_lifecycle where parent_id = actor and state = 'active' and terms_version = '2026-11-22'
    and (not (select inactivity_enabled from private.lifecycle_controls)
      or private.lifecycle_now() < greatest(last_activity_at + interval '90 days', transition_deadline)) for update;
  if not found or not private.family_access_allowed(actor) then raise exception 'account_blocked' using errcode = '42501'; end if;
  if p_base_revision is null or p_base_revision < 0 or p_base_revision >= 9007199254740991
    or p_snapshot is null or octet_length(p_snapshot::text) > 262144 or not private.valid_family_snapshot(p_snapshot)
    then raise exception 'Invalid family snapshot' using errcode = '22023'; end if;
  if not private.snapshot_consented(actor,p_snapshot) then raise exception 'profile_consent_required' using errcode = '42501'; end if;

  select * into row from public.family_documents where parent_id = actor;
  for child in select * from jsonb_array_elements(p_snapshot #> '{family,children}') loop
    previous_child := null;
    select value into previous_child from jsonb_array_elements(coalesce(row.snapshot #> '{family,children}', '[]'::jsonb))
      where value->>'id' = child->>'id';
    if not (child ? 'birthDate') and (previous_child is null or previous_child ? 'birthDate')
      then raise exception 'child_birth_date_required' using errcode = '22023'; end if;
  end loop;

  if p_base_revision = 0 then
    insert into public.family_documents(parent_id,snapshot,revision) values(actor,p_snapshot,1) on conflict(parent_id) do nothing;
  else
    update public.family_documents set snapshot = p_snapshot, revision = revision + 1, updated_at = private.lifecycle_now()
      where parent_id = actor and revision = p_base_revision;
  end if;
  get diagnostics changed = row_count;
  select * into row from public.family_documents where parent_id = actor;
  -- Synchronisation remains distinct from conscious family activity.
  return jsonb_build_object('saved',changed = 1,'revision',coalesce(row.revision,0),'snapshot',row.snapshot);
end;
$$;
