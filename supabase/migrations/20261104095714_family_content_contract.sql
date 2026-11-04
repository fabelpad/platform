-- Additive Supabase contract. No D1 data is deleted or imported implicitly.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.family_documents (
  parent_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null check (octet_length(snapshot::text) <= 262144),
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default now()
);
alter table public.family_documents enable row level security;
revoke all on public.family_documents from public, anon, authenticated;
grant select on public.family_documents to authenticated;
create policy family_read_own on public.family_documents for select to authenticated
  using ((select auth.uid()) = parent_id);

create table public.content_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.content_admins enable row level security;
revoke all on public.content_admins from public, anon, authenticated;
grant select on public.content_admins to authenticated;
create policy admins_read_own on public.content_admins for select to authenticated
  using ((select auth.uid()) = user_id);
-- Administrators are provisioned by trusted SQL only; never by signup or metadata.

create table public.content_drafts (
  story_id text primary key check (story_id in ('station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars')),
  draft jsonb not null check (octet_length(draft::text) <= 131072),
  revision bigint not null check (revision between 1 and 9007199254740991),
  editor_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.content_drafts enable row level security;
revoke all on public.content_drafts from public, anon, authenticated;
grant select on public.content_drafts to authenticated;
create policy drafts_admin_read on public.content_drafts for select to authenticated
  using (exists (select 1 from public.content_admins a where a.user_id = (select auth.uid())));
create index content_drafts_editor_idx on public.content_drafts(editor_id);

create table public.content_releases (
  story_id text not null check (story_id in ('station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars')),
  content_version text not null check (content_version ~ '^[a-f0-9]{16,64}$'),
  payload jsonb not null check (octet_length(payload::text) <= 2097152),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  primary key (story_id, content_version)
);
alter table public.content_releases enable row level security;
revoke all on public.content_releases from public, anon, authenticated;
grant select on public.content_releases to anon, authenticated;
create policy releases_public_read on public.content_releases for select to anon, authenticated using (true);
create index content_releases_latest_idx on public.content_releases(story_id, published_at desc);
create index content_releases_publisher_idx on public.content_releases(published_by);

-- Retention must not push a story's latest release past PostgREST's row limit.
-- Invoker privileges and the table's read policy also apply to this public RPC.
create function public.get_content_catalog() returns table(story_id text,content_version text,published_at timestamptz,metadata jsonb) language sql stable security invoker set search_path = '' as $$
  select distinct on (r.story_id) r.story_id,r.content_version,r.published_at,r.payload->'metadata'
  from public.content_releases r order by r.story_id,r.published_at desc,r.content_version desc;
$$;
revoke all on function public.get_content_catalog() from public;
grant execute on function public.get_content_catalog() to anon,authenticated;

create function private.prevent_release_change() returns trigger language plpgsql set search_path = '' as $$
begin
  -- Even privileged maintenance must explicitly plan retention; existing adventures keep their bytes.
  if tg_op = 'DELETE' or new.story_id is distinct from old.story_id or new.content_version is distinct from old.content_version or new.payload is distinct from old.payload or new.published_at is distinct from old.published_at then
    raise exception 'Published content releases are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_release_change() from public, anon, authenticated;
create trigger releases_immutable before update or delete on public.content_releases for each row execute function private.prevent_release_change();

-- Count UTF-16 units, matching the existing browser/server string limits.
create function private.valid_snapshot_text(p jsonb,p_max integer,p_empty boolean default false) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(p) = 'string' and (p_empty or length(btrim(p#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0)
    and (select coalesce(sum(case when ascii(c) > 65535 then 2 else 1 end),0) from regexp_split_to_table(p#>>'{}','') c) <= p_max,false);
$$;
revoke all on function private.valid_snapshot_text(jsonb,integer,boolean) from public,anon,authenticated;

create function private.valid_snapshot_date(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p) is distinct from 'string' or length(p#>>'{}') > 30 or p#>>'{}' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' then return false; end if;
  return isfinite((p#>>'{}')::timestamptz);
exception when others then return false;
end;
$$;
revoke all on function private.valid_snapshot_date(jsonb) from public,anon,authenticated;

create function private.valid_family_memory(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare category text; item jsonb; ids text[]; required text[]; date_key text; date_keys text[];
  worlds constant text[] := array['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars'];
begin
  if jsonb_typeof(p) is distinct from 'object' or p->'version' is distinct from '1'::jsonb or not (p ?& array['version','encounters','items','openThreads','events']) or (select count(*) from jsonb_object_keys(p)) <> 5 then return false; end if;
  foreach category in array array['encounters','items','openThreads','events'] loop
    if jsonb_typeof(p->category) is distinct from 'array' or jsonb_array_length(p->category) > (case category when 'encounters' then 48 when 'items' then 40 when 'openThreads' then 13 else 100 end) then return false; end if;
    ids := '{}';
    required := case category
      when 'encounters' then array['id','worldId','name','facts','firstMetAt','lastSeenAt','source']
      when 'items' then array['id','worldId','name','endingTitle','acquiredAt','source']
      when 'openThreads' then array['id','worldId','label','nextChapter','createdAt','updatedAt']
      else array['id','worldId','kind','label','detail','recordedAt','source'] end;
    date_keys := case category when 'encounters' then array['firstMetAt','lastSeenAt'] when 'items' then array['acquiredAt'] when 'openThreads' then array['createdAt','updatedAt'] else array['recordedAt'] end;
    for item in select * from jsonb_array_elements(p->category) loop
      if jsonb_typeof(item) is distinct from 'object' or not (item ?& required) or (select count(*) from jsonb_object_keys(item)) <> array_length(required,1)
        or not private.valid_snapshot_text(item->'id',160) or item->>'id' = any(ids) or not coalesce(item->>'worldId' = any(worlds),false) then return false; end if;
      ids := array_append(ids,item->>'id');
      if category <> 'openThreads' and not coalesce(item->>'source' in ('played','reconstructed'),false) then return false; end if;
      foreach date_key in array date_keys loop
        if not private.valid_snapshot_date(item->date_key) then return false; end if;
      end loop;
      if category = 'encounters' then
        if not private.valid_snapshot_text(item->'name',100) or jsonb_typeof(item->'facts') is distinct from 'array' or jsonb_array_length(item->'facts') > 8 then return false; end if;
        if exists(select 1 from jsonb_array_elements(item->'facts') fact where not private.valid_snapshot_text(fact,220)) then return false; end if;
      elsif category = 'items' then
        if not private.valid_snapshot_text(item->'name',160) or not private.valid_snapshot_text(item->'endingTitle',160) then return false; end if;
      elsif category = 'openThreads' then
        if not private.valid_snapshot_text(item->'label',220) or jsonb_typeof(item->'nextChapter') is distinct from 'number' or item->>'nextChapter' !~ '^[1-5]$' then return false; end if;
      elsif not coalesce(item->>'kind' in ('choice','ending'),false) or not private.valid_snapshot_text(item->'label',220) or not private.valid_snapshot_text(item->'detail',600,true) then return false;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_family_memory(jsonb) from public,anon,authenticated;

create function private.valid_family_snapshot(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare child jsonb; ids text[] := '{}'; entry record; field record; item jsonb; k text;
  worlds constant text[] := array['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars'];
begin
  if jsonb_typeof(p) <> 'object' or p->'schemaVersion' <> '1'::jsonb or not (p ?& array['schemaVersion','family','data']) or (select count(*) from jsonb_object_keys(p)) <> 3 then return false; end if;
  if jsonb_typeof(p->'family') <> 'object' or p#>'{family,version}' <> '1'::jsonb or not ((p->'family') ?& array['version','children','activeId']) or (select count(*) from jsonb_object_keys(p->'family')) <> 3 then return false; end if;
  if jsonb_typeof(p#>'{family,children}') <> 'array' or jsonb_array_length(p#>'{family,children}') not between 1 and 5 or jsonb_typeof(p->'data') <> 'object' then return false; end if;
  for child in select * from jsonb_array_elements(p#>'{family,children}') loop
    if jsonb_typeof(child) <> 'object' or not (child ?& array['id','name','avatar']) or (select count(*) from jsonb_object_keys(child)) <> 3 then return false; end if;
    k := child->>'id';
    if jsonb_typeof(child->'id') <> 'string' or k !~ '^[a-zA-Z0-9_-]{1,80}$' or k = any(ids) or k in ('__proto__','prototype','constructor') then return false; end if;
    if not private.valid_snapshot_text(child->'name',20) or (jsonb_typeof(child->'avatar') is distinct from 'number' or child->>'avatar' !~ '^[0-3]$') then return false; end if;
    ids := array_append(ids, k);
  end loop;
  if jsonb_typeof(p#>'{family,activeId}') is distinct from 'string' or not (p#>>'{family,activeId}' = any(ids)) then return false; end if;
  for entry in select * from jsonb_each(p->'data') loop
    if not (entry.key = any(ids)) or jsonb_typeof(entry.value) <> 'object' then return false; end if;
    for field in select * from jsonb_each(entry.value) loop
      if field.key in ('favorites','started') then
        if jsonb_typeof(field.value) <> 'array' or jsonb_array_length(field.value) > 13 then return false; end if;
        if exists (select 1 from jsonb_array_elements(field.value) v where jsonb_typeof(v) <> 'string' or not (v#>>'{}' = any(worlds))) then return false; end if;
        if (select count(distinct v) from jsonb_array_elements(field.value) v) <> jsonb_array_length(field.value) then return false; end if;
      elsif left(field.key,6) = 'story-' and substring(field.key from 7) = any(worlds) then
        if jsonb_typeof(field.value) <> 'object' or not (field.value ?& array['picks','updatedAt']) then return false; end if;
        if exists (select 1 from jsonb_object_keys(field.value) key where key not in ('picks','updatedAt','storyId','contentVersion','revision')) then return false; end if;
        if jsonb_typeof(field.value->'picks') <> 'array' or jsonb_array_length(field.value->'picks') > 5 then return false; end if;
        if exists (select 1 from jsonb_array_elements(field.value->'picks') v where v not in ('0'::jsonb,'1'::jsonb)) then return false; end if;
        if jsonb_typeof(field.value->'updatedAt') is distinct from 'number' or field.value->>'updatedAt' !~ '^[0-9]+$' or (field.value->>'updatedAt')::numeric > 9007199254740991 then return false; end if;
        if field.value ? 'storyId' and (jsonb_typeof(field.value->'storyId') is distinct from 'string' or field.value->>'storyId' is distinct from substring(field.key from 7)) then return false; end if;
        if field.value ? 'contentVersion' and (jsonb_typeof(field.value->'contentVersion') is distinct from 'string' or field.value->>'contentVersion' !~ '^[a-f0-9]{16,64}$') then return false; end if;
        if field.value ? 'revision' and (jsonb_typeof(field.value->'revision') is distinct from 'number' or field.value->>'revision' !~ '^[0-9]+$' or (field.value->>'revision')::numeric > 9007199254740991) then return false; end if;
      elsif field.key = 'prefs' then
        if jsonb_typeof(field.value) <> 'object' or jsonb_typeof(field.value->'muted') is distinct from 'boolean' or jsonb_typeof(field.value->'calm') is distinct from 'boolean' then return false; end if;
        if exists (select 1 from jsonb_object_keys(field.value) key where key not in ('muted','calm','textSize')) then return false; end if;
        if field.value ? 'textSize' and (jsonb_typeof(field.value->'textSize') is distinct from 'string' or field.value->>'textSize' not in ('normal','large')) then return false; end if;
      elsif field.key = 'completed' then
        if jsonb_typeof(field.value) <> 'object' then return false; end if;
        if exists (select 1 from jsonb_each(field.value) e where not (e.key = any(worlds)) or jsonb_typeof(e.value) is distinct from 'object' or not (e.value ?& array['ending','date']) or (select count(*) from jsonb_object_keys(e.value)) <> 2 or not private.valid_snapshot_text(e.value->'ending',160) or not private.valid_snapshot_date(e.value->'date')) then return false; end if;
      elsif field.key = 'memory' then
        if not private.valid_family_memory(field.value) then return false; end if;
      else return false;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_family_snapshot(jsonb) from public, anon, authenticated;

-- The private definer owns only this narrow operation. It never accepts a parent ID.
-- Direct writes are revoked, keeping every write behind CAS and an auth.uid check.
create function private.save_family_snapshot(p_base_revision bigint, p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); changed bigint; current_row public.family_documents;
begin
  if owner_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_base_revision is null or p_base_revision < 0 or p_base_revision >= 9007199254740991 or p_snapshot is null or octet_length(p_snapshot::text) > 262144 or not private.valid_family_snapshot(p_snapshot) then raise exception 'Invalid family snapshot' using errcode = '22023'; end if;
  if p_base_revision = 0 then
    insert into public.family_documents(parent_id,snapshot,revision) values(owner_id,p_snapshot,1) on conflict(parent_id) do nothing;
  else
    update public.family_documents set snapshot = p_snapshot, revision = revision + 1, updated_at = now() where parent_id = owner_id and revision = p_base_revision;
  end if;
  get diagnostics changed = row_count;
  select * into current_row from public.family_documents where parent_id = owner_id;
  return jsonb_build_object('saved',changed = 1,'revision',coalesce(current_row.revision,0),'snapshot',current_row.snapshot);
end;
$$;
revoke all on function private.save_family_snapshot(bigint,jsonb) from public, anon;
grant execute on function private.save_family_snapshot(bigint,jsonb) to authenticated;
create function public.save_family_snapshot(p_base_revision bigint, p_snapshot jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select private.save_family_snapshot(p_base_revision,p_snapshot); $$;
revoke all on function public.save_family_snapshot(bigint,jsonb) from public, anon;
grant execute on function public.save_family_snapshot(bigint,jsonb) to authenticated;

create function private.save_content_draft(p_story_id text, p_base_revision bigint, p_draft jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); changed bigint; current_row public.content_drafts;
begin
  if owner_id is null or not exists(select 1 from public.content_admins where user_id = owner_id) then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_base_revision is null or p_base_revision < 0 or p_base_revision >= 9007199254740991 or p_draft is null or jsonb_typeof(p_draft) <> 'object' or jsonb_typeof(p_draft->'metadata') <> 'object' or jsonb_typeof(p_draft->'chapters') is distinct from 'object' or octet_length(p_draft::text) > 131072 then raise exception 'Invalid content draft' using errcode = '22023'; end if;
  if p_base_revision = 0 then
    insert into public.content_drafts(story_id,draft,revision,editor_id) values(p_story_id,p_draft,1,owner_id) on conflict(story_id) do nothing;
  else
    update public.content_drafts set draft=p_draft,revision=revision+1,editor_id=owner_id,updated_at=now() where story_id=p_story_id and revision=p_base_revision;
  end if;
  get diagnostics changed = row_count;
  select * into current_row from public.content_drafts where story_id=p_story_id;
  return jsonb_build_object('saved',changed=1,'revision',coalesce(current_row.revision,0),'draft',current_row.draft);
end;
$$;
revoke all on function private.save_content_draft(text,bigint,jsonb) from public, anon;
grant execute on function private.save_content_draft(text,bigint,jsonb) to authenticated;
create function public.save_content_draft(p_story_id text,p_base_revision bigint,p_draft jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select private.save_content_draft(p_story_id,p_base_revision,p_draft); $$;
revoke all on function public.save_content_draft(text,bigint,jsonb) from public, anon;
grant execute on function public.save_content_draft(text,bigint,jsonb) to authenticated;

-- Canonical JSON matches the web/native SHA contract (sorted object keys, no whitespace).
create function private.canonical_content_json(p jsonb) returns text language sql immutable strict set search_path = '' as $$
  select case jsonb_typeof(p)
    when 'object' then '{' || coalesce((select string_agg(to_jsonb(e.key)::text || ':' || private.canonical_content_json(e.value), ',' order by e.key collate "C") from jsonb_each(p) e), '') || '}'
    when 'array' then '[' || coalesce((select string_agg(private.canonical_content_json(e.value), ',' order by e.position) from jsonb_array_elements(p) with ordinality e(value,position)), '') || ']'
    else p::text end;
$$;
revoke all on function private.canonical_content_json(jsonb) from public, anon, authenticated;

create function private.publish_content_release(p_story_id text,p_base_revision bigint,p_payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); current_row public.content_drafts; release_row public.content_releases; version text; scene record; ending record;
begin
  if owner_id is null or not exists(select 1 from public.content_admins where user_id=owner_id) then raise exception 'Administrator required' using errcode = '42501'; end if;
  select * into current_row from public.content_drafts where story_id=p_story_id for update;
  if not found or p_base_revision is null or current_row.revision <> p_base_revision then return jsonb_build_object('saved',false,'revision',coalesce(current_row.revision,0)); end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_payload->'parts' is distinct from '5'::jsonb or p_payload->>'nameToken' is distinct from '__FABELPAD_CHILD__' or jsonb_typeof(p_payload->'scenes') <> 'object' or jsonb_typeof(p_payload->'endings') <> 'object' or p_payload->'metadata' is distinct from current_row.draft->'metadata' or (select count(*) from jsonb_object_keys(p_payload->'scenes')) <> 31 or (select count(*) from jsonb_object_keys(p_payload->'endings')) <> 32 or octet_length(p_payload::text) > 2097152 then raise exception 'Invalid release' using errcode = '22023'; end if;
  for scene in select * from jsonb_each(p_payload->'scenes') loop
    if scene.key !~ '^[01]{0,4}$' or jsonb_typeof(scene.value) <> 'object' or coalesce(length(btrim(scene.value->>'title')),0) = 0 or coalesce(length(btrim(scene.value->>'text')),0) = 0 or jsonb_typeof(scene.value->'choices') <> 'array' or jsonb_array_length(scene.value->'choices') <> 2 then raise exception 'Invalid scene' using errcode = '22023'; end if;
  end loop;
  for ending in select * from jsonb_each(p_payload->'endings') loop
    if ending.key !~ '^[01]{5}$' or jsonb_typeof(ending.value) <> 'object' or coalesce(length(btrim(ending.value->>'title')),0) = 0 or coalesce(length(btrim(ending.value->>'text')),0) = 0 or coalesce(length(btrim(ending.value->>'keepsake')),0) = 0 then raise exception 'Invalid ending' using errcode = '22023'; end if;
  end loop;
  version := substring(encode(sha256(convert_to(private.canonical_content_json(p_payload),'UTF8')),'hex') from 1 for 16);
  insert into public.content_releases(story_id,content_version,payload,published_by) values(p_story_id,version,p_payload,owner_id) on conflict(story_id,content_version) do nothing;
  select * into release_row from public.content_releases where story_id=p_story_id and content_version=version;
  return jsonb_build_object('saved',true,'release',to_jsonb(release_row));
end;
$$;
revoke all on function private.publish_content_release(text,bigint,jsonb) from public, anon;
grant execute on function private.publish_content_release(text,bigint,jsonb) to authenticated;
create function public.publish_content_release(p_story_id text,p_base_revision bigint,p_payload jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select private.publish_content_release(p_story_id,p_base_revision,p_payload); $$;
revoke all on function public.publish_content_release(text,bigint,jsonb) from public, anon;
grant execute on function public.publish_content_release(text,bigint,jsonb) to authenticated;
