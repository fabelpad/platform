-- Resend administration is project-local. No credential is returned by an
-- authenticated RPC, stored in public tables, or accepted without a real send
-- receipt from the service-only Edge manager. Vault owns encryption at rest.
do $$ begin
  if to_regclass('vault.decrypted_secrets') is null
    or to_regprocedure('vault.create_secret(text,text,text,uuid)') is null
    or to_regprocedure('vault.update_secret(uuid,text,text,text,uuid)') is null then
    raise exception 'Supabase Vault must be enabled before email configuration';
  end if;
end $$;

create table private.email_delivery_settings (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision between 1 and 9007199254740991),
  settings jsonb not null check (octet_length(settings::text) <= 131072),
  secret_id uuid not null unique,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  last_test_at timestamptz not null,
  last_test_provider_id text not null
);
alter table private.email_delivery_settings enable row level security;
revoke all on private.email_delivery_settings from public, anon, authenticated, service_role;

create table private.email_delivery_tests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  reserved_at timestamptz not null default clock_timestamp(),
  consumed boolean not null default false
);
create index email_delivery_tests_actor_time_idx on private.email_delivery_tests(actor_id, reserved_at desc);
alter table private.email_delivery_tests enable row level security;
revoke all on private.email_delivery_tests from public, anon, authenticated, service_role;

create function private.email_settings_defaults() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"fromName":"Fabelpad","fromEmail":"noreply@fabelpad.nl","replyTo":"support@fabelpad.nl","supportEmail":"support@fabelpad.nl","footerText":"Dit is een servicebericht van Fabelpad over je ouderaccount.","templates":{}}'::jsonb
$$;
revoke all on function private.email_settings_defaults() from public, anon, authenticated, service_role;

create function private.is_confirmed_email_admin(p_actor_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select p_actor_id is not null and exists (
    select 1 from auth.users u join public.content_admins a on a.user_id=u.id
    where u.id=p_actor_id and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false)
  )
$$;
revoke all on function private.is_confirmed_email_admin(uuid) from public, anon, authenticated, service_role;

create function private.valid_email_copy(p_value jsonb,p_maximum integer,p_multiline boolean default false) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value)='string' and char_length(p_value#>>'{}') between 1 and p_maximum
    and (p_value#>>'{}')=btrim(p_value#>>'{}')
    and (case when p_multiline then replace(p_value#>>'{}',chr(10),'') else p_value#>>'{}' end) !~ '[[:cntrl:]<>]'
$$;
revoke all on function private.valid_email_copy(jsonb,integer,boolean) from public, anon, authenticated, service_role;

create function private.valid_email_settings(p_value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item record;
begin
  if jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>131072
    or not (p_value ?& array['fromName','fromEmail','replyTo','supportEmail','footerText','templates'])
    or (select count(*) from jsonb_object_keys(p_value))<>6
    or private.valid_email_copy(p_value->'fromName',80) is distinct from true
    or private.valid_email_copy(p_value->'footerText',500,true) is distinct from true
    or jsonb_typeof(p_value->'templates') is distinct from 'object' then return false; end if;
  for item in select value from jsonb_each(p_value) where key in ('fromEmail','replyTo','supportEmail') loop
    if private.valid_email_copy(item.value,254) is distinct from true
      or (item.value#>>'{}') !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$' then return false; end if;
  end loop;
  for item in select key,value from jsonb_each(p_value->'templates') loop
    if not (item.key=any(array['signup','invite','magiclink','recovery','email_change','reauthentication',
      'password_changed_notification','email_changed_notification','phone_changed_notification',
      'identity_linked_notification','identity_unlinked_notification',
      'mfa_factor_enrolled_notification','mfa_factor_unenrolled_notification',
      'welcome','account-deletion-requested','account-deleted','service-notice']))
      or jsonb_typeof(item.value) is distinct from 'object'
      or not (item.value ?& array['subject','title','intro'])
      or (select count(*) from jsonb_object_keys(item.value))<>3
      or private.valid_email_copy(item.value->'subject',160) is distinct from true
      or private.valid_email_copy(item.value->'title',200) is distinct from true
      or private.valid_email_copy(item.value->'intro',1000,true) is distinct from true then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.valid_email_settings(jsonb) from public, anon, authenticated, service_role;

create function private.email_settings_snapshot() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce((select jsonb_build_object('revision',s.revision,'settings',s.settings,
    'keyConfigured',exists(select 1 from vault.secrets v where v.id=s.secret_id),
    'lastTestAt',s.last_test_at,'lastTestProviderId',s.last_test_provider_id)
    from private.email_delivery_settings s where s.singleton),
    jsonb_build_object('revision',0,'settings',private.email_settings_defaults(),
      'keyConfigured',false,'lastTestAt',null,'lastTestProviderId',null))
$$;
revoke all on function private.email_settings_snapshot() from public, anon, authenticated, service_role;

create function private.get_email_settings() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_confirmed_email_admin(auth.uid()) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  return private.email_settings_snapshot();
end;
$$;
revoke all on function private.get_email_settings() from public, anon, authenticated, service_role;
grant execute on function private.get_email_settings() to authenticated;
create function public.get_email_settings() returns jsonb
language sql security invoker set search_path = '' as $$ select private.get_email_settings() $$;
revoke all on function public.get_email_settings() from public, anon, authenticated, service_role;
grant execute on function public.get_email_settings() to authenticated;

create function private.get_email_delivery_config() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  -- Read the revision, branded settings and decrypted credential together. A
  -- concurrent rotation must never pair an old key with a newer sender/config.
  select jsonb_build_object('revision',s.revision,'settings',s.settings,
    'keyConfigured',v.id is not null,'lastTestAt',s.last_test_at,
    'lastTestProviderId',s.last_test_provider_id,'apiKey',v.decrypted_secret)
    into result from private.email_delivery_settings s
    left join vault.decrypted_secrets v on v.id=s.secret_id where s.singleton;
  if not found then return null; end if;
  if result->>'apiKey' is null or result->>'apiKey'='' then
    raise exception 'Email delivery configuration unavailable' using errcode='55000';
  end if;
  return result;
end;
$$;
revoke all on function private.get_email_delivery_config() from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.get_email_delivery_config() to service_role;
create function public.get_email_delivery_config() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.get_email_delivery_config() $$;
revoke all on function public.get_email_delivery_config() from public, anon, authenticated, service_role;
grant execute on function public.get_email_delivery_config() to service_role;

create function private.reserve_email_test(p_actor_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare latest timestamptz; retry_after integer;
begin
  if not private.is_confirmed_email_admin(p_actor_id) then
    raise exception 'Administrator required' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'Invalid email test request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fabelpad.email-test.'||p_actor_id::text,0));
  delete from private.email_delivery_tests where reserved_at<clock_timestamp()-interval '24 hours';
  if exists(select 1 from private.email_delivery_tests where request_id=p_request_id) then
    return jsonb_build_object('allowed',false,'retryAfter',30);
  end if;
  select max(reserved_at) into latest from private.email_delivery_tests where actor_id=p_actor_id;
  retry_after:=greatest(0,ceil(extract(epoch from latest+interval '30 seconds'-clock_timestamp()))::integer);
  if retry_after>0 then return jsonb_build_object('allowed',false,'retryAfter',retry_after); end if;
  insert into private.email_delivery_tests(request_id,actor_id) values(p_request_id,p_actor_id);
  return jsonb_build_object('allowed',true,'retryAfter',0);
end;
$$;
revoke all on function private.reserve_email_test(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function private.reserve_email_test(uuid,uuid) to service_role;
create function public.reserve_email_test(p_actor_id uuid,p_request_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.reserve_email_test(p_actor_id,p_request_id) $$;
revoke all on function public.reserve_email_test(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.reserve_email_test(uuid,uuid) to service_role;

create function private.consume_email_test(p_actor_id uuid,p_request_id uuid,p_test_provider_id text) returns void
language plpgsql set search_path = '' as $$
begin
  if p_test_provider_id is null or p_test_provider_id !~ '^[A-Za-z0-9-]{8,100}$' then
    raise exception 'Invalid email test receipt' using errcode='22023'; end if;
  update private.email_delivery_tests set consumed=true where request_id=p_request_id and actor_id=p_actor_id
    and not consumed and reserved_at>clock_timestamp()-interval '5 minutes';
  if not found then raise exception 'Email test reservation unavailable' using errcode='22023'; end if;
end;
$$;
revoke all on function private.consume_email_test(uuid,uuid,text) from public, anon, authenticated, service_role;

create function private.save_email_settings(p_actor_id uuid,p_expected_revision bigint,p_settings jsonb,
  p_api_key text,p_test_provider_id text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; current_secret uuid; next_revision bigint;
begin
  if not private.is_confirmed_email_admin(p_actor_id) then
    raise exception 'Administrator required' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=9007199254740991
    or private.valid_email_settings(p_settings) is distinct from true
    or (p_api_key is not null and p_api_key !~ '^re_[A-Za-z0-9_-]{8,250}$') then
    raise exception 'Invalid email configuration' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fabelpad.email-settings',0));
  select revision,secret_id into current_revision,current_secret from private.email_delivery_settings where singleton for update;
  current_revision:=coalesce(current_revision,0);
  if current_revision<>p_expected_revision then
    return jsonb_build_object('saved',false)||private.email_settings_snapshot();
  end if;
  if current_secret is null and p_api_key is null then
    raise exception 'Resend API key required' using errcode='22023'; end if;
  perform private.consume_email_test(p_actor_id,p_request_id,p_test_provider_id);
  if current_secret is null then
    current_secret:=vault.create_secret(p_api_key,'fabelpad_resend_api_key','Fabelpad transactional email API key');
  elsif p_api_key is not null then
    perform vault.update_secret(current_secret,p_api_key,'fabelpad_resend_api_key','Fabelpad transactional email API key');
  end if;
  if not exists(select 1 from vault.decrypted_secrets where id=current_secret and decrypted_secret<>'') then
    raise exception 'Email delivery configuration unavailable' using errcode='55000'; end if;
  next_revision:=current_revision+1;
  insert into private.email_delivery_settings(singleton,revision,settings,secret_id,updated_by,last_test_at,last_test_provider_id)
    values(true,next_revision,p_settings,current_secret,p_actor_id,clock_timestamp(),p_test_provider_id)
    on conflict(singleton) do update set revision=excluded.revision,settings=excluded.settings,
      secret_id=excluded.secret_id,updated_by=excluded.updated_by,updated_at=clock_timestamp(),
      last_test_at=excluded.last_test_at,last_test_provider_id=excluded.last_test_provider_id;
  return jsonb_build_object('saved',true)||private.email_settings_snapshot();
end;
$$;
revoke all on function private.save_email_settings(uuid,bigint,jsonb,text,text,uuid) from public, anon, authenticated, service_role;
grant execute on function private.save_email_settings(uuid,bigint,jsonb,text,text,uuid) to service_role;
create function public.save_email_settings(p_actor_id uuid,p_expected_revision bigint,p_settings jsonb,
  p_api_key text,p_test_provider_id text,p_request_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.save_email_settings(p_actor_id,p_expected_revision,p_settings,p_api_key,p_test_provider_id,p_request_id)
$$;
revoke all on function public.save_email_settings(uuid,bigint,jsonb,text,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.save_email_settings(uuid,bigint,jsonb,text,text,uuid) to service_role;

create function private.record_email_test(p_actor_id uuid,p_expected_revision bigint,p_test_provider_id text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_revision bigint;
begin
  if not private.is_confirmed_email_admin(p_actor_id) then
    raise exception 'Administrator required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fabelpad.email-settings',0));
  select revision into current_revision from private.email_delivery_settings where singleton for update;
  if p_expected_revision is null or current_revision is null or current_revision<>p_expected_revision then
    return jsonb_build_object('saved',false)||private.email_settings_snapshot(); end if;
  if not exists(select 1 from private.email_delivery_settings s join vault.decrypted_secrets v on v.id=s.secret_id where v.decrypted_secret<>'') then
    raise exception 'Email delivery configuration unavailable' using errcode='55000'; end if;
  perform private.consume_email_test(p_actor_id,p_request_id,p_test_provider_id);
  update private.email_delivery_settings set last_test_at=clock_timestamp(),last_test_provider_id=p_test_provider_id where singleton;
  return jsonb_build_object('saved',true)||private.email_settings_snapshot();
end;
$$;
revoke all on function private.record_email_test(uuid,bigint,text,uuid) from public, anon, authenticated, service_role;
grant execute on function private.record_email_test(uuid,bigint,text,uuid) to service_role;
create function public.record_email_test(p_actor_id uuid,p_expected_revision bigint,p_test_provider_id text,p_request_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.record_email_test(p_actor_id,p_expected_revision,p_test_provider_id,p_request_id) $$;
revoke all on function public.record_email_test(uuid,bigint,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_email_test(uuid,bigint,text,uuid) to service_role;
