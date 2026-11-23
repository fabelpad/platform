-- Additive project-local billing. All four gates start false. No hosted/provider
-- mutation, invented acceptance, imported payment or public premium text.
-- Private definers are deliberately narrow; exposed RPCs are invokers.
create table private.billing_installation (
 singleton boolean primary key default true check(singleton),
 project_ref text check(project_ref in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs'))
);
insert into private.billing_installation(singleton) values(true);
create function private.billing_environment() returns text language sql stable security definer set search_path='' as $$
 select case coalesce((select project_ref from private.billing_installation where singleton),(select project_ref from private.lifecycle_worker_schedule where singleton)) when 'aptprpkosqctwrzeetgs' then 'production' else 'staging' end
$$;
create function private.configure_billing_environment(p_project_ref text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_project_ref not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') or p_project_ref is null then raise exception 'billing_invalid_project' using errcode='22023';end if;
 if exists(select 1 from private.billing_installation where project_ref is not null and project_ref<>p_project_ref) or exists(select 1 from private.lifecycle_worker_schedule where project_ref<>p_project_ref) then raise exception 'billing_environment_pinned' using errcode='22023';end if;
 update private.billing_installation set project_ref=p_project_ref where singleton;
end $$;
create function private.billing_defaults() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,'environment',private.billing_environment(),'appOrigin',case when private.billing_environment()='production' then 'https://fabelpad.nl' else 'https://staging.fabelpad.nl' end,'offerVersion','2026-11-23.1','termsVersion','2026-11-23.1','privacyVersion','2026-11-23.1',
 'prices','{"month":{"amountCents":499,"currency":"EUR","enabled":true},"year":{"amountCents":3999,"currency":"EUR","enabled":true}}'::jsonb,
 'founders','{"maximum":50,"durationMonths":12,"startsAt":null,"endsAt":null,"campaignVersion":"founders-1"}'::jsonb,
 'mollie','{"mode":"test","expectedProfileId":"","firstMethods":["ideal"],"description":"Fabelpad Gezin"}'::jsonb,
 'play','{"packageName":"nl.fabelpad.app","monthlyProductId":"","monthlyBasePlanId":"","yearlyProductId":"","yearlyBasePlanId":"","rtdnAudience":"","rtdnServiceAccount":"","pubsubSubscription":""}'::jsonb)
$$;
create table private.billing_control (
 singleton boolean primary key default true check(singleton), revision bigint not null default 1 check(revision between 1 and 9007199254740991),
 settings jsonb not null, payment_required boolean not null default false, founders_enabled boolean not null default false,
 mollie_enabled boolean not null default false, play_enabled boolean not null default false,
 awarded integer not null default 0 check(awarded>=0), campaign_started_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(), updated_by uuid references auth.users(id) on delete set null
);
insert into private.billing_control(singleton,settings) values(true,private.billing_defaults());
create table private.billing_history(revision bigint primary key,settings jsonb not null,created_at timestamptz not null default clock_timestamp());
insert into private.billing_history select revision,settings from private.billing_control;
create table private.billing_audit(id bigint generated always as identity primary key,actor_id uuid references auth.users(id) on delete set null,action text not null,revision bigint,details jsonb not null default '{}',created_at timestamptz not null default clock_timestamp());
create table private.billing_credentials(
 revision bigint generated always as identity primary key,provider text not null check(provider in ('mollie','play')),
 environment text not null check(environment in ('staging','production')),mode text not null check(mode in ('test','live')),
 secret_id uuid not null,settings_revision bigint not null references private.billing_history(revision),profile_id text not null default '',
 verified boolean not null default false,active boolean not null default false,verification jsonb not null default '{}',verified_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),created_by uuid references auth.users(id) on delete set null,
 check(environment<>'staging' or mode='test')
);
create unique index billing_active_credential_idx on private.billing_credentials(provider,environment,mode) where active;
create table private.billing_first_completions(parent_id uuid primary key references auth.users(id) on delete cascade,completed_at timestamptz not null,eligible boolean not null);
insert into private.billing_first_completions select parent_id,accepted_at,false from private.account_lifecycle where accepted_at is not null;
create table private.billing_founders_awards(id uuid primary key default gen_random_uuid(),parent_id uuid unique references auth.users(id) on delete set null,starts_at timestamptz not null,ends_at timestamptz not null,campaign_version text not null,place integer not null unique);
create index billing_founders_parent_idx on private.billing_founders_awards(parent_id) where parent_id is not null;
create table private.billing_entitlements(id uuid primary key default gen_random_uuid(),parent_id uuid not null references auth.users(id) on delete cascade,source text not null check(source in ('founders','coupon','mollie','play')),source_id text not null,starts_at timestamptz not null,ends_at timestamptz,state text not null default 'active' check(state in ('active','revoked')),created_at timestamptz not null default clock_timestamp(),unique(source,source_id),check(ends_at is null or ends_at>starts_at));
create index billing_entitlements_parent_idx on private.billing_entitlements(parent_id,ends_at) where state='active';
create table private.billing_content_catalog(story_id text primary key check(story_id ~ '^[a-z][a-z0-9_-]{1,79}$'),legacy_free boolean not null default false,available boolean not null default true,metadata jsonb not null default '{}',created_at timestamptz not null default clock_timestamp());
insert into private.billing_content_catalog(story_id,legacy_free) select unnest(array['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars']),true;
create table private.billing_premium_releases(story_id text not null references private.billing_content_catalog,content_version text not null check(content_version~'^[a-f0-9]{16,64}$'),payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<4194304),download_path text,created_at timestamptz not null default clock_timestamp(),primary key(story_id,content_version));
create table private.billing_free_selection(parent_id uuid primary key references auth.users(id) on delete cascade,full_story_id text references private.billing_content_catalog,preview_ids text[] not null default '{}',updated_at timestamptz not null default clock_timestamp(),check(cardinality(preview_ids)<=2));
create table private.billing_coupon_batches(id uuid primary key default gen_random_uuid(),name text not null,kind text not null check(kind in ('percentage','amount')),value integer not null check(value>0),amount_basis text not null check(amount_basis in ('period','month')),duration_months integer check(duration_months between 1 and 120),valid_from timestamptz,valid_until timestamptz,maximum_redemptions integer check(maximum_redemptions>0),per_family_limit integer not null default 1 check(per_family_limit=1),periods text[] not null check(cardinality(periods) between 1 and 2 and periods<@array['month','year']),enabled boolean not null default false,redeemed integer not null default 0 check(redeemed>=0),created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default clock_timestamp(),check(kind<>'percentage' or value<=100),check(valid_until is null or valid_from is null or valid_until>valid_from));
create table private.billing_coupons(id uuid primary key default gen_random_uuid(),batch_id uuid not null references private.billing_coupon_batches,code text not null unique check(code~'^[A-Z0-9][A-Z0-9-]{3,63}$'));
create table private.billing_coupon_redemptions(id uuid primary key default gen_random_uuid(),coupon_id uuid not null references private.billing_coupons,parent_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default clock_timestamp(),starts_at timestamptz not null,ends_at timestamptz,snapshot jsonb not null,status text not null default 'reserved' check(status in ('reserved','redeemed','released')),reservation_id uuid);
create unique index billing_coupon_once_batch_parent_idx on private.billing_coupon_redemptions((snapshot->>'batchId'),parent_id) where parent_id is not null and status<>'released';
create index billing_coupon_code_consumption_idx on private.billing_coupon_redemptions(coupon_id,status) where status<>'released';
create unique index billing_coupon_once_code_parent_idx on private.billing_coupon_redemptions(coupon_id,parent_id) where parent_id is not null and status<>'released';
create table private.billing_purchase_reservations(
 id uuid primary key default gen_random_uuid(),parent_id uuid references auth.users(id) on delete set null,parent_digest text not null,
 request_id uuid not null,provider text not null check(provider in ('mollie','play')),period text not null check(period in ('month','year')),
 environment text not null check(environment in ('staging','production')),mode text not null check(mode in ('test','live')),
 amount_cents integer not null check(amount_cents>=0),base_amount_cents integer not null check(base_amount_cents>0),currency text not null default 'EUR' check(currency='EUR'),
 settings_revision bigint not null references private.billing_history,credential_revision bigint references private.billing_credentials,
 offer_version text not null,terms_version text not null,quote jsonb not null,coupon_id uuid references private.billing_coupons,
 phaseout_requested boolean not null default false,
 status text not null default 'reserved' check(status in ('reserved','provider_pending','paid','gift','failed','expired','cancelled','duplicate')),
 idempotency_key text not null unique,obfuscated_account_id text not null,provider_customer_id text,provider_payment_id text,checkout_url text,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,unique(parent_id,request_id)
);
create index billing_reservations_parent_idx on private.billing_purchase_reservations(parent_id,status,expires_at);
create unique index billing_reservations_provider_payment_idx on private.billing_purchase_reservations(provider,environment,mode,provider_payment_id) where provider_payment_id is not null;
create table private.billing_subscriptions(
 id uuid primary key default gen_random_uuid(),parent_id uuid references auth.users(id) on delete set null,parent_digest text not null,reservation_id uuid references private.billing_purchase_reservations,
 provider text not null check(provider in ('mollie','play')),environment text not null check(environment in ('staging','production')),mode text not null check(mode in ('test','live')),
 credential_revision bigint not null references private.billing_credentials,settings_revision bigint not null references private.billing_history,
 provider_subscription_id text,provider_customer_id text,token_hash text unique,token_secret_id uuid,obfuscated_account_id text,
 period text not null check(period in ('month','year')),amount_cents integer not null check(amount_cents>0),currency text not null default 'EUR' check(currency='EUR'),
 state text not null check(state in ('pending','active','grace','hold','cancelled','expired','refunded','revoked','failed')),
 starts_at timestamptz not null,paid_until timestamptz not null,auto_renew boolean not null default false,cancel_requested boolean not null default false,cancel_confirmed boolean not null default false,
 mandate_id text,provider_status text,refunded_cents integer not null default 0 check(refunded_cents>=0),charged_back_cents integer not null default 0 check(charged_back_cents>=0),
 last_evidence_event_id text,acknowledged boolean not null default false,verified_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),unique(provider,environment,mode,provider_subscription_id)
);
create index billing_subscriptions_parent_idx on private.billing_subscriptions(parent_id,state,paid_until);
create index billing_subscriptions_renew_idx on private.billing_subscriptions(provider,paid_until) where auto_renew;
create table private.billing_payments(id uuid primary key default gen_random_uuid(),subscription_id uuid references private.billing_subscriptions,reservation_id uuid references private.billing_purchase_reservations,parent_digest text not null,provider text not null,environment text not null,mode text not null,credential_revision bigint not null references private.billing_credentials,provider_payment_id text not null,amount_cents integer not null,currency text not null default 'EUR',period_start timestamptz not null,period_end timestamptz not null,refunded_cents integer not null default 0,created_at timestamptz not null default clock_timestamp(),unique(provider,environment,mode,provider_payment_id));
create index billing_payments_sub_idx on private.billing_payments(subscription_id,created_at);
create table private.billing_provider_events(id uuid primary key default gen_random_uuid(),provider text not null check(provider in ('mollie','play')),event_id text not null,payload_digest text not null,created_at timestamptz not null default clock_timestamp(),unique(provider,event_id));
create table private.billing_evidence_events(provider text not null,event_id text not null,payload_digest text not null,applied_at timestamptz not null default clock_timestamp(),primary key(provider,event_id));
create table private.billing_jobs(
 id uuid primary key default gen_random_uuid(),kind text not null,provider text check(provider in ('mollie','play')),parent_id uuid references auth.users(id) on delete set null,subscription_id uuid references private.billing_subscriptions,
 idempotency_key text not null unique,payload jsonb not null default '{}',settings_revision bigint not null references private.billing_history,credential_revision bigint references private.billing_credentials,
 environment text not null,mode text not null,state text not null default 'pending' check(state in ('pending','working','done','uncertain','attention','cancelled')),
 attempt integer not null default 0,first_attempt_at timestamptz,available_at timestamptz not null default clock_timestamp(),lease_token uuid,locked_until timestamptz,provider_id text,last_error_code text,result jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz
);
create index billing_jobs_due_idx on private.billing_jobs(available_at,id) where state in ('pending','working');
create index billing_jobs_sub_idx on private.billing_jobs(subscription_id);
create table private.billing_withdrawals(id uuid primary key default gen_random_uuid(),payment_id uuid not null references private.billing_payments,nonce_hash text not null unique,email_hash text not null,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,confirmed_at timestamptz,state text not null default 'pending' check(state in ('pending','confirmed','working','completed','attention')),unique(payment_id));
create table private.billing_mollie_segments(provider_subscription_id text primary key,subscription_id uuid not null references private.billing_subscriptions,amount_cents integer not null,metadata jsonb not null,start_date date not null,times integer,created_at timestamptz not null default clock_timestamp());
alter table private.billing_payments add column provider_metadata jsonb not null default '{}';
alter table private.billing_subscriptions add column duplicate_purchase boolean not null default false;
alter table private.billing_subscriptions add column cancellation_effective_at timestamptz;
alter table private.billing_purchase_reservations add column admin_trial boolean not null default false;
-- All billing relations are private and closed to every API role. Table access
-- is exclusively through audited functions, including the service-role worker.
do $$ declare r record;begin for r in select tablename from pg_tables where schemaname='private' and tablename like 'billing_%' loop execute format('alter table private.%I enable row level security',r.tablename);execute format('revoke all on private.%I from public,anon,authenticated,service_role',r.tablename);end loop;end $$;

create function private.billing_lock() returns void language sql volatile set search_path='' as $$ select pg_advisory_xact_lock(1633837926,509) $$;
create function private.billing_admin(p_fresh boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;begin actor:=case when p_fresh then private.require_fresh_parent() else private.lifecycle_identity() end;if not private.is_confirmed_email_admin(actor) then raise exception 'billing_admin_required' using errcode='42501';end if;return actor;end $$;
create function private.authorize_billing_admin(p_fresh boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.billing_admin(p_fresh);return '{"authorized":true}'::jsonb;end$$;
create function private.billing_parent() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lifecycle_identity();begin if not private.family_access_allowed(actor) then raise exception 'billing_active_parent_required' using errcode='42501';end if;return actor;end $$;
create function private.billing_bump(p_actor uuid,p_action text,p_details jsonb default '{}') returns void language plpgsql set search_path='' as $$
declare c private.billing_control;begin update private.billing_control set revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor where singleton returning * into c;insert into private.billing_history values(c.revision,c.settings,clock_timestamp());insert into private.billing_audit(actor_id,action,revision,details) values(p_actor,p_action,c.revision,p_details);end $$;
create function private.billing_effective() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.billing_control;env text:=private.billing_environment();m private.billing_credentials;p private.billing_credentials;f boolean;me boolean;pe boolean;begin
 select * into strict c from private.billing_control;select * into m from private.billing_credentials where provider='mollie' and environment=env and mode=c.settings#>>'{mollie,mode}' and active and verified;
 select * into p from private.billing_credentials where provider='play' and environment=env and mode=case when env='production' then 'live' else 'test' end and active and verified;
 f:=c.payment_required and c.founders_enabled and c.campaign_started_at is not null and clock_timestamp()>=c.campaign_started_at and (c.settings#>>'{founders,endsAt}' is null or clock_timestamp()<(c.settings#>>'{founders,endsAt}')::timestamptz) and c.awarded<(c.settings#>>'{founders,maximum}')::integer;
 me:=c.payment_required and c.mollie_enabled and m.revision is not null and (env<>'production' or m.mode='live') and coalesce((m.verification->>'recurringAvailable')::boolean,false) and coalesce((m.verification->>'callbackVerified')::boolean,false) and coalesce((m.verification->>'webhookVerified')::boolean,false);
 pe:=c.payment_required and c.play_enabled and p.revision is not null and coalesce((p.verification->>'productsVerified')::boolean,false) and coalesce((p.verification->>'rtdnVerified')::boolean,false) and coalesce((p.verification->>'serverVerificationVerified')::boolean,false);
 return jsonb_build_object('paymentRequired',jsonb_build_object('configured',c.payment_required,'effective',c.payment_required,'reason',case when c.payment_required then 'active' else 'disabled' end),
 'foundersEnabled',jsonb_build_object('configured',c.founders_enabled,'effective',f,'reason',case when not c.payment_required then 'payment_not_required' when not c.founders_enabled then 'paused' when c.awarded>=(c.settings#>>'{founders,maximum}')::integer then 'full' when not f then 'outside_window' else 'active' end),
 'mollieEnabled',jsonb_build_object('configured',c.mollie_enabled,'effective',me,'reason',case when not c.payment_required then 'payment_not_required' when not c.mollie_enabled then 'paused' when not me then 'configuration_unverified' else 'active' end),
 'playEnabled',jsonb_build_object('configured',c.play_enabled,'effective',pe,'reason',case when not c.payment_required then 'payment_not_required' when not c.play_enabled then 'paused' when not pe then 'configuration_unverified' else 'active' end));
end $$;
create function private.billing_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.billing_control;g jsonb;begin select * into c from private.billing_control;g:=private.billing_effective();return jsonb_build_object('revision',c.revision,'settings',c.settings,'gates',g,'founders',jsonb_build_object('awarded',c.awarded,'remaining',greatest(0,(c.settings#>>'{founders,maximum}')::integer-c.awarded),'maximum',(c.settings#>>'{founders,maximum}')::integer,'durationMonths',(c.settings#>>'{founders,durationMonths}')::integer,'startsAt',c.campaign_started_at,'status',g#>>'{foundersEnabled,reason}'),'credentials',coalesce((select jsonb_agg(jsonb_build_object('provider',provider,'mode',mode,'revision',revision,'configured',true,'verified',verified,'active',active,'verifiedAt',verified_at,'verification',verification) order by revision desc) from private.billing_credentials where environment=private.billing_environment()),'[]'::jsonb));end $$;
create function private.get_billing_settings() returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.billing_admin(false);return private.billing_snapshot();end$$;
create function private.billing_valid_settings(s jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare p text;n integer;begin
 if jsonb_typeof(s)<>'object' or (select count(*) from jsonb_object_keys(s))<>10 or not(s?&array['schemaVersion','environment','appOrigin','offerVersion','termsVersion','privacyVersion','prices','founders','mollie','play']) or s->>'schemaVersion'<>'1' or s->>'environment'<>private.billing_environment() or s->>'appOrigin'<>(case when private.billing_environment()='production' then 'https://fabelpad.nl' else 'https://staging.fabelpad.nl' end) then return false;end if;
 if octet_length(s::text)>16384 or s::text~'\\u000[0-9a-f]' or s->>'offerVersion'!~'^[A-Za-z0-9._-]{1,80}$' then return false;end if;
 if not exists(select 1 from private.legal_document_versions where kind='terms' and version=s->>'termsVersion') or not exists(select 1 from private.legal_document_versions where kind='privacy' and version=s->>'privacyVersion') then return false;end if;
 if jsonb_typeof(s->'prices')<>'object' or (select count(*) from jsonb_object_keys(s->'prices'))<>2 then return false;end if;
 foreach p in array array['month','year'] loop
 if jsonb_typeof(s#>array['prices',p]) is distinct from 'object' or not(s#>array['prices',p]?&array['amountCents','currency','enabled']) or (select count(*) from jsonb_object_keys(s#>array['prices',p]))<>3 or s#>>array['prices',p,'amountCents']!~'^[1-9][0-9]{0,6}$' or (s#>>array['prices',p,'amountCents'])::integer>1000000 or s#>>array['prices',p,'currency']<>'EUR' or jsonb_typeof(s#>array['prices',p,'enabled'])<>'boolean' then return false;end if;end loop;
 if jsonb_typeof(s->'founders') is distinct from 'object' or not(s->'founders'?&array['maximum','durationMonths','startsAt','endsAt','campaignVersion']) or (select count(*) from jsonb_object_keys(s->'founders'))<>5 or s#>>'{founders,maximum}'!~'^[1-9][0-9]{0,5}$' or (s#>>'{founders,maximum}')::integer>100000 or s#>>'{founders,durationMonths}'!~'^[1-9][0-9]{0,2}$' or (s#>>'{founders,durationMonths}')::integer>120 or s#>>'{founders,campaignVersion}'!~'^[A-Za-z0-9._-]{1,80}$' then return false;end if;
 if s#>>'{founders,startsAt}' is not null and not isfinite((s#>>'{founders,startsAt}')::timestamptz) or s#>>'{founders,endsAt}' is not null and not isfinite((s#>>'{founders,endsAt}')::timestamptz) then return false;end if;
 if s#>>'{founders,startsAt}' is not null and s#>>'{founders,endsAt}' is not null and (s#>>'{founders,endsAt}')::timestamptz<=(s#>>'{founders,startsAt}')::timestamptz then return false;end if;
 if jsonb_typeof(s->'mollie') is distinct from 'object' or not(s->'mollie'?&array['mode','expectedProfileId','firstMethods','description']) or (select count(*) from jsonb_object_keys(s->'mollie'))<>4 or s#>>'{mollie,mode}' not in ('test','live') or (private.billing_environment()='staging' and s#>>'{mollie,mode}'<>'test') or jsonb_typeof(s#>'{mollie,firstMethods}')<>'array' or jsonb_array_length(s#>'{mollie,firstMethods}')>10 or s#>>'{mollie,expectedProfileId}'!~'^(pfl_[A-Za-z0-9]{1,90})?$' or char_length(s#>>'{mollie,description}') not between 1 and 255 then return false;end if;
 if exists(select 1 from jsonb_array_elements_text(s#>'{mollie,firstMethods}') x where x!~'^[a-z][a-z0-9_]{1,39}$') then return false;end if;
 if jsonb_typeof(s->'play')<>'object' or (select count(*) from jsonb_object_keys(s->'play'))<>8 or s#>>'{play,packageName}'<>'nl.fabelpad.app' or not(s->'play'?&array['packageName','monthlyProductId','monthlyBasePlanId','yearlyProductId','yearlyBasePlanId','rtdnAudience','rtdnServiceAccount','pubsubSubscription']) then return false;end if;
 if exists(select 1 from jsonb_each(s->'play') e where jsonb_typeof(e.value)<>'string' or char_length(e.value#>>'{}')>500 or e.value#>>'{}'~'[[:cntrl:]<>]') then return false;end if;
 return true;
exception when others then return false;end $$;
create function private.save_billing_settings(p_expected_revision bigint,p_settings jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();c private.billing_control;begin perform private.billing_lock();select * into c from private.billing_control for update;
 if c.revision is distinct from p_expected_revision then return jsonb_build_object('saved',false)||private.billing_snapshot();end if;
 if private.billing_valid_settings(p_settings) is distinct from true or (p_settings#>>'{founders,maximum}')::integer<c.awarded then raise exception 'billing_invalid_settings' using errcode='22023';end if;
 if c.campaign_started_at is not null and ((p_settings#>>'{founders,campaignVersion}') is distinct from (c.settings#>>'{founders,campaignVersion}') or (p_settings#>>'{founders,startsAt}') is distinct from(c.settings#>>'{founders,startsAt}')) then raise exception 'billing_campaign_already_started' using errcode='22023';end if;
 -- A changed provider config requires a fresh verification before new sales.
 if p_settings->'mollie' is distinct from c.settings->'mollie' then update private.billing_credentials set active=false where provider='mollie';end if;
 if p_settings->'play' is distinct from c.settings->'play' then update private.billing_credentials set active=false where provider='play';end if;
 update private.billing_control set settings=p_settings where singleton;perform private.billing_bump(actor,'settings_saved');
 if p_settings->'mollie' is distinct from c.settings->'mollie' then insert into private.billing_credentials(provider,environment,mode,secret_id,settings_revision,created_by) select provider,environment,mode,secret_id,(select revision from private.billing_control),actor from private.billing_credentials where provider='mollie' and environment=private.billing_environment() and mode=p_settings#>>'{mollie,mode}' order by revision desc limit 1;end if;
 if p_settings->'play' is distinct from c.settings->'play' then insert into private.billing_credentials(provider,environment,mode,secret_id,settings_revision,created_by) select provider,environment,mode,secret_id,(select revision from private.billing_control),actor from private.billing_credentials where provider='play' and environment=private.billing_environment() order by revision desc limit 1;end if;
 return jsonb_build_object('saved',true)||private.billing_snapshot();end$$;
create function private.billing_phaseout_impact() returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.billing_admin(false);return jsonb_build_object('mollie',(select count(*) from private.billing_subscriptions where provider='mollie' and auto_renew),'play',(select count(*) from private.billing_subscriptions where provider='play' and auto_renew),'openPayments',(select count(*) from private.billing_purchase_reservations where status in ('reserved','provider_pending')));end$$;
create function private.billing_queue(p_kind text,p_provider text,p_parent uuid,p_sub uuid,p_key text,p_payload jsonb,p_revision bigint,p_credential bigint,p_env text,p_mode text) returns uuid language plpgsql set search_path='' as $$
declare jid uuid;begin insert into private.billing_jobs(kind,provider,parent_id,subscription_id,idempotency_key,payload,settings_revision,credential_revision,environment,mode) values(p_kind,p_provider,p_parent,p_sub,p_key,p_payload,p_revision,p_credential,p_env,p_mode) on conflict(idempotency_key) do nothing returning id into jid;if jid is null then select id into jid from private.billing_jobs where idempotency_key=p_key;end if;return jid;end$$;
create function private.set_billing_gate(p_expected_revision bigint,p_gate text,p_enabled boolean,p_confirm_phaseout boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();c private.billing_control;s private.billing_subscriptions;newval boolean;begin
 if p_gate not in ('paymentRequired','foundersEnabled','mollieEnabled','playEnabled') or p_enabled is null then raise exception 'billing_invalid_gate' using errcode='22023';end if;
 perform private.billing_lock();select * into c from private.billing_control for update;
 if c.revision is distinct from p_expected_revision then return jsonb_build_object('saved',false)||private.billing_snapshot();end if;
 if p_gate='paymentRequired' and not p_enabled and c.payment_required and (exists(select 1 from private.billing_subscriptions where auto_renew) or exists(select 1 from private.billing_purchase_reservations where status in ('reserved','provider_pending'))) and p_confirm_phaseout is distinct from true then raise exception 'billing_phaseout_confirmation_required' using errcode='22023';end if;
 if p_gate='paymentRequired' then update private.billing_control set payment_required=p_enabled;
 elsif p_gate='foundersEnabled' then
 if p_enabled and c.campaign_started_at is null then
 if c.settings#>>'{founders,startsAt}' is null then raise exception 'billing_campaign_start_required' using errcode='22023';end if;
 -- An administrator cannot award pre-existing accounts by backdating the campaign.
 if (c.settings#>>'{founders,startsAt}')::timestamptz<clock_timestamp()-interval '5 minutes' then raise exception 'billing_campaign_start_in_past' using errcode='22023';end if;
 update private.billing_control set campaign_started_at=(settings#>>'{founders,startsAt}')::timestamptz;
 end if;update private.billing_control set founders_enabled=p_enabled;
 elsif p_gate='mollieEnabled' then update private.billing_control set mollie_enabled=p_enabled;
 else update private.billing_control set play_enabled=p_enabled;end if;
 if p_gate='paymentRequired' and not p_enabled then
 update private.billing_purchase_reservations set phaseout_requested=true,status=case when status='reserved' then 'cancelled' else status end where status in ('reserved','provider_pending');
 for s in select * from private.billing_subscriptions where auto_renew order by id for update loop
 update private.billing_subscriptions set cancel_requested=true where id=s.id;
 perform private.billing_queue(s.provider||'_cancel',s.provider,s.parent_id,s.id,'phaseout:'||s.id::text,jsonb_build_object('subscriptionId',s.id,'reason','payment_not_required'),s.settings_revision,s.credential_revision,s.environment,s.mode);
 end loop;
 end if;
 if p_gate='playEnabled' and not p_enabled then
 perform private.billing_queue('play_sales_pause','play',null,null,'play-sales-pause:'||c.revision::text,jsonb_build_object('reason','channel_paused'),c.revision,null,private.billing_environment(),case when private.billing_environment()='production' then 'live' else 'test' end);
 end if;
 perform private.billing_bump(actor,'gate_changed',jsonb_build_object('gate',p_gate,'enabled',p_enabled));return jsonb_build_object('saved',true)||private.billing_snapshot();end$$;

create function private.save_billing_credential(p_expected_revision bigint,p_provider text,p_mode text,p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();c private.billing_control;sid uuid;rid bigint;begin
 perform private.billing_lock();select * into c from private.billing_control for update;if c.revision is distinct from p_expected_revision then return jsonb_build_object('saved',false)||private.billing_snapshot();end if;
 if p_provider not in ('mollie','play') or p_mode not in ('test','live') or (private.billing_environment()='staging' and p_mode<>'test') then raise exception 'billing_invalid_credential_target' using errcode='22023';end if;
 if coalesce(p_secret,'')='' then return jsonb_build_object('saved',true)||private.billing_snapshot();end if;
 if octet_length(p_secret)>32768 or (p_provider='mollie' and p_secret!~('^'||p_mode||'_[A-Za-z0-9]{10,200}$')) then raise exception 'billing_invalid_credential' using errcode='22023';end if;
 sid:=vault.create_secret(p_secret,'fabelpad_billing_'||p_provider||'_'||private.billing_environment()||'_'||p_mode||'_'||gen_random_uuid()::text,'Fabelpad immutable billing credential candidate');
 insert into private.billing_credentials(provider,environment,mode,secret_id,settings_revision,created_by) values(p_provider,private.billing_environment(),p_mode,sid,c.revision,actor) returning revision into rid;
 -- Existing active credential is deliberately retained until candidate test succeeds.
 perform private.billing_bump(actor,'credential_candidate_saved',jsonb_build_object('provider',p_provider,'mode',p_mode,'credentialRevision',rid));return jsonb_build_object('saved',true,'credentialRevision',rid)||private.billing_snapshot();end$$;
create function private.get_billing_provider_config(p_provider text,p_mode text,p_credential_revision bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.billing_credentials;s jsonb;secret text;begin
 if p_provider not in ('mollie','play') or (p_mode is null and p_credential_revision is null) or(p_mode is not null and p_mode not in ('test','live')) then raise exception 'billing_invalid_provider' using errcode='22023';end if;
 select * into r from private.billing_credentials where provider=p_provider and (p_mode is null or mode=p_mode) and environment=private.billing_environment() and (case when p_credential_revision is null then active and verified else revision=p_credential_revision end) order by revision desc limit 1;
 if r.revision is null then raise exception 'billing_provider_configuration_unavailable' using errcode='55000';end if;
 select settings into s from private.billing_history where revision=r.settings_revision;select decrypted_secret into secret from vault.decrypted_secrets where id=r.secret_id;
 if secret is null or secret='' then raise exception 'billing_provider_configuration_unavailable' using errcode='55000';end if;
 return jsonb_build_object('revision',r.revision,'provider',r.provider,'environment',r.environment,'mode',r.mode,'apiKey',secret,'profileId',coalesce(nullif(r.profile_id,''),s#>>'{mollie,expectedProfileId}'),'settingsRevision',r.settings_revision,'config',s,'verification',r.verification);
end$$;
create function private.record_billing_provider_test(p_credential_revision bigint,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.billing_credentials;c private.billing_control;s jsonb;safe jsonb;begin
 perform private.billing_lock();select * into strict r from private.billing_credentials where revision=p_credential_revision for update;select * into c from private.billing_control;select settings into s from private.billing_history where revision=r.settings_revision;
 if r.environment<>private.billing_environment() or p_result->>'mode' is distinct from r.mode or jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>4096 or s->r.provider is distinct from c.settings->r.provider then raise exception 'billing_provider_test_mismatch' using errcode='22023';end if;
 if r.provider='mollie' and (p_result->>'profileId'!~'^pfl_[A-Za-z0-9]{1,90}$' or p_result->>'profileId' is distinct from c.settings#>>'{mollie,expectedProfileId}') then raise exception 'billing_provider_profile_mismatch' using errcode='22023';end if;
 safe:=jsonb_build_object('mode',r.mode,'profileId',case when r.provider='mollie' then p_result->>'profileId' else null end,'firstMethods',coalesce(p_result->'firstMethods','[]'::jsonb),'recurringAvailable',coalesce((p_result->>'recurringAvailable')::boolean,false),'callbackVerified',coalesce((p_result->>'callbackVerified')::boolean,false) or exists(select 1 from private.billing_mollie_trials tr join private.billing_credentials tc on tc.revision=tr.credential_revision where tr.environment=r.environment and tc.profile_id=p_result->>'profileId' and tr.payment_paid and tr.callback_verified and tr.webhook_verified),'webhookVerified',coalesce((p_result->>'webhookVerified')::boolean,false) or exists(select 1 from private.billing_mollie_trials tr join private.billing_credentials tc on tc.revision=tr.credential_revision where tr.environment=r.environment and tc.profile_id=p_result->>'profileId' and tr.payment_paid and tr.callback_verified and tr.webhook_verified),'productsVerified',coalesce((p_result->>'productsVerified')::boolean,false) or coalesce((r.verification->>'productsVerified')::boolean,false),'rtdnVerified',coalesce((p_result->>'rtdnVerified')::boolean,false) or coalesce((r.verification->>'rtdnVerified')::boolean,false),'serverVerificationVerified',coalesce((p_result->>'serverVerificationVerified')::boolean,false) or coalesce((r.verification->>'serverVerificationVerified')::boolean,false),'salesStatus',case when p_result->>'salesStatus' in ('active','inactive') then p_result->>'salesStatus' else 'unknown' end);
 if jsonb_typeof(safe->'firstMethods')<>'array' or jsonb_array_length(safe->'firstMethods')>20 or exists(select 1 from jsonb_array_elements_text(safe->'firstMethods') a where a!~'^[a-z][a-z0-9_]{1,39}$') then raise exception 'billing_invalid_provider_test' using errcode='22023';end if;
 update private.billing_credentials set active=false where provider=r.provider and mode=r.mode and environment=r.environment and active;
 update private.billing_credentials set active=true,verified=true,verified_at=clock_timestamp(),profile_id=coalesce(safe->>'profileId',''),verification=safe where revision=r.revision;
 perform private.billing_bump(null,'provider_connection_verified',jsonb_build_object('provider',r.provider,'mode',r.mode,'credentialRevision',r.revision));return private.billing_snapshot();end$$;
create function private.delete_billing_credential(p_expected_revision bigint,p_credential_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();r private.billing_credentials;begin perform private.billing_lock();if p_expected_revision is distinct from(select revision from private.billing_control) then return jsonb_build_object('saved',false)||private.billing_snapshot();end if;select * into strict r from private.billing_credentials where revision=p_credential_revision for update;
 if r.active or exists(select 1 from private.billing_subscriptions where credential_revision=r.revision) or exists(select 1 from private.billing_purchase_reservations where credential_revision=r.revision) or exists(select 1 from private.billing_jobs where credential_revision=r.revision and state<>'done') then raise exception 'billing_credential_obligations_exist' using errcode='55000';end if;
 delete from private.billing_credentials where revision=r.revision;delete from vault.secrets where id=r.secret_id and not exists(select 1 from private.billing_credentials bc where bc.secret_id=r.secret_id);perform private.billing_bump(actor,'unused_credential_deleted',jsonb_build_object('credentialRevision',r.revision));return private.billing_snapshot();end$$;

create function private.billing_onboarding_completed() returns trigger language plpgsql security definer set search_path='' as $$
declare c private.billing_control;t timestamptz;ok boolean;added integer;award uuid;begin
 if new.accepted_at is null or old.accepted_at is not null then return new;end if;
 perform private.billing_lock();t:=private.lifecycle_now();select * into c from private.billing_control for update;
 ok:=not new.legacy_account and new.signup_channel in ('otp','google') and exists(select 1 from auth.users u where u.id=new.parent_id and u.email_confirmed_at is not null and not u.is_anonymous and u.created_at>=c.campaign_started_at and coalesce((to_jsonb(u)#>>'{raw_app_meta_data,fabelpad_test_account}')::boolean,false)=false) and new.created_at>=c.campaign_started_at;
 insert into private.billing_first_completions values(new.parent_id,new.accepted_at,coalesce(ok,false)) on conflict do nothing;get diagnostics added=row_count;
 if added<>1 or not coalesce(ok,false) or not coalesce((private.billing_effective()#>>'{foundersEnabled,effective}')::boolean,false) or new.terms_version is distinct from c.settings->>'termsVersion' then return new;end if;
 insert into private.billing_founders_awards(parent_id,starts_at,ends_at,campaign_version,place) values(new.parent_id,t,t+make_interval(months=>(c.settings#>>'{founders,durationMonths}')::integer),c.settings#>>'{founders,campaignVersion}',c.awarded+1) returning id into award;
 update private.billing_control set awarded=awarded+1 where singleton;
 insert into private.billing_entitlements(parent_id,source,source_id,starts_at,ends_at) select parent_id,'founders',id::text,starts_at,ends_at from private.billing_founders_awards where id=award;
 perform private.billing_queue('send_billing_email',null,new.parent_id,null,'founders-awarded:'||award::text,jsonb_build_object('template','founders_awarded','startsAt',t,'endsAt',t+make_interval(months=>(c.settings#>>'{founders,durationMonths}')::integer),'campaignVersion',c.settings#>>'{founders,campaignVersion}'),c.revision,null,private.billing_environment(),'live');
 return new;
end$$;
create trigger billing_first_onboarding after update of accepted_at on private.account_lifecycle for each row execute function private.billing_onboarding_completed();
create function private.billing_preview(p_parent uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.billing_free_selection;ids text[];begin
 insert into private.billing_free_selection(parent_id) values(p_parent) on conflict do nothing;select * into s from private.billing_free_selection where parent_id=p_parent for update;
 select coalesce(array_agg(q.story_id),'{}') into ids from(select story_id from private.billing_content_catalog where available and story_id is distinct from s.full_story_id order by case when story_id=any(s.preview_ids) then 0 else 1 end,md5(p_parent::text||':'||story_id),story_id limit 2) q;
 if ids is distinct from s.preview_ids then update private.billing_free_selection set preview_ids=ids where parent_id=p_parent;end if;
 return jsonb_build_object('fullStoryId',s.full_story_id,'chapterOneStoryIds',ids);
end$$;
create function private.billing_entitlement_for(p_parent uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.billing_entitlements;c private.billing_control;active_paid boolean;allowed boolean;begin
 select * into c from private.billing_control;allowed:=exists(select 1 from private.account_lifecycle where parent_id=p_parent and state='active');
 select * into e from private.billing_entitlements where parent_id=p_parent and state='active' and starts_at<=private.lifecycle_now() and (ends_at is null or ends_at>private.lifecycle_now()) order by (ends_at is null) desc,ends_at desc limit 1;
 active_paid:=exists(select 1 from private.billing_subscriptions where parent_id=p_parent and state in ('pending','active','grace','hold','cancelled') and (auto_renew or paid_until>private.lifecycle_now()));
 return jsonb_build_object('plan',case when e.source in ('founders','coupon') then e.source when e.source in ('mollie','play') then 'family' else 'free' end,'fullLibrary',allowed and (not c.payment_required or e.id is not null),'paymentRequired',c.payment_required,'validUntil',e.ends_at,'source',e.source,'activePaidContract',active_paid,'preview',private.billing_preview(p_parent),'maxChildren',5);
end$$;
create function private.get_billing_entitlement() returns jsonb language plpgsql security definer set search_path='' as $$declare actor uuid:=private.billing_parent();begin return private.billing_entitlement_for(actor);end$$;
create function private.choose_billing_free_story(p_story_id text) returns jsonb language plpgsql security definer set search_path='' as $$declare actor uuid:=private.billing_parent();begin perform private.billing_lock();if not exists(select 1 from private.billing_content_catalog where story_id=p_story_id and available) then raise exception 'billing_unknown_story' using errcode='22023';end if;insert into private.billing_free_selection(parent_id,full_story_id) values(actor,p_story_id) on conflict(parent_id) do update set full_story_id=excluded.full_story_id,updated_at=clock_timestamp() where private.billing_free_selection.full_story_id is null or not exists(select 1 from private.billing_content_catalog c where c.story_id=private.billing_free_selection.full_story_id and c.available);return private.billing_entitlement_for(actor);end$$;
create function private.save_billing_coupon_batch(p_expected_revision bigint,p_coupon jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();c private.billing_control;bid uuid;code text;code_ids jsonb:='[]';n integer;begin
 perform private.billing_lock();select * into c from private.billing_control for update;if c.revision is distinct from p_expected_revision then return jsonb_build_object('saved',false,'revision',c.revision);end if;
 if jsonb_typeof(p_coupon)<>'object' or (select count(*) from jsonb_object_keys(p_coupon))<>12 or not(p_coupon?&array['name','codes','kind','value','amountBasis','durationMonths','validFrom','validUntil','maximumRedemptions','perFamilyLimit','periods','enabled']) or p_coupon->>'kind' not in ('percentage','amount') or p_coupon->>'amountBasis' not in ('period','month') or p_coupon->>'value'!~'^[1-9][0-9]{0,8}$' or (p_coupon->>'kind'='percentage' and(p_coupon->>'value')::integer>100) or p_coupon->>'perFamilyLimit'<>'1' or jsonb_typeof(p_coupon->'enabled')<>'boolean' or char_length(p_coupon->>'name') not between 1 and 100 or p_coupon->>'name'~'[[:cntrl:]<>]' or jsonb_typeof(p_coupon->'codes')<>'array' or jsonb_array_length(p_coupon->'codes') not between 1 and 1000 or jsonb_typeof(p_coupon->'periods')<>'array' or jsonb_array_length(p_coupon->'periods') not between 1 and 2 or exists(select 1 from jsonb_array_elements_text(p_coupon->'periods') x where x not in ('month','year')) then raise exception 'billing_invalid_coupon' using errcode='22023';end if;
 if p_coupon->>'durationMonths' is not null and (p_coupon->>'durationMonths'!~'^[1-9][0-9]{0,2}$' or(p_coupon->>'durationMonths')::integer>120) or p_coupon->>'maximumRedemptions' is not null and(p_coupon->>'maximumRedemptions'!~'^[1-9][0-9]{0,6}$' or(p_coupon->>'maximumRedemptions')::integer>1000000) then raise exception 'billing_invalid_coupon' using errcode='22023';end if;
 insert into private.billing_coupon_batches(name,kind,value,amount_basis,duration_months,valid_from,valid_until,maximum_redemptions,periods,enabled,created_by) values(p_coupon->>'name',p_coupon->>'kind',(p_coupon->>'value')::integer,p_coupon->>'amountBasis',(p_coupon->>'durationMonths')::integer,(p_coupon->>'validFrom')::timestamptz,(p_coupon->>'validUntil')::timestamptz,(p_coupon->>'maximumRedemptions')::integer,array(select jsonb_array_elements_text(p_coupon->'periods')),(p_coupon->>'enabled')::boolean,actor) returning id into bid;
 for code in select upper(btrim(x)) from jsonb_array_elements_text(p_coupon->'codes') x loop
 if code!~'^[A-Z0-9][A-Z0-9-]{3,63}$' then raise exception 'billing_invalid_coupon_code' using errcode='22023';end if;
 insert into private.billing_coupons(batch_id,code) values(bid,code);code_ids:=code_ids||jsonb_build_array(code);end loop;
 perform private.billing_bump(actor,'coupon_batch_created',jsonb_build_object('batchId',bid,'count',jsonb_array_length(code_ids)));return jsonb_build_object('saved',true,'batchId',bid,'codes',code_ids,'revision',(select revision from private.billing_control));end$$;
create function private.set_billing_coupon_enabled(p_expected_revision bigint,p_batch_id uuid,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();c private.billing_control;begin
 perform private.billing_lock();select * into c from private.billing_control for update;
 if c.revision is distinct from p_expected_revision then return jsonb_build_object('saved',false,'revision',c.revision);end if;
 if p_enabled is null or not exists(select 1 from private.billing_coupon_batches where id=p_batch_id) then raise exception 'billing_invalid_coupon' using errcode='22023';end if;
 update private.billing_coupon_batches set enabled=p_enabled where id=p_batch_id;perform private.billing_bump(actor,'coupon_enabled_changed',jsonb_build_object('batchId',p_batch_id,'enabled',p_enabled));return jsonb_build_object('saved',true,'revision',(select revision from private.billing_control));end$$;
create function private.list_billing_coupons() returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.billing_admin(false);return coalesce((select jsonb_agg(to_jsonb(b)-'created_by'||jsonb_build_object('codes',(select jsonb_agg(code order by code) from private.billing_coupons where batch_id=b.id))) from private.billing_coupon_batches b),'[]'::jsonb);end$$;
create function private.billing_quote(p_parent uuid,p_period text,p_coupon_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.billing_control;cp private.billing_coupons;b private.billing_coupon_batches;base integer;discount integer:=0;mult integer:=1;until_at timestamptz;begin
 select * into c from private.billing_control;if p_period not in ('month','year') or coalesce((c.settings#>>array['prices',p_period,'enabled'])::boolean,false)=false then raise exception 'billing_invalid_period' using errcode='22023';end if;
 base:=(c.settings#>>array['prices',p_period,'amountCents'])::integer;
 if nullif(btrim(p_coupon_code),'') is not null then
 select * into cp from private.billing_coupons where code=upper(btrim(p_coupon_code));select * into b from private.billing_coupon_batches where id=cp.batch_id;
 if cp.id is null or not b.enabled or not(p_period=any(b.periods)) or(b.valid_from is not null and private.lifecycle_now()<b.valid_from) or(b.valid_until is not null and private.lifecycle_now()>=b.valid_until) or(b.maximum_redemptions is not null and (select count(*) from private.billing_coupon_redemptions rr where rr.coupon_id=cp.id and rr.status in ('reserved','redeemed'))>=b.maximum_redemptions) or exists(select 1 from private.billing_coupon_redemptions where parent_id=p_parent and status<>'released' and snapshot->>'batchId'=b.id::text) then raise exception 'billing_coupon_unavailable' using errcode='22023';end if;
 mult:=case when b.amount_basis='month' and p_period='year' then least(12,coalesce(b.duration_months,12)) else 1 end;
 discount:=least(base,case when b.kind='percentage' then round(base::numeric*b.value/100*case when p_period='year' then least(12,coalesce(b.duration_months,12))::numeric/12 else 1 end)::integer else least(2147483647,b.value::bigint*mult)::integer end);
 until_at:=case when b.duration_months is null then null else private.lifecycle_now()+make_interval(months=>b.duration_months) end;
 end if;
 return jsonb_build_object('period',p_period,'baseAmountCents',base,'amountCents',base-discount,'discountCents',discount,'couponId',cp.id,'couponDurationMonths',b.duration_months,'amountBasis',b.amount_basis,'offerVersion',c.settings->>'offerVersion','termsVersion',c.settings->>'termsVersion','settingsRevision',c.revision,'gift',base=discount,'renewalAmountCents',case when cp.id is not null and b.duration_months is null then base-discount else base end,'discountEndsAt',until_at,'couponSnapshot',case when cp.id is null then null else jsonb_build_object('batchId',b.id,'kind',b.kind,'value',b.value,'amountBasis',b.amount_basis,'durationMonths',b.duration_months) end);
end$$;
create function private.quote_billing_purchase(p_period text,p_coupon_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare actor uuid:=private.billing_parent();begin return private.billing_quote(actor,p_period,p_coupon_code);end$$;
create function private.billing_reservation_json(r private.billing_purchase_reservations) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('id',r.id,'reservationId',r.id,'parentId',r.parent_id,'provider',r.provider,'period',r.period,'amountCents',r.amount_cents,'baseAmountCents',r.base_amount_cents,'currency',r.currency,'settingsRevision',r.settings_revision,'credentialRevision',r.credential_revision,'mode',r.mode,'environment',r.environment,'offerVersion',r.offer_version,'termsVersion',r.terms_version,'expiresAt',r.expires_at,'status',r.status,'idempotencyKey',r.idempotency_key,'couponId',r.coupon_id,'obfuscatedAccountId',r.obfuscated_account_id,'productId',(select settings#>>array['play',case when r.period='month' then 'monthlyProductId' else 'yearlyProductId' end] from private.billing_history where revision=r.settings_revision),'basePlanId',(select settings#>>array['play',case when r.period='month' then 'monthlyBasePlanId' else 'yearlyBasePlanId' end] from private.billing_history where revision=r.settings_revision),'checkoutUrl',case when not r.phaseout_requested and coalesce((private.billing_effective()#>>array[r.provider||'Enabled','effective'])::boolean,false) then r.checkout_url else null end,'createdAt',r.created_at,'quote',r.quote)$$;
create function private.reserve_billing_purchase(p_provider text,p_period text,p_request_id uuid,p_expected_revision bigint,p_expected_amount_cents integer,p_terms_version text,p_accept_recurring boolean,p_coupon_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_parent();c private.billing_control;r private.billing_purchase_reservations;cfg private.billing_credentials;q jsonb;g jsonb;cp private.billing_coupons;b private.billing_coupon_batches;red uuid;expires timestamptz;begin
 perform private.billing_lock();select * into c from private.billing_control for update;
 if p_request_id is null or p_provider not in ('mollie','play') then raise exception 'billing_invalid_purchase' using errcode='22023';end if;
 select * into r from private.billing_purchase_reservations where parent_id=actor and request_id=p_request_id;
 if r.id is not null then if r.provider<>p_provider or r.period<>p_period or r.amount_cents is distinct from p_expected_amount_cents or r.terms_version is distinct from p_terms_version then raise exception 'billing_idempotency_conflict' using errcode='22023';end if;return case when r.status='gift' then jsonb_build_object('gift',true,'entitlement',private.billing_entitlement_for(actor)) else private.billing_reservation_json(r) end;end if;
 q:=private.billing_quote(actor,p_period,p_coupon_code);
 if p_expected_revision is distinct from c.revision or p_expected_amount_cents is distinct from(q->>'amountCents')::integer or p_terms_version is distinct from c.settings->>'termsVersion' then raise exception 'billing_quote_changed' using errcode='40001';end if;
 if not c.payment_required then raise exception 'billing_payment_not_required' using errcode='55000';end if;
 if coalesce((private.billing_entitlement_for(actor)->>'activePaidContract')::boolean,false) or exists(select 1 from private.billing_entitlements where parent_id=actor and source in ('founders','coupon') and state='active' and starts_at<=private.lifecycle_now() and(ends_at is null or ends_at>private.lifecycle_now())) then raise exception 'billing_existing_entitlement' using errcode='55000';end if;
 update private.billing_purchase_reservations set status='expired' where parent_id=actor and status='reserved' and expires_at<=private.lifecycle_now();
 if exists(select 1 from private.billing_purchase_reservations where parent_id=actor and status in ('reserved','provider_pending')) then raise exception 'billing_purchase_already_reserved' using errcode='55000';end if;
 if (q->>'gift')::boolean then
 select * into cp from private.billing_coupons where id=(q->>'couponId')::uuid;select * into strict b from private.billing_coupon_batches where id=cp.batch_id for update;
 insert into private.billing_coupon_redemptions(coupon_id,parent_id,starts_at,ends_at,snapshot) values(cp.id,actor,private.lifecycle_now(),(q->>'discountEndsAt')::timestamptz,q->'couponSnapshot') returning id into red;update private.billing_coupon_redemptions set status='redeemed' where id=red;
 update private.billing_coupon_batches set redeemed=redeemed+1 where id=b.id;
 insert into private.billing_entitlements(parent_id,source,source_id,starts_at,ends_at) values(actor,'coupon',red::text,private.lifecycle_now(),(q->>'discountEndsAt')::timestamptz);
 insert into private.billing_purchase_reservations(parent_id,parent_digest,request_id,provider,period,environment,mode,amount_cents,base_amount_cents,settings_revision,offer_version,terms_version,quote,coupon_id,status,idempotency_key,obfuscated_account_id,expires_at) values(actor,encode(extensions.digest(actor::text,'sha256'),'hex'),p_request_id,p_provider,p_period,private.billing_environment(),'live',0,(q->>'baseAmountCents')::integer,c.revision,c.settings->>'offerVersion',p_terms_version,q,cp.id,'gift','gift:'||actor||':'||p_request_id,encode(extensions.digest('fabelpad:'||actor::text,'sha256'),'hex'),private.lifecycle_now()) returning * into r;
 return jsonb_build_object('gift',true,'entitlement',private.billing_entitlement_for(actor));end if;
 if p_accept_recurring is distinct from true then raise exception 'billing_recurring_consent_required' using errcode='22023';end if;
 g:=private.billing_effective();if coalesce((g#>>array[p_provider||'Enabled','effective'])::boolean,false)=false then raise exception 'billing_channel_unavailable' using errcode='55000';end if;
 select * into strict cfg from private.billing_credentials where provider=p_provider and environment=private.billing_environment() and mode=case when p_provider='mollie' then c.settings#>>'{mollie,mode}' when private.billing_environment()='production' then 'live' else 'test' end and active and verified;
 if q->>'couponId' is not null then select * into cp from private.billing_coupons where id=(q->>'couponId')::uuid;select * into b from private.billing_coupon_batches where id=cp.batch_id for update;insert into private.billing_coupon_redemptions(coupon_id,parent_id,starts_at,ends_at,snapshot) values(cp.id,actor,private.lifecycle_now(),(q->>'discountEndsAt')::timestamptz,q->'couponSnapshot');end if;
 expires:=private.lifecycle_now()+interval '30 minutes';
 insert into private.billing_purchase_reservations(parent_id,parent_digest,request_id,provider,period,environment,mode,amount_cents,base_amount_cents,settings_revision,credential_revision,offer_version,terms_version,quote,coupon_id,idempotency_key,obfuscated_account_id,expires_at) values(actor,encode(extensions.digest(actor::text,'sha256'),'hex'),p_request_id,p_provider,p_period,private.billing_environment(),cfg.mode,(q->>'amountCents')::integer,(q->>'baseAmountCents')::integer,c.revision,cfg.revision,c.settings->>'offerVersion',p_terms_version,q,cp.id,'purchase:'||actor||':'||p_request_id,encode(extensions.digest('fabelpad:'||actor::text,'sha256'),'hex'),expires) returning * into r;
 if cp.id is not null then update private.billing_coupon_redemptions set reservation_id=r.id where coupon_id=cp.id and parent_id=actor and status='reserved';end if;
 if p_provider='mollie' then perform private.billing_queue('mollie_first_payment','mollie',actor,null,r.idempotency_key,jsonb_build_object('reservationId',r.id),c.revision,cfg.revision,r.environment,r.mode);end if;
 return private.billing_reservation_json(r);
end$$;
create function private.recheck_billing_purchase(p_reservation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.billing_purchase_reservations;g jsonb;begin perform private.billing_lock();select * into strict r from private.billing_purchase_reservations where id=p_reservation_id for update;g:=private.billing_effective();
 if r.parent_id is null or not exists(select 1 from private.account_lifecycle where parent_id=r.parent_id and state='active') or r.phaseout_requested or r.status not in ('reserved','provider_pending') or(r.status='reserved' and r.expires_at<=private.lifecycle_now()) or (coalesce((g#>>array[r.provider||'Enabled','effective'])::boolean,false)=false and not(r.admin_trial and r.environment='staging' and r.mode='test' and private.is_confirmed_email_admin(r.parent_id))) then raise exception 'billing_checkout_no_longer_available' using errcode='55000';end if;
 update private.billing_purchase_reservations set status='provider_pending' where id=r.id;return private.billing_reservation_json(r);end$$;
create function private.get_billing_purchase(p_reservation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare actor uuid:=private.billing_parent();r private.billing_purchase_reservations;begin select * into strict r from private.billing_purchase_reservations where id=p_reservation_id and parent_id=actor;return private.billing_reservation_json(r);end$$;

create function private.claim_billing_jobs(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;result jsonb:='[]';payload jsonb;raw_token text;token_secret uuid;begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'billing_invalid_limit' using errcode='22023';end if;
 -- Prepare expired leases into durable read/reconcile duties, never blind replay.
 perform private.prepare_billing_jobs();
 for j in select * from private.billing_jobs where state='pending' and available_at<=clock_timestamp() order by available_at,id limit p_limit for update skip locked loop
 update private.billing_jobs set state='working',lease_token=gen_random_uuid(),locked_until=clock_timestamp()+interval '5 minutes',attempt=attempt+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()) where id=j.id returning * into j;
 payload:=j.payload;
 if j.provider='play' and j.subscription_id is not null and payload->>'tokenSecretId' is null then select token_secret_id into token_secret from private.billing_subscriptions where id=j.subscription_id; if token_secret is not null then payload:=payload||jsonb_build_object('tokenSecretId',token_secret);end if;end if;
 if payload->>'tokenSecretId' is not null then select decrypted_secret into raw_token from vault.decrypted_secrets where id=(payload->>'tokenSecretId')::uuid;payload:=(payload-'tokenSecretId')||jsonb_build_object('purchaseToken',raw_token);end if;
 result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'kind',j.kind,'provider',j.provider,'idempotencyKey',j.idempotency_key,'firstAttemptAt',j.first_attempt_at,'providerId',j.provider_id,'payload',payload,'settingsRevision',j.settings_revision,'credentialRevision',j.credential_revision,'environment',j.environment,'mode',j.mode,'attempt',j.attempt,'leaseToken',j.lease_token));end loop;return result;end$$;
create function private.complete_billing_job(p_job_id uuid,p_lease_token uuid,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;safe jsonb;r private.billing_purchase_reservations;s private.billing_subscriptions;operation_kind text;original private.billing_jobs;ctx jsonb;begin
 select * into j from private.billing_jobs where id=p_job_id and state='working' and lease_token=p_lease_token and locked_until>=clock_timestamp() for update;if j.id is null then return '{"completed":false}'::jsonb;end if;
 operation_kind:=j.kind;if j.kind='mollie_reconcile' and j.payload->>'uncertainJobId' is not null then select * into original from private.billing_jobs where id=(j.payload->>'uncertainJobId')::uuid;operation_kind:=original.kind;end if;
 if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>8192 then raise exception 'billing_invalid_job_result' using errcode='22023';end if;
 safe:=jsonb_strip_nulls(jsonb_build_object('providerId',p_result->>'providerId','reconcileRequired',p_result->'reconcileRequired','paymentId',p_result->>'paymentId','customerId',p_result->>'customerId','providerSubscriptionId',p_result->>'providerSubscriptionId','refundId',p_result->>'refundId','checkoutUrl',p_result->>'checkoutUrl','status',p_result->>'status','cancellationConfirmed',p_result->'cancellationConfirmed','refundConfirmed',p_result->'refundConfirmed','refundAmountCents',p_result->'refundAmountCents','paymentRefundedCents',p_result->'paymentRefundedCents','paymentRefundedCents',p_result->'paymentRefundedCents','renewalConfirmed',p_result->'renewalConfirmed','acknowledged',p_result->'acknowledged','providerConfirmed',p_result->'providerConfirmed','autoRenew',p_result->'autoRenew','salesStatus',p_result->>'salesStatus','renewalSegmentCompleted',p_result->'renewalSegmentCompleted'));
 if exists(select 1 from jsonb_each_text(safe) e where char_length(e.value)>2048 or e.value~'[[:cntrl:]]') then raise exception 'billing_invalid_job_result' using errcode='22023';end if;
 if operation_kind='mollie_first_payment' then
 if safe->>'paymentId' is null or safe->>'customerId' is null or safe->>'paymentId'!~'^tr_[A-Za-z0-9]{4,100}$' or safe->>'customerId'!~'^cst_[A-Za-z0-9]{4,100}$' or (safe->>'checkoutUrl' is not null and safe->>'checkoutUrl'!~'^https://(www\.)?mollie\.com/checkout/') then raise exception 'billing_invalid_job_result' using errcode='22023';end if;
 update private.billing_purchase_reservations set provider_payment_id=safe->>'paymentId',provider_customer_id=safe->>'customerId',checkout_url=safe->>'checkoutUrl' where id=(j.payload->>'reservationId')::uuid;
 elsif operation_kind='mollie_create_subscription' then
 if safe->>'providerSubscriptionId' is null or safe->>'providerSubscriptionId'!~'^sub_[A-Za-z0-9]{4,100}$' or safe->>'renewalConfirmed' is distinct from 'true' then raise exception 'billing_subscription_unconfirmed' using errcode='55000';end if;
 select * into s from private.billing_subscriptions where id=j.subscription_id;select * into r from private.billing_purchase_reservations where id=s.reservation_id;ctx:=private.billing_mollie_context(r,s,case when original.id is null then j else original end);
 insert into private.billing_mollie_segments(provider_subscription_id,subscription_id,amount_cents,metadata,start_date,times) values(safe->>'providerSubscriptionId',s.id,(ctx#>>'{renewalPlan,amountCents}')::integer,ctx#>'{renewalPlan,metadata}',(ctx#>>'{renewalPlan,startDate}')::date,(ctx#>>'{renewalPlan,times}')::integer) on conflict(provider_subscription_id) do nothing;
 update private.billing_subscriptions set provider_subscription_id=safe->>'providerSubscriptionId',amount_cents=(ctx#>>'{renewalPlan,amountCents}')::integer where id=j.subscription_id;
 -- A creation that returns after cancellation is still a real provider obligation.
 if s.cancel_requested or r.phaseout_requested or s.parent_id is null or not exists(select 1 from private.account_lifecycle where parent_id=s.parent_id and state='active') or not(select payment_required from private.billing_control) then
 update private.billing_subscriptions set cancel_requested=true,cancel_confirmed=false,auto_renew=true where id=s.id;
 perform private.billing_queue('mollie_cancel','mollie',s.parent_id,s.id,'cancel-created:'||(safe->>'providerSubscriptionId'),jsonb_build_object('subscriptionId',s.id,'reason','late_creation_after_stop'),s.settings_revision,s.credential_revision,s.environment,s.mode);end if;
 elsif operation_kind in ('mollie_cancel','play_cancel') then
 if not coalesce((safe->>'cancellationConfirmed'='true' or j.provider='play' and safe->>'providerConfirmed'='true' and safe->>'autoRenew'='false'),false) then raise exception 'billing_cancellation_unconfirmed' using errcode='55000';end if;
 update private.billing_subscriptions set auto_renew=false,cancel_confirmed=true where id=j.subscription_id;
 elsif operation_kind='play_acknowledge' then
 if safe->>'acknowledged' is distinct from 'true' then raise exception 'billing_acknowledgement_unconfirmed' using errcode='55000';end if;
 update private.billing_subscriptions set acknowledged=true where id=j.subscription_id;
 elsif operation_kind='mollie_reconcile' and j.subscription_id is not null then
 select * into s from private.billing_subscriptions where id=j.subscription_id for update;
 if safe->>'cancellationConfirmed'='true' then update private.billing_subscriptions set auto_renew=false,cancel_confirmed=true where id=s.id;
 elsif safe->>'renewalSegmentCompleted'='true' and s.auto_renew and not s.cancel_requested and exists(select 1 from private.billing_mollie_segments where provider_subscription_id=s.provider_subscription_id and times is not null) then
 update private.billing_subscriptions set provider_subscription_id=null where id=s.id;perform private.billing_queue('mollie_create_subscription','mollie',s.parent_id,s.id,'mollie-next-segment:'||s.id::text||':'||s.paid_until::text,jsonb_build_object('subscriptionId',s.id,'reservationId',s.reservation_id),s.settings_revision,s.credential_revision,s.environment,s.mode);end if;
 elsif operation_kind='mollie_refund' and safe->>'refundConfirmed'='true' then
 if safe->>'paymentRefundedCents' is null or safe->>'paymentRefundedCents'!~'^[0-9]{1,9}$' then raise exception 'billing_refund_total_unconfirmed' using errcode='55000';end if;
 update private.billing_payments set refunded_cents=least(amount_cents,greatest(refunded_cents,(safe->>'paymentRefundedCents')::integer)) where id=(j.payload->>'paymentId')::uuid;
 end if;
 if operation_kind='mollie_refund' and safe->>'reconcileRequired'='true' then if original.id is not null then update private.billing_jobs set result=safe where id=original.id;end if;update private.billing_jobs set state='pending',available_at=clock_timestamp()+interval '10 minutes',result=safe,provider_id=safe->>'providerId',lease_token=null,locked_until=null where id=j.id;return jsonb_build_object('completed',true,'pendingProviderConfirmation',true);end if;
 if j.kind='play_sales_pause' and safe->>'providerConfirmed'='true' and safe->>'salesStatus'='inactive' then update private.billing_credentials set verification=verification||'{"salesStatus":"inactive"}'::jsonb where provider='play' and active and environment=j.environment;end if;
 if original.id is not null then update private.billing_jobs set state='done',completed_at=clock_timestamp(),result=safe,provider_id=safe->>'providerId',lease_token=null,locked_until=null where id=original.id;end if;
 update private.billing_jobs set state='done',completed_at=clock_timestamp(),result=safe,provider_id=safe->>'providerId',lease_token=null,locked_until=null where id=j.id;return '{"completed":true}'::jsonb;end$$;
create function private.fail_billing_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_uncertain boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;begin
 if p_error_code is null or p_error_code!~'^[a-z][a-z0-9_]{1,79}$' then p_error_code:='provider_error';end if;
 select * into j from private.billing_jobs where id=p_job_id and state='working' and lease_token=p_lease_token for update;if j.id is null then return '{"updated":false}'::jsonb;end if;
 update private.billing_jobs set state=case when p_uncertain then 'uncertain' when attempt>=8 then 'attention' else 'pending' end,available_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(j.attempt,6)))::integer),last_error_code=p_error_code,lease_token=null,locked_until=null where id=j.id;
 if p_uncertain and j.provider is not null then perform private.billing_queue(j.provider||'_reconcile',j.provider,j.parent_id,j.subscription_id,'reconcile-job:'||j.id::text,j.payload||jsonb_build_object('uncertainJobId',j.id),j.settings_revision,j.credential_revision,j.environment,j.mode);end if;
 return '{"updated":true}'::jsonb;end$$;
create function private.record_billing_provider_event(p_provider text,p_event_id text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.billing_control;added integer;digest text;existing text;jid uuid;payload jsonb;sid uuid;cred bigint;mode text;begin
 if p_provider not in ('mollie','play') or p_event_id is null or length(p_event_id) not between 1 and 200 or p_event_id~'[[:cntrl:]]' or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16384 then raise exception 'billing_invalid_event' using errcode='22023';end if;
 digest:=encode(extensions.digest((p_payload-'receivedAt')::text,'sha256'),'hex');insert into private.billing_provider_events(provider,event_id,payload_digest) values(p_provider,p_event_id,digest) on conflict do nothing;get diagnostics added=row_count;
 if added=0 then select payload_digest into existing from private.billing_provider_events where provider=p_provider and event_id=p_event_id;if existing<>digest then raise exception 'billing_event_payload_conflict' using errcode='22023';end if;return jsonb_build_object('recorded',false);end if;
 payload:=p_payload;select * into c from private.billing_control;
 if p_payload->>'purchaseToken' is not null then sid:=vault.create_secret(p_payload->>'purchaseToken','fabelpad_billing_event_'||gen_random_uuid()::text,'Fabelpad private Play purchase token');payload:=(payload-'purchaseToken')||jsonb_build_object('tokenSecretId',sid);end if;
 cred:=nullif(p_payload->>'credentialRevision','')::bigint;mode:=case when private.billing_environment()='production' then 'live' else 'test' end;
 if cred is not null then select bc.mode into mode from private.billing_credentials bc where bc.revision=cred and bc.provider=p_provider and bc.environment=private.billing_environment();if mode is null then raise exception 'billing_event_credential_mismatch' using errcode='22023';end if;end if;
 jid:=private.billing_queue(case when p_provider='play' then 'play_verify' else 'mollie_reconcile' end,p_provider,null,null,'event:'||p_provider||':'||p_event_id,payload,c.revision,cred,private.billing_environment(),mode);return jsonb_build_object('recorded',true,'jobId',jid);end$$;
create function private.get_billing_play_binding(p_purchase_token_hash text,p_obfuscated_account_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.billing_subscriptions;r private.billing_purchase_reservations;begin
 if p_purchase_token_hash is null or p_purchase_token_hash!~'^[a-f0-9]{64}$' or(p_obfuscated_account_id is not null and p_obfuscated_account_id!~'^[a-f0-9]{64}$') then raise exception 'billing_invalid_play_binding' using errcode='22023';end if;
 select * into s from private.billing_subscriptions where token_hash=p_purchase_token_hash;
 if s.id is not null then
 if p_obfuscated_account_id is not null and s.obfuscated_account_id is distinct from p_obfuscated_account_id then raise exception 'billing_play_owner_mismatch' using errcode='42501';end if;
 return jsonb_build_object('parentId',s.parent_id,'reservationId',s.reservation_id,'subscriptionId',s.id,'mode',s.mode,'credentialRevision',s.credential_revision,'obfuscatedAccountId',s.obfuscated_account_id,'deleted',s.parent_id is null or not exists(select 1 from private.account_lifecycle where parent_id=s.parent_id and state='active'));
 end if;
 if p_obfuscated_account_id is null then return null;end if;
 select * into r from private.billing_purchase_reservations where provider='play' and obfuscated_account_id=p_obfuscated_account_id order by created_at desc limit 1;
 if r.id is null then return null;end if;
 return jsonb_build_object('parentId',r.parent_id,'reservationId',r.id,'mode',r.mode,'credentialRevision',r.credential_revision,'obfuscatedAccountId',r.obfuscated_account_id,'deleted',r.parent_id is null or not exists(select 1 from private.account_lifecycle where parent_id=r.parent_id and state='active'));
end$$;
create function private.get_billing_play_reservation(p_reservation_id uuid,p_parent_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r private.billing_purchase_reservations;begin select * into r from private.billing_purchase_reservations where id=p_reservation_id and parent_id=p_parent_id and provider='play';if r.id is null then return null;end if;return private.billing_reservation_json(r);end$$;

create function private.apply_billing_provider_evidence(p_evidence jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb:=p_evidence;r private.billing_purchase_reservations;s private.billing_subscriptions;cfg private.billing_credentials;parent uuid;sid uuid;token_hash text;token_secret uuid;added integer;digest text;old_digest text;t timestamptz;start_at timestamptz;end_at timestamptz;st text;renew boolean;duplicate_contract boolean:=false;historical_payment boolean:=false;jid uuid;amount integer;begin
 if jsonb_typeof(e)<>'object' or octet_length(e::text)>32768 or e->>'provider' not in ('mollie','play') or e->>'eventId' is null or length(e->>'eventId') not between 1 and 200 or e->>'state' not in ('pending','active','grace','hold','cancelled','expired','refunded','revoked','failed') or e->>'environment' is distinct from private.billing_environment() then raise exception 'billing_invalid_evidence' using errcode='22023';end if;
 perform private.billing_lock();digest:=encode(extensions.digest(e::text,'sha256'),'hex');select payload_digest into old_digest from private.billing_evidence_events where provider=e->>'provider' and event_id=e->>'eventId';
 -- Deduplication is against the latest verified state, so a chargeback reversal can restore an earlier paid fingerprint.
 select * into cfg from private.billing_credentials where revision=(e->>'credentialRevision')::bigint and provider=e->>'provider' and environment=e->>'environment' and mode=e->>'mode';
 if cfg.revision is null or not cfg.verified then raise exception 'billing_evidence_configuration_mismatch' using errcode='22023';end if;
 if e->>'provider'='mollie' and(e->>'profileId' is distinct from cfg.profile_id or e->>'currency' is distinct from 'EUR') then raise exception 'billing_evidence_profile_mismatch' using errcode='22023';end if;
 if e->>'reservationId' is not null then select * into r from private.billing_purchase_reservations where id=(e->>'reservationId')::uuid and provider=e->>'provider' for update;end if;
 if e->>'subscriptionId' is not null then select * into s from private.billing_subscriptions where id=(e->>'subscriptionId')::uuid and provider=e->>'provider' for update;end if;
 if s.id is null and e->>'providerSubscriptionId' is not null then select * into s from private.billing_subscriptions where provider=e->>'provider' and environment=e->>'environment' and mode=e->>'mode' and provider_subscription_id=e->>'providerSubscriptionId' for update;end if;
 token_hash:=e->>'tokenHash';if e->>'provider'='play' then
 if token_hash is null or token_hash!~'^[a-f0-9]{64}$' or e->>'obfuscatedAccountId' is null or e->>'obfuscatedAccountId'!~'^[a-f0-9]{64}$' or(e->>'purchaseToken' is not null and encode(extensions.digest(e->>'purchaseToken','sha256'),'hex')<>token_hash) then raise exception 'billing_invalid_play_evidence' using errcode='22023';end if;
 if s.id is null then select * into s from private.billing_subscriptions where private.billing_subscriptions.token_hash=e->>'tokenHash' for update;end if;if s.id is null and e->>'linkedTokenHash' is not null then select * into s from private.billing_subscriptions where private.billing_subscriptions.token_hash=e->>'linkedTokenHash' for update;end if;
 if e->>'linkedTokenHash' is not null and exists(select 1 from private.billing_subscriptions linked where linked.token_hash=e->>'linkedTokenHash' and linked.obfuscated_account_id is distinct from e->>'obfuscatedAccountId') then raise exception 'billing_play_owner_mismatch' using errcode='42501';end if;
 if s.id is not null and s.obfuscated_account_id is distinct from e->>'obfuscatedAccountId' or r.id is not null and r.obfuscated_account_id is distinct from e->>'obfuscatedAccountId' then raise exception 'billing_play_owner_mismatch' using errcode='42501';end if;
 end if;
 if r.id is null and s.reservation_id is not null then select * into r from private.billing_purchase_reservations where id=s.reservation_id;end if;
 if r.id is null then raise exception 'billing_unbound_evidence' using errcode='42501';end if;
 if s.id is not null and s.parent_digest<>r.parent_digest or r.environment is distinct from e->>'environment' or r.mode is distinct from e->>'mode' or r.credential_revision is distinct from cfg.revision then raise exception 'billing_evidence_binding_mismatch' using errcode='42501';end if;
 parent:=r.parent_id;st:=e->>'state';t:=(e->>'verifiedAt')::timestamptz;
 if t is null or t>clock_timestamp()+interval '5 minutes' or t<clock_timestamp()-interval '15 minutes' then raise exception 'billing_stale_verification' using errcode='22023';end if;
 if s.id is not null and t<s.verified_at then return jsonb_build_object('applied',false,'duplicate',false,'stale',true);end if;
 if old_digest is not null and s.last_evidence_event_id=e->>'eventId' then return jsonb_build_object('applied',false,'duplicate',true);end if;
 if e->>'provider'='play' then
 if e->>'period' is distinct from r.period or e->>'productId' is distinct from (select settings#>>array['play',case when r.period='month' then 'monthlyProductId' else 'yearlyProductId' end] from private.billing_history where revision=r.settings_revision) or e->>'basePlanId' is distinct from(select settings#>>array['play',case when r.period='month' then 'monthlyBasePlanId' else 'yearlyBasePlanId' end] from private.billing_history where revision=r.settings_revision) then raise exception 'billing_play_product_mismatch' using errcode='22023';end if;
 end if;
 amount:=coalesce((e->>'amountCents')::integer,r.amount_cents);
 if e->>'provider'='mollie' and amount<>(case when e->>'providerSubscriptionId' is not null then coalesce((select amount_cents from private.billing_mollie_segments where provider_subscription_id=e->>'providerSubscriptionId'),s.amount_cents) when e->>'providerPaymentId'=r.provider_payment_id then r.amount_cents else coalesce(s.amount_cents,r.amount_cents) end) then raise exception 'billing_payment_amount_mismatch' using errcode='22023';end if;
 start_at:=coalesce((e->>'periodStart')::timestamptz,s.starts_at,r.created_at);end_at:=coalesce((e->>'periodEnd')::timestamptz,s.paid_until,start_at+make_interval(months=>case when r.period='year' then 12 else 1 end));
 if not isfinite(start_at) or not isfinite(end_at) or end_at<=start_at or end_at>clock_timestamp()+interval '2 years' then raise exception 'billing_invalid_paid_period' using errcode='22023';end if;
 if e->>'provider'='mollie' and end_at<>start_at+make_interval(months=>case when r.period='year' then 12 else 1 end) then raise exception 'billing_invalid_paid_period' using errcode='22023';end if;
 historical_payment:=e->>'provider'='mollie' and s.id is not null and end_at<s.paid_until;
 renew:=coalesce((e->>'autoRenew')::boolean,false);if e->>'provider'='mollie' and s.id is not null and s.auto_renew and e->>'cancellationConfirmed' is distinct from 'true' then renew:=true;end if;
 if parent is null or not exists(select 1 from private.account_lifecycle where parent_id=parent and state='active') then renew:=false;end if;
 -- Test evidence is never a live production entitlement.
 if private.billing_environment()='production' and e->>'mode'<>'live' then raise exception 'billing_test_evidence_cannot_grant_live' using errcode='42501';end if;
 if s.id is null then
 duplicate_contract:=exists(select 1 from private.billing_subscriptions where parent_id=parent and state in ('active','grace','hold','pending','cancelled') and(auto_renew or paid_until>private.lifecycle_now()));
 if e->>'purchaseToken' is not null then token_secret:=vault.create_secret(e->>'purchaseToken','fabelpad_billing_purchase_'||gen_random_uuid()::text,'Fabelpad private linked Play token');end if;
 -- Use reservation UUID as stable contract identity for provider metadata.
 sid:=r.id;
 insert into private.billing_subscriptions(id,parent_id,parent_digest,reservation_id,provider,environment,mode,credential_revision,settings_revision,provider_subscription_id,provider_customer_id,token_hash,token_secret_id,obfuscated_account_id,period,amount_cents,state,starts_at,paid_until,auto_renew,cancel_requested,duplicate_purchase,mandate_id,provider_status,refunded_cents,charged_back_cents,acknowledged,verified_at)
 values(sid,parent,r.parent_digest,r.id,r.provider,r.environment,r.mode,cfg.revision,r.settings_revision,e->>'providerSubscriptionId',e->>'providerCustomerId',token_hash,token_secret,e->>'obfuscatedAccountId',r.period,r.amount_cents,st,start_at,end_at,renew,duplicate_contract or parent is null or r.phaseout_requested or not(select payment_required from private.billing_control),duplicate_contract,e->>'mandateId',e->>'providerStatus',coalesce((e->>'refundedCents')::integer,0),coalesce((e->>'chargedBackCents')::integer,0),coalesce((e->>'acknowledged')::boolean,false),t) returning * into s;
 else
 sid:=s.id;duplicate_contract:=s.duplicate_purchase;if e->>'provider'='play' and token_hash is distinct from s.token_hash and e->>'purchaseToken' is not null then token_secret:=vault.create_secret(e->>'purchaseToken','fabelpad_billing_purchase_'||gen_random_uuid()::text,'Fabelpad replacement private Play token');update private.billing_subscriptions set token_hash=e->>'tokenHash',token_secret_id=token_secret where id=s.id;end if;
 if not historical_payment then update private.billing_subscriptions set cancel_requested=cancel_requested or r.phaseout_requested or st in ('refunded','revoked'),cancel_confirmed=cancel_confirmed or coalesce((e->>'cancellationConfirmed')::boolean,false),state=st,starts_at=least(starts_at,start_at),paid_until=case when st in ('active','grace','cancelled') then greatest(paid_until,end_at) else end_at end,auto_renew=case when cancel_confirmed then false else renew end,provider_subscription_id=coalesce(e->>'providerSubscriptionId',provider_subscription_id),provider_customer_id=coalesce(e->>'providerCustomerId',provider_customer_id),mandate_id=coalesce(e->>'mandateId',mandate_id),provider_status=e->>'providerStatus',refunded_cents=greatest(refunded_cents,coalesce((e->>'refundedCents')::integer,0)),charged_back_cents=coalesce((e->>'chargedBackCents')::integer,charged_back_cents),acknowledged=acknowledged or coalesce((e->>'acknowledged')::boolean,false),verified_at=t where id=s.id returning * into s;end if;
 end if;
 if not historical_payment and st in ('active','grace','cancelled') and parent is not null and not duplicate_contract and exists(select 1 from private.account_lifecycle where parent_id=parent and state='active') and end_at>private.lifecycle_now() then
 insert into private.billing_entitlements(parent_id,source,source_id,starts_at,ends_at) values(parent,r.provider,sid::text,start_at,end_at) on conflict(source,source_id) do update set state='active',ends_at=least(greatest(private.billing_entitlements.ends_at,excluded.ends_at),coalesce(s.cancellation_effective_at,'infinity'::timestamptz));
 update private.billing_purchase_reservations set status='paid' where id=r.id;
 if r.coupon_id is not null then update private.billing_coupon_redemptions set status='redeemed' where reservation_id=r.id and status='reserved';get diagnostics added=row_count;if added>0 then update private.billing_coupon_batches set redeemed=redeemed+1 where id=(select batch_id from private.billing_coupons where id=r.coupon_id);end if;end if;
 elsif st in ('hold','expired','refunded','revoked','failed') then
 if st in ('expired','failed') then update private.billing_purchase_reservations set status='failed' where id=r.id and status in ('reserved','provider_pending');update private.billing_coupon_redemptions set status='released' where reservation_id=r.id and status='reserved';end if;
 if not historical_payment then update private.billing_entitlements set state='revoked' where source=r.provider and source_id=sid::text;end if;
 end if;
 if e->>'providerPaymentId' is not null and st in ('active','refunded','revoked') then
 insert into private.billing_payments(subscription_id,reservation_id,parent_digest,provider,environment,mode,credential_revision,provider_payment_id,amount_cents,period_start,period_end,refunded_cents,email_hash,provider_metadata) values(sid,r.id,r.parent_digest,r.provider,r.environment,r.mode,cfg.revision,e->>'providerPaymentId',amount,start_at,end_at,coalesce((e->>'refundedCents')::integer,0),(select encode(extensions.digest(lower(btrim(email)),'sha256'),'hex') from auth.users where id=parent),case when e->>'providerSubscriptionId' is not null then coalesce((select metadata from private.billing_mollie_segments where provider_subscription_id=e->>'providerSubscriptionId'),'{}'::jsonb) else jsonb_build_object('fabelpadContractId',r.id::text,'fabelpadOperationId',r.id::text,'fabelpadAttemptId',r.id::text) end) on conflict(provider,environment,mode,provider_payment_id) do update set refunded_cents=greatest(private.billing_payments.refunded_cents,excluded.refunded_cents);
 end if;
 if (parent is null or duplicate_contract) and st='active' and e->>'providerPaymentId' is not null then perform private.request_billing_refund((select id from private.billing_payments where provider=r.provider and environment=r.environment and mode=r.mode and provider_payment_id=e->>'providerPaymentId'),r.id,amount,case when duplicate_contract then 'duplicate' else 'access_loss' end);end if;
 if duplicate_contract then update private.billing_purchase_reservations set status='duplicate' where id=r.id;end if;
 if s.cancel_requested and not s.cancel_confirmed and (s.auto_renew or s.provider_subscription_id is not null) then
 perform private.billing_queue(s.provider||'_cancel',s.provider,parent,sid,'cancel-obligation:'||sid::text,jsonb_build_object('subscriptionId',sid,'reason',case when duplicate_contract then 'duplicate' else 'renewal_stopped' end),s.settings_revision,s.credential_revision,s.environment,s.mode);
 elsif not historical_payment and s.provider='mollie' and st='active' and s.auto_renew and s.provider_subscription_id is null and not s.cancel_requested then
 perform private.billing_queue('mollie_create_subscription','mollie',parent,sid,'mollie-subscribe:'||sid::text||':'||end_at::text,jsonb_build_object('subscriptionId',sid,'reservationId',r.id),s.settings_revision,s.credential_revision,s.environment,s.mode);
 end if;
 if s.provider='play' and coalesce((e->>'acknowledgementRequired')::boolean,false) then perform private.billing_queue('play_acknowledge','play',parent,sid,'play-ack:'||token_hash,jsonb_build_object('subscriptionId',sid,'tokenHash',token_hash),s.settings_revision,s.credential_revision,s.environment,s.mode);end if;
 if not historical_payment then update private.billing_subscriptions set last_evidence_event_id=e->>'eventId' where id=sid;end if;
 insert into private.billing_evidence_events values(e->>'provider',e->>'eventId',digest,clock_timestamp()) on conflict(provider,event_id) do update set payload_digest=excluded.payload_digest,applied_at=excluded.applied_at;return jsonb_build_object('applied',true,'duplicate',false,'duplicatePurchase',duplicate_contract,'subscriptionId',sid);
end$$;

create function private.billing_mollie_context(r private.billing_purchase_reservations,s private.billing_subscriptions,j private.billing_jobs,p_payment_id text default null) returns jsonb language plpgsql set search_path='' as $$
declare start_at timestamptz;end_at timestamptz;next_amount integer;times integer;until_at timestamptz;plan jsonb;meta jsonb;payment private.billing_payments;begin
 if r.id is null then return null;end if;
 start_at:=coalesce(s.starts_at,r.created_at);end_at:=coalesce(s.paid_until,start_at+make_interval(months=>case when r.period='year' then 12 else 1 end));
 meta:=jsonb_build_object('fabelpadContractId',r.id::text,'fabelpadOperationId',r.id::text,'fabelpadAttemptId',r.id::text);
 next_amount:=r.base_amount_cents;until_at:=(r.quote->>'discountEndsAt')::timestamptz;
 if r.coupon_id is not null and(until_at is null or end_at<until_at) then next_amount:=r.amount_cents;
 if until_at is not null and r.period='month' then times:=greatest(1,ceil(extract(epoch from(until_at-end_at))/(86400*31))::integer);end if;end if;
 if s.id is not null then plan:=jsonb_strip_nulls(jsonb_build_object('amountCents',next_amount,'startDate',to_char((end_at at time zone 'UTC')::date+case when(end_at at time zone 'UTC')::time='00:00:00'::time then 0 else 1 end,'YYYY-MM-DD'),'times',times,'mandateId',s.mandate_id,'metadata',jsonb_build_object('fabelpadContractId',r.id::text,'fabelpadOperationId',coalesce(j.id::text,'renewal:'||r.id::text))));end if;
 if j.kind='mollie_refund' then select * into payment from private.billing_payments where id=(j.payload->>'paymentId')::uuid;end if;
 return jsonb_build_object('reservationId',r.id,'contractId',r.id,'customerId',coalesce(s.provider_customer_id,r.provider_customer_id),'providerSubscriptionId',s.provider_subscription_id,'paymentId',coalesce(p_payment_id,payment.provider_payment_id,r.provider_payment_id),'refundId',j.result->>'refundId','credentialRevision',r.credential_revision,'settingsRevision',r.settings_revision,'environment',r.environment,'mode',r.mode,'amountCents',case when payment.id is not null then payment.amount_cents when p_payment_id is not null and p_payment_id is distinct from r.provider_payment_id then coalesce(s.amount_cents,r.amount_cents) else r.amount_cents end,'period',r.period,'periodStart',start_at,'periodEnd',end_at,'autoRenew',coalesce(s.auto_renew,true) and not coalesce(s.cancel_requested,false),'deleted',r.parent_id is null or not exists(select 1 from private.account_lifecycle where parent_id=r.parent_id and state='active'),'metadata',case when payment.id is not null then payment.provider_metadata else meta end,'renewalPlan',plan,'refund',case when payment.id is null then null else jsonb_build_object('amountCents',(j.payload->>'amountCents')::integer,'reason',j.payload->>'reason','metadata',meta||jsonb_build_object('fabelpadOperationId',j.id::text)) end);
end$$;
create function private.get_billing_mollie_binding(p_payment_id text,p_provider_subscription_id text default null,p_reservation_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.billing_purchase_reservations;s private.billing_subscriptions;j private.billing_jobs;segment private.billing_mollie_segments;p private.billing_payments;context jsonb;begin
 select * into segment from private.billing_mollie_segments where provider_subscription_id=p_provider_subscription_id;
 if segment.subscription_id is not null then select * into s from private.billing_subscriptions where id=segment.subscription_id;else select * into s from private.billing_subscriptions where provider='mollie' and environment=private.billing_environment() and provider_subscription_id=p_provider_subscription_id;end if;
 select * into p from private.billing_payments where provider='mollie' and environment=private.billing_environment() and provider_payment_id=p_payment_id;
 if s.id is null and p.subscription_id is not null then select * into s from private.billing_subscriptions where id=p.subscription_id;end if;
 if s.id is not null then select * into r from private.billing_purchase_reservations where id=s.reservation_id;
 else select * into r from private.billing_purchase_reservations where provider='mollie' and environment=private.billing_environment() and(provider_payment_id=p_payment_id or id=p_reservation_id) order by created_at desc limit 1;select * into s from private.billing_subscriptions where reservation_id=r.id;end if;
 context:=private.billing_mollie_context(r,s,j,p_payment_id);
 if context is null then return null;end if;
 if p.id is not null then context:=context||jsonb_build_object('amountCents',p.amount_cents,'metadata',p.provider_metadata,'periodStart',p.period_start,'periodEnd',p.period_end);
 elsif segment.provider_subscription_id is not null then context:=context||jsonb_build_object('amountCents',segment.amount_cents,'metadata',segment.metadata,'providerSubscriptionId',segment.provider_subscription_id);end if;
 return context;
end$$;
create function private.get_billing_mollie_job_context(p_job_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;r private.billing_purchase_reservations;s private.billing_subscriptions;original private.billing_jobs;context jsonb;begin select * into j from private.billing_jobs where id=p_job_id and lease_token=p_lease_token and state='working' and locked_until>=clock_timestamp();if j.id is null or j.provider<>'mollie' then raise exception 'billing_invalid_lease' using errcode='42501';end if;
 select * into s from private.billing_subscriptions where id=j.subscription_id;
 select * into r from private.billing_purchase_reservations where id=coalesce((j.payload->>'reservationId')::uuid,s.reservation_id);
 if r.id is null and j.payload->>'paymentId' is not null then select pr.* into r from private.billing_payments p join private.billing_purchase_reservations pr on pr.id=p.reservation_id where p.id=(j.payload->>'paymentId')::uuid;end if;
 if r.id is null and j.payload->>'paymentId' is null and j.payload->>'providerPaymentId' is not null then return private.get_billing_mollie_binding(j.payload->>'providerPaymentId',null,null);end if;
 if j.kind='mollie_reconcile' and j.payload->>'uncertainJobId' is not null then select * into original from private.billing_jobs where id=(j.payload->>'uncertainJobId')::uuid;context:=private.billing_mollie_context(r,s,original)||jsonb_build_object('reconcile',jsonb_build_object('kind',original.kind,'idempotencyKey',original.idempotency_key,'firstAttemptAt',original.first_attempt_at));else context:=private.billing_mollie_context(r,s,j);end if;return context;
end$$;
create function private.record_billing_mollie_customer(p_job_id uuid,p_lease_token uuid,p_customer_id text) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;r private.billing_purchase_reservations;begin select * into j from private.billing_jobs where id=p_job_id and lease_token=p_lease_token and state='working' and locked_until>=clock_timestamp() for update;if j.id is null or (j.kind<>'mollie_first_payment' and not(j.kind='mollie_reconcile' and exists(select 1 from private.billing_jobs old where old.id=(j.payload->>'uncertainJobId')::uuid and old.kind='mollie_first_payment'))) or p_customer_id is null or p_customer_id!~'^cst_[A-Za-z0-9]{4,100}$' then raise exception 'billing_invalid_customer_binding' using errcode='42501';end if;
 select * into strict r from private.billing_purchase_reservations where id=(j.payload->>'reservationId')::uuid for update;
 if r.provider_customer_id is not null and r.provider_customer_id<>p_customer_id then raise exception 'billing_customer_binding_conflict' using errcode='22023';end if;update private.billing_purchase_reservations set provider_customer_id=p_customer_id where id=r.id;return true;end$$;
create function private.recheck_billing_renewal(p_job_id uuid,p_lease_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;s private.billing_subscriptions;begin perform private.billing_lock();select * into j from private.billing_jobs where id=p_job_id and lease_token=p_lease_token and state='working' and locked_until>=clock_timestamp();select * into s from private.billing_subscriptions where id=j.subscription_id;
 if s.id is null or s.parent_id is null or not s.auto_renew or s.cancel_requested or s.cancel_confirmed or not(select payment_required from private.billing_control) or not exists(select 1 from private.account_lifecycle where parent_id=s.parent_id and state='active') then raise exception 'billing_renewal_no_longer_available' using errcode='55000';end if;return true;end$$;
create function private.cancel_billing_subscription(p_subscription_id uuid,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_fresh_parent();s private.billing_subscriptions;jid uuid;effective_at timestamptz;p private.billing_payments;amount integer;refund_job uuid;begin perform private.billing_lock();select * into strict s from private.billing_subscriptions where id=p_subscription_id and parent_id=actor for update;if p_request_id is null then raise exception 'billing_request_required' using errcode='22023';end if;
 effective_at:=s.paid_until;if s.period='year' and private.lifecycle_now()>=s.starts_at+interval '12 months' then effective_at:=least(s.paid_until,private.lifecycle_now()+interval '1 month');end if;
 update private.billing_subscriptions set cancel_requested=true,cancellation_effective_at=effective_at where id=s.id;
 update private.billing_entitlements set ends_at=least(ends_at,effective_at) where source=s.provider and source_id=s.id::text;
 if effective_at<s.paid_until then
 for p in select * from private.billing_payments where subscription_id=s.id and period_end>effective_at and refunded_cents<amount_cents order by id for update loop amount:=least(p.amount_cents-p.refunded_cents,floor(p.amount_cents::numeric*extract(epoch from(p.period_end-greatest(effective_at,p.period_start)))/extract(epoch from(p.period_end-p.period_start)))::integer);
 if amount>0 then if s.provider='mollie' then perform private.request_billing_refund(p.id,p_request_id,amount,'access_loss');else refund_job:=private.billing_queue('play_manual_refund','play',s.parent_id,s.id,'annual-refund:'||p.id::text,jsonb_build_object('subscriptionId',s.id,'paymentId',p.id,'amountCents',amount,'effectiveAt',effective_at,'reason','annual_renewal_notice'),s.settings_revision,s.credential_revision,s.environment,s.mode);update private.billing_jobs set state='attention',last_error_code='play_refund_console_confirmation_required' where id=refund_job;end if;end if;end loop;end if;
 jid:=private.billing_queue(s.provider||'_cancel',s.provider,actor,s.id,'parent-cancel:'||s.id::text,jsonb_build_object('subscriptionId',s.id,'reason','parent'),s.settings_revision,s.credential_revision,s.environment,s.mode);
 return jsonb_build_object('queued',true,'jobId',jid,'paidUntil',s.paid_until,'cancellationEffectiveAt',effective_at,'refundStatus',case when effective_at<s.paid_until then 'pending' else 'none' end,'renewalStopped',s.cancel_confirmed);end$$;
create function private.list_billing_subscriptions() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_parent();begin return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'provider',s.provider,'period',s.period,'amountCents',s.amount_cents,'currency',s.currency,'state',s.state,'paidUntil',s.paid_until,'cancellationEffectiveAt',s.cancellation_effective_at,'refundStatus',case when exists(select 1 from private.billing_jobs where subscription_id=s.id and kind in ('mollie_refund','play_manual_refund') and state<>'done') then 'pending' else 'none' end,'autoRenew',s.auto_renew,'cancelRequested',s.cancel_requested,'cancelConfirmed',s.cancel_confirmed,'environment',s.environment,'mode',s.mode,'paymentReference',(select p.id from private.billing_payments p where p.subscription_id=s.id order by created_at desc limit 1),'verifiedAt',s.verified_at) order by created_at desc) from private.billing_subscriptions s where parent_id=actor),'[]'::jsonb);end$$;
create function private.list_billing_operations() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.billing_admin(false);return jsonb_build_object('jobs',coalesce((select jsonb_agg(to_jsonb(j)) from(select id,kind,provider,state,attempt,available_at as "availableAt",created_at as "createdAt",last_error_code as "lastErrorCode",provider_id as "providerId" from private.billing_jobs order by created_at desc limit 100) j),'[]'::jsonb),'audit',coalesce((select jsonb_agg(to_jsonb(a)) from(select id,action,revision,details,created_at as "createdAt",actor_id as "actorId" from private.billing_audit order by id desc limit 100) a),'[]'::jsonb),'subscriptions',(select count(*) from private.billing_subscriptions),'openProviderActions',(select count(*) from private.billing_jobs where state in ('uncertain','attention')),'playSalesStatus',coalesce((select verification->>'salesStatus' from private.billing_credentials where provider='play' and active limit 1),'unknown'));end$$;
create function private.request_billing_refund(p_payment_id uuid,p_request_id uuid,p_amount_cents integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.billing_payments;s private.billing_subscriptions;j private.billing_jobs;jid uuid;remaining integer;held bigint;amount integer;key text;begin
 perform private.billing_lock();select * into strict p from private.billing_payments where id=p_payment_id for update;select * into strict s from private.billing_subscriptions where id=p.subscription_id;
 if p_request_id is null or p_reason not in ('withdrawal','access_loss','duplicate') or p_amount_cents is null or p_amount_cents<1 or p_amount_cents>p.amount_cents then raise exception 'billing_invalid_refund' using errcode='22023';end if;
 key:='refund:'||p.id::text||':'||p_request_id::text;select * into j from private.billing_jobs where idempotency_key=key;
 if j.id is not null then if coalesce((j.payload->>'requestedAmountCents')::integer,(j.payload->>'amountCents')::integer) is distinct from p_amount_cents or j.payload->>'reason' is distinct from p_reason then raise exception 'billing_refund_intent_conflict' using errcode='22023';end if;return jsonb_build_object('queued',true,'jobId',j.id);end if;
 select coalesce(sum((payload->>'amountCents')::integer),0) into held from private.billing_jobs where kind in ('mollie_refund','play_revoke') and payload->>'paymentId'=p.id::text and state in ('pending','working','uncertain','attention');
 remaining:=greatest(0,p.amount_cents-p.refunded_cents-held);amount:=least(p_amount_cents,remaining);
 if amount=0 then return jsonb_build_object('queued',true,'alreadyRefundedOrReserved',true);end if;
 jid:=private.billing_queue(case when p.provider='play' then 'play_revoke' else 'mollie_refund' end,p.provider,s.parent_id,s.id,key,jsonb_build_object('subscriptionId',s.id,'reservationId',p.reservation_id,'paymentId',p.id,'amountCents',amount,'requestedAmountCents',p_amount_cents,'reason',p_reason),s.settings_revision,p.credential_revision,p.environment,p.mode);return jsonb_build_object('queued',true,'jobId',jid);
end$$;

-- Lifecycle stops are durable financial obligations and survive account erasure.
create function private.billing_account_stopped() returns trigger language plpgsql security definer set search_path='' as $$
declare s private.billing_subscriptions;p private.billing_payments;remaining integer;t timestamptz:=private.lifecycle_now();reason text;begin
 if tg_op='UPDATE' and new.state not in ('deletion_pending','deleting') then return new;end if;
 if tg_op='UPDATE' and old.state=new.state then return new;end if;
 perform private.billing_lock();
 for s in select * from private.billing_subscriptions where parent_id=old.parent_id order by id for update loop
 update private.billing_subscriptions set cancel_requested=true where id=s.id;
 if s.auto_renew and not s.cancel_confirmed then perform private.billing_queue(s.provider||'_cancel',s.provider,old.parent_id,s.id,'account-cancel:'||s.id::text,jsonb_build_object('subscriptionId',s.id,'reason','account_removed'),s.settings_revision,s.credential_revision,s.environment,s.mode);end if;
 if tg_op='DELETE' or (tg_op='UPDATE' and new.state='deleting') then
 for p in select * from private.billing_payments where subscription_id=s.id and period_end>t and refunded_cents<amount_cents order by id for update loop
 remaining:=least(p.amount_cents-p.refunded_cents,greatest(0,floor(p.amount_cents::numeric*extract(epoch from(p.period_end-greatest(t,p.period_start)))/extract(epoch from(p.period_end-p.period_start)))::integer));
 if remaining>0 then perform private.request_billing_refund(p.id,p.id,remaining,'access_loss');end if;end loop;
 end if;end loop;
 update private.billing_jobs set state=case when state in ('pending','working') then 'cancelled' else state end,payload=payload-'frozenEmail'-'frozenDelivery' where parent_id=old.parent_id and kind='send_billing_email';
 update private.billing_purchase_reservations set phaseout_requested=true,status=case when status='reserved' then 'cancelled' else status end where parent_id=old.parent_id and status in ('reserved','provider_pending');
 if tg_op='DELETE' then return old;else return new;end if;end$$;
create trigger billing_lifecycle_stopped before update of state or delete on private.account_lifecycle for each row execute function private.billing_account_stopped();

create function private.prepare_billing_jobs() returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.billing_subscriptions;e private.billing_entitlements;c private.billing_control;jid uuid;n integer:=0;j private.billing_jobs;w private.billing_withdrawals;begin
 select * into c from private.billing_control;
 -- Short-lived verification and rendered mail data are independent of retained financial evidence.
 for w in select * from private.billing_withdrawals where (expires_at<=clock_timestamp() or confirmed_at is not null) and (email_secret_id is not null or token_secret_id is not null) order by expires_at,id limit 100 for update skip locked loop
 delete from vault.secrets where id in(w.email_secret_id,w.token_secret_id);
 update private.billing_withdrawals set email_secret_id=null,token_secret_id=null where id=w.id;
 update private.billing_jobs set payload=payload-'frozenEmail'-'frozenDelivery',state=case when state in ('pending','working') then 'cancelled' else state end,lease_token=null,locked_until=null where kind='send_billing_email' and payload->>'withdrawalId'=w.id::text;
 end loop;
 update private.billing_jobs set payload=payload-'frozenEmail'-'frozenDelivery' where id in(select id from private.billing_jobs where kind='send_billing_email' and state in ('done','cancelled') and coalesce(completed_at,created_at)<clock_timestamp()-interval '7 days' and (payload?'frozenEmail' or payload?'frozenDelivery') order by coalesce(completed_at,created_at),id limit 200 for update skip locked);

 update private.billing_purchase_reservations set status='expired' where status='reserved' and expires_at<=private.lifecycle_now();update private.billing_coupon_redemptions rr set status='released' where rr.status='reserved' and exists(select 1 from private.billing_purchase_reservations pr where pr.id=rr.reservation_id and pr.status in ('expired','failed','cancelled'));
 for s in select * from private.billing_subscriptions where state in ('pending','active','grace','hold','cancelled') and(verified_at<clock_timestamp()-interval '6 hours' or auto_renew and cancel_requested) order by id loop
 jid:=private.billing_queue(s.provider||'_reconcile',s.provider,s.parent_id,s.id,'reconcile:'||s.id::text||':'||floor(extract(epoch from clock_timestamp())/21600)::text,jsonb_build_object('subscriptionId',s.id,'reservationId',s.reservation_id),s.settings_revision,s.credential_revision,s.environment,s.mode);n:=n+1;
 if(s.cancel_requested or not c.payment_required or s.parent_id is null) and s.auto_renew and not s.cancel_confirmed then perform private.billing_queue(s.provider||'_cancel',s.provider,s.parent_id,s.id,'obligation-cancel:'||s.id::text,jsonb_build_object('subscriptionId',s.id,'reason','renewal_stopped'),s.settings_revision,s.credential_revision,s.environment,s.mode);end if;end loop;
 for e in select * from private.billing_entitlements where source in ('founders','coupon') and state='active' and ends_at is not null and ends_at>private.lifecycle_now() and ends_at<=private.lifecycle_now()+interval '14 days' loop
 perform private.billing_queue('send_billing_email',null,e.parent_id,null,'entitlement-reminder:'||e.id::text,jsonb_build_object('template','entitlement_ending','endsAt',e.ends_at,'source',e.source),c.revision,null,private.billing_environment(),'live');n:=n+1;end loop;
 -- Uncertain mutations stay visible until a provider read resolves them.
 -- An expired lease cannot repeat an unconfirmed charge or subscription creation.
 for j in select * from private.billing_jobs where state='working' and locked_until<clock_timestamp() order by id for update skip locked loop
 update private.billing_jobs set state='uncertain',lease_token=null,locked_until=null,last_error_code='lease_expired_reconcile' where id=j.id;
 if j.provider is not null then perform private.billing_queue(j.provider||'_reconcile',j.provider,j.parent_id,j.subscription_id,'reconcile-job:'||j.id::text,j.payload||jsonb_build_object('uncertainJobId',j.id),j.settings_revision,j.credential_revision,j.environment,j.mode);end if;n:=n+1;end loop;
 return jsonb_build_object('queued',n);
end$$;
create function private.get_billing_email_context(p_job_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;recipient text;context jsonb;begin
 select * into j from private.billing_jobs where id=p_job_id and kind='send_billing_email' and state='working' and lease_token=p_lease_token and locked_until>=clock_timestamp() for update;
 if j.id is null then return null;end if;
 if j.payload->'frozenEmail' is not null then return j.payload->'frozenEmail';end if;
 select u.email into recipient from auth.users u join private.account_lifecycle l on l.parent_id=u.id where u.id=j.parent_id and u.email_confirmed_at is not null and l.state='active';if recipient is null then return null;end if;
 if j.payload->>'template'='founders_awarded' then context:=jsonb_build_object('recipient',recipient,'subject','Je gratis Founders-jaar is begonnen','title','Welkom bij Fabelpad Founders','paragraphs',jsonb_build_array('Je gezin heeft toegang tot de volledige online bibliotheek.','Je gratis jaar loopt van '||(j.payload->>'startsAt')||' tot '||(j.payload->>'endsAt')||'. Er is geen betaling of automatische omzetting.'),'actionPath','/profiel/abonnement');
 elsif j.payload->>'template'='entitlement_ending' then context:=jsonb_build_object('recipient',recipient,'subject','Je gratis Fabelpad-toegang loopt af','title','Je gratis toegang loopt af','paragraphs',jsonb_build_array('Je uitgebreide toegang loopt tot '||(j.payload->>'endsAt')||'. Daarna blijft Fabelpad Ontdek beschikbaar. Je profielen en voortgang blijven behouden volgens het bewaarbeleid.','Er wordt niets automatisch afgeschreven.'),'actionPath','/profiel/abonnement');
 else return null;end if;
 update private.billing_jobs set payload=payload||jsonb_build_object('frozenEmail',context) where id=j.id;return context;end$$;

create function private.get_billing_public_offer() returns jsonb language plpgsql security definer set search_path='' as $$declare c private.billing_control;g jsonb;begin select * into c from private.billing_control;g:=private.billing_effective();return jsonb_build_object('revision',c.revision,'environment',private.billing_environment(),'offerVersion',c.settings->>'offerVersion','termsVersion',c.settings->>'termsVersion','privacyVersion',c.settings->>'privacyVersion','prices',c.settings->'prices','paymentRequired',c.payment_required,'gates',g,'founders',jsonb_build_object('effective',(g#>>'{foundersEnabled,effective}')::boolean,'maximum',(c.settings#>>'{founders,maximum}')::integer,'awarded',c.awarded,'remaining',greatest(0,(c.settings#>>'{founders,maximum}')::integer-c.awarded),'durationMonths',(c.settings#>>'{founders,durationMonths}')::integer,'startsAt',c.campaign_started_at,'status',g#>>'{foundersEnabled,reason}'),'mollie',g->'mollieEnabled','play',(g->'playEnabled')||((c.settings->'play')-'rtdnAudience'-'rtdnServiceAccount'-'pubsubSubscription'));end$$;

create table private.billing_mollie_trials(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id) on delete set null,request_id uuid not null,credential_revision bigint not null references private.billing_credentials,environment text not null,mode text not null default 'test' check(mode='test'),first_attempt_at timestamptz not null default clock_timestamp(),customer_id text,payment_id text unique,checkout_url text,payment_paid boolean not null default false,callback_verified boolean not null default false,webhook_verified boolean not null default false,created_at timestamptz not null default clock_timestamp(),unique(actor_id,request_id));
alter table private.billing_mollie_trials enable row level security;revoke all on private.billing_mollie_trials from public,anon,authenticated,service_role;
create function private.billing_trial_json(r private.billing_mollie_trials) returns jsonb language sql set search_path='' as $$select jsonb_build_object('id',r.id,'credentialRevision',r.credential_revision,'environment',r.environment,'mode',r.mode,'firstAttemptAt',r.first_attempt_at,'customerId',r.customer_id,'paymentId',r.payment_id,'checkoutUrl',r.checkout_url,'paymentPaid',r.payment_paid,'callbackVerified',r.callback_verified,'webhookVerified',r.webhook_verified)$$;
create function private.prepare_billing_mollie_trial(p_credential_revision bigint,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();cfg private.billing_credentials;r private.billing_mollie_trials;begin perform private.billing_lock();select * into cfg from private.billing_credentials where revision=p_credential_revision and provider='mollie' and mode='test' and environment=private.billing_environment();if cfg.revision is null or p_request_id is null then raise exception 'billing_test_credential_required' using errcode='22023';end if;
 select * into r from private.billing_mollie_trials where actor_id=actor and request_id=p_request_id;if r.id is not null then if r.credential_revision<>p_credential_revision then raise exception 'billing_idempotency_conflict' using errcode='22023';end if;return private.billing_trial_json(r);end if;
 if exists(select 1 from private.billing_mollie_trials where actor_id=actor and created_at>clock_timestamp()-interval '1 minute') then raise exception 'billing_trial_rate_limited' using errcode='54000';end if;
 insert into private.billing_mollie_trials(actor_id,request_id,credential_revision,environment) values(actor,p_request_id,cfg.revision,cfg.environment) returning * into r;return private.billing_trial_json(r);end$$;
create function private.get_billing_mollie_trial(p_trial_id uuid default null,p_payment_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare r private.billing_mollie_trials;begin select * into r from private.billing_mollie_trials where environment=private.billing_environment() and(case when p_trial_id is not null then id=p_trial_id else payment_id=p_payment_id end);if r.id is null then return null;end if;return private.billing_trial_json(r);end$$;
create function private.record_billing_mollie_trial(p_trial_id uuid,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.billing_mollie_trials;cfg private.billing_credentials;begin perform private.billing_lock();select * into strict r from private.billing_mollie_trials where id=p_trial_id for update;select * into strict cfg from private.billing_credentials where revision=r.credential_revision;
 if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>4096 or(p_result->>'customerId' is not null and p_result->>'customerId'!~'^cst_[A-Za-z0-9]{4,100}$') or(p_result->>'paymentId' is not null and p_result->>'paymentId'!~'^tr_[A-Za-z0-9]{4,100}$') or(p_result->>'checkoutUrl' is not null and p_result->>'checkoutUrl'!~'^https://(www\.)?mollie\.com/checkout/') or(r.customer_id is not null and p_result->>'customerId' is not null and r.customer_id<>p_result->>'customerId') or(r.payment_id is not null and p_result->>'paymentId' is not null and r.payment_id<>p_result->>'paymentId') then raise exception 'billing_invalid_trial_result' using errcode='22023';end if;
 update private.billing_mollie_trials set customer_id=coalesce(p_result->>'customerId',customer_id),payment_id=coalesce(p_result->>'paymentId',payment_id),checkout_url=coalesce(p_result->>'checkoutUrl',checkout_url),payment_paid=payment_paid or coalesce((p_result->>'paymentPaid')::boolean,false),callback_verified=callback_verified or coalesce((p_result->>'callbackVerified')::boolean,false),webhook_verified=webhook_verified or coalesce((p_result->>'webhookVerified')::boolean,false) where id=r.id returning * into r;
 if r.payment_paid and r.callback_verified and r.webhook_verified then
 -- This proves only the trusted route on this environment/profile, not a live charge.
 update private.billing_credentials set verification=verification||'{"callbackVerified":true,"webhookVerified":true}'::jsonb where provider='mollie' and environment=r.environment and profile_id=cfg.profile_id and verified;
 end if;return jsonb_build_object('saved',true)||private.billing_trial_json(r);end$$;

alter table private.billing_payments add column email_hash text;
alter table private.billing_withdrawals add column email_secret_id uuid;
alter table private.billing_withdrawals add column token_secret_id uuid;
create function private.request_billing_withdrawal(p_email text,p_reference text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.billing_payments;s private.billing_subscriptions;c private.billing_control;email text;eh text;token text;eid uuid;tid uuid;wid uuid;w private.billing_withdrawals;begin
 if p_request_id is null or p_email is null or char_length(p_email)>254 or p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_reference is null or char_length(p_reference)>100 then raise exception 'billing_invalid_withdrawal_request' using errcode='22023';end if;
 perform private.billing_lock();email:=lower(btrim(p_email));eh:=encode(extensions.digest(email,'sha256'),'hex');
 select p0.* into p from private.billing_payments p0 left join private.billing_subscriptions s0 on s0.id=p0.subscription_id left join auth.users u on u.id=s0.parent_id where(p0.id::text=p_reference or p0.provider_payment_id=p_reference) and coalesce(p0.email_hash,encode(extensions.digest(lower(btrim(u.email)),'sha256'),'hex'))=eh and p0.provider='mollie' and p0.created_at>=clock_timestamp()-interval '14 days' and p0.refunded_cents<p0.amount_cents;
 if p.id is null then return '{"received":true}'::jsonb;end if;
 select * into w from private.billing_withdrawals where payment_id=p.id for update;
 if w.id is not null and(w.confirmed_at is not null or w.expires_at>clock_timestamp()) then return '{"received":true}'::jsonb;end if;
 if w.id is not null then delete from vault.secrets where id in(w.email_secret_id,w.token_secret_id);update private.billing_jobs set payload=payload-'frozenEmail'-'frozenDelivery',state=case when state in ('pending','working') then 'cancelled' else state end,lease_token=null,locked_until=null where kind='send_billing_email' and payload->>'withdrawalId'=w.id::text;end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');eid:=vault.create_secret(email,'fabelpad_withdrawal_email_'||gen_random_uuid()::text,'Short lived withdrawal verification recipient');tid:=vault.create_secret(token,'fabelpad_withdrawal_token_'||gen_random_uuid()::text,'Short lived withdrawal confirmation token');
 insert into private.billing_withdrawals(payment_id,nonce_hash,email_hash,expires_at,email_secret_id,token_secret_id) values(p.id,encode(extensions.digest(token,'sha256'),'hex'),eh,clock_timestamp()+interval '24 hours',eid,tid) on conflict(payment_id) do update set nonce_hash=excluded.nonce_hash,expires_at=excluded.expires_at,email_secret_id=excluded.email_secret_id,token_secret_id=excluded.token_secret_id returning id into wid;
 select * into s from private.billing_subscriptions where id=p.subscription_id;select * into c from private.billing_control;
 perform private.billing_queue('send_billing_email',null,null,s.id,'withdrawal-verification:'||wid::text||':'||p_request_id::text,jsonb_build_object('template','withdrawal_verify','withdrawalId',wid),s.settings_revision,null,s.environment,s.mode);return '{"received":true}'::jsonb;
end$$;
create function private.confirm_billing_withdrawal(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare w private.billing_withdrawals;p private.billing_payments;s private.billing_subscriptions;r jsonb;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then raise exception 'billing_invalid_withdrawal_token' using errcode='22023';end if;
 perform private.billing_lock();select * into w from private.billing_withdrawals where nonce_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if w.id is null or w.expires_at<=clock_timestamp() then raise exception 'billing_invalid_withdrawal_token' using errcode='22023';end if;
 if w.confirmed_at is not null then return jsonb_build_object('confirmed',true,'requestId',w.id);end if;
 select * into strict p from private.billing_payments where id=w.payment_id for update;select * into strict s from private.billing_subscriptions where id=p.subscription_id;
 if w.created_at>p.created_at+interval '14 days' then raise exception 'billing_withdrawal_outside_window' using errcode='22023';end if;
 update private.billing_withdrawals set confirmed_at=clock_timestamp(),state='confirmed' where id=w.id;
 update private.billing_subscriptions set cancel_requested=true where id=s.id;
 if s.auto_renew and not s.cancel_confirmed then perform private.billing_queue('mollie_cancel','mollie',s.parent_id,s.id,'withdrawal-cancel:'||w.id::text,jsonb_build_object('subscriptionId',s.id,'reason','withdrawal'),s.settings_revision,s.credential_revision,s.environment,s.mode);end if;
 if p.refunded_cents<p.amount_cents then r:=private.request_billing_refund(p.id,w.id,p.amount_cents-p.refunded_cents,'withdrawal');end if;
 return jsonb_build_object('confirmed',true,'requestId',w.id,'queued',true);
end$$;
create function private.claim_billing_withdrawal(p_withdrawal_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare w private.billing_withdrawals;begin select * into w from private.billing_withdrawals where id=p_withdrawal_id and confirmed_at is not null for update skip locked;if w.id is null then return null;end if;update private.billing_withdrawals set state='working' where id=w.id;return jsonb_build_object('id',w.id,'paymentId',w.payment_id,'confirmedAt',w.confirmed_at);end$$;
-- Extend email context with the separate public withdrawal route. The account
-- email never becomes a browser response; its token is delivered only by email.
alter function private.get_billing_email_context(uuid,uuid) rename to billing_account_email_context;
create function private.get_billing_email_context(p_job_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;w private.billing_withdrawals;email text;token text;context jsonb;begin
 select * into j from private.billing_jobs where id=p_job_id and kind='send_billing_email' and state='working' and lease_token=p_lease_token and locked_until>=clock_timestamp() for update;if j.id is null then return null;end if;
 if j.payload->>'template'<>'withdrawal_verify' then
 -- Even a previously frozen message is not sent after account suspension.
 if not exists(select 1 from private.account_lifecycle where parent_id=j.parent_id and state='active') then return null;end if;
 return private.billing_account_email_context(p_job_id,p_lease_token);end if;
 select * into w from private.billing_withdrawals where id=(j.payload->>'withdrawalId')::uuid and confirmed_at is null and expires_at>clock_timestamp();if w.id is null then return null;end if;
 select decrypted_secret into email from vault.decrypted_secrets where id=w.email_secret_id;select decrypted_secret into token from vault.decrypted_secrets where id=w.token_secret_id;
 return jsonb_build_object('recipient',email,'subject','Bevestig je herroepingsverzoek','title','Koop ongedaan maken','paragraphs',jsonb_build_array('Bevestig je verzoek met onderstaande beveiligde link. De oorspronkelijke betaling wordt gecontroleerd; je hoeft geen account te openen.','Deze link is 24 uur geldig.'),'actionPath','/herroepen#token='||token);
end$$;

create function private.publish_billing_premium_content(p_story_id text,p_content_version text,p_metadata jsonb,p_payload jsonb,p_download_path text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();scene record;ending record;choice jsonb;expected_hash text;begin
 if p_story_id is null or p_story_id!~'^[a-z][a-z0-9_-]{1,79}$' or p_content_version is null or p_content_version!~'^[a-f0-9]{16,64}$' or jsonb_typeof(p_metadata)<>'object' or not(p_metadata?&array['title','description','image']) or(select count(*) from jsonb_object_keys(p_metadata))<>3 or octet_length(p_metadata::text)>4096 or jsonb_typeof(p_payload)<>'object' or not(p_payload?&array['metadata','parts','nameToken','scenes','endings']) or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('metadata','parts','nameToken','scenes','endings','readingLevels')) or p_payload->'metadata' is distinct from p_metadata or jsonb_typeof(p_payload->'scenes')<>'object' or not(p_payload->'scenes'?'') or octet_length(p_payload::text)>4194304 or(p_download_path is not null and(p_download_path!~'^premium/[A-Za-z0-9/_ .-]{1,200}$' or p_download_path like '%..%')) then raise exception 'billing_invalid_premium_release' using errcode='22023';end if;
 if p_payload->'parts' is distinct from '5'::jsonb or p_payload->>'nameToken' is distinct from '__FABELPAD_CHILD__' or jsonb_typeof(p_payload->'endings') is distinct from 'object' or(select count(*) from jsonb_object_keys(p_payload->'scenes'))<>31 or(select count(*) from jsonb_object_keys(p_payload->'endings'))<>32 or private.valid_content_release_reading_levels(p_payload) is distinct from true or not private.valid_snapshot_text(p_metadata->'title',200) or not private.valid_snapshot_text(p_metadata->'description',1000,true) or not private.valid_snapshot_text(p_metadata->'image',500) then raise exception 'billing_invalid_premium_release' using errcode='22023';end if;
 for scene in select * from jsonb_each(p_payload->'scenes') loop
 if scene.key!~'^[01]{0,4}$' or jsonb_typeof(scene.value)<>'object' or not(scene.value?&array['title','text','choices']) or(select count(*) from jsonb_object_keys(scene.value))<>3 or not private.valid_snapshot_text(scene.value->'title',200) or not private.valid_snapshot_text(scene.value->'text',20000) or jsonb_typeof(scene.value->'choices')<>'array' or jsonb_array_length(scene.value->'choices')<>2 then raise exception 'billing_invalid_premium_scene' using errcode='22023';end if;
 for choice in select * from jsonb_array_elements(scene.value->'choices') loop if jsonb_typeof(choice)<>'object' or not(choice?&array['label','hint','icon']) or(select count(*) from jsonb_object_keys(choice))<>3 or not private.valid_snapshot_text(choice->'label',220) or not private.valid_snapshot_text(choice->'hint',1000,true) or choice->>'icon' not in ('heart','sparkles','music','moon','leaf','compass') then raise exception 'billing_invalid_premium_choice' using errcode='22023';end if;end loop;end loop;
 for ending in select * from jsonb_each(p_payload->'endings') loop if ending.key!~'^[01]{5}$' or jsonb_typeof(ending.value)<>'object' or not(ending.value?&array['title','text','keepsake']) or(select count(*) from jsonb_object_keys(ending.value))<>3 or not private.valid_snapshot_text(ending.value->'title',200) or not private.valid_snapshot_text(ending.value->'text',20000) or not private.valid_snapshot_text(ending.value->'keepsake',200) then raise exception 'billing_invalid_premium_ending' using errcode='22023';end if;end loop;
 expected_hash:=encode(extensions.digest(private.canonical_content_json(p_payload),'sha256'),'hex');if p_content_version is distinct from substring(expected_hash from 1 for length(p_content_version)) then raise exception 'billing_content_hash_mismatch' using errcode='22023';end if;
 if exists(select 1 from private.billing_content_catalog where story_id=p_story_id and legacy_free) then raise exception 'billing_legacy_release_preserved' using errcode='22023';end if;
 insert into private.billing_content_catalog(story_id,metadata) values(p_story_id,p_metadata) on conflict(story_id) do update set metadata=excluded.metadata;
 insert into private.billing_premium_releases(story_id,content_version,payload,download_path) values(p_story_id,p_content_version,p_payload,p_download_path);
 insert into private.billing_audit(actor_id,action,details) values(actor,'premium_content_published',jsonb_build_object('storyId',p_story_id,'contentVersion',p_content_version));return jsonb_build_object('saved',true,'storyId',p_story_id,'contentVersion',p_content_version);
end$$;
create function private.billing_content_catalog_rows() returns table(story_id text,content_version text,published_at timestamptz,metadata jsonb) language sql stable security definer set search_path='' as $$
 select distinct on(r.story_id) r.story_id,r.content_version,r.published_at,r.payload->'metadata' from public.content_releases r order by r.story_id,r.published_at desc,r.content_version desc
$$;
create function private.billing_premium_catalog_rows() returns table(story_id text,content_version text,created_at timestamptz,metadata jsonb) language sql stable security definer set search_path='' as $$
 select distinct on(p.story_id) p.story_id,p.content_version,p.created_at,c.metadata from private.billing_premium_releases p join private.billing_content_catalog c on c.story_id=p.story_id where c.available order by p.story_id,p.created_at desc,p.content_version desc
$$;
-- Preserve the existing catalog signature, while transferring metadata only.
create or replace function public.get_content_catalog() returns table(story_id text,content_version text,published_at timestamptz,metadata jsonb) language sql stable security invoker set search_path='' as $$
 select * from private.billing_content_catalog_rows() union all select story_id,content_version,created_at,metadata from private.billing_premium_catalog_rows()
$$;
create function private.get_billing_content_release(p_story_id text,p_content_version text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;version text;published timestamptz;actor uuid;ent jsonb;full_access boolean;preview_access boolean:=false;levels jsonb;begin
 select p.payload,p.content_version,p.created_at into payload,version,published from private.billing_premium_releases p where p.story_id=p_story_id and(p_content_version is null or p.content_version=p_content_version) order by p.created_at desc,p.content_version desc limit 1;
 if payload is null then select r.payload,r.content_version,r.published_at into payload,version,published from public.content_releases r where r.story_id=p_story_id and(p_content_version is null or r.content_version=p_content_version) order by r.published_at desc,r.content_version desc limit 1;end if;
 if payload is null then return null;end if;
 full_access:=not(select payment_required from private.billing_control);
 if auth.uid() is not null then
 begin actor:=private.billing_parent();exception when insufficient_privilege then actor:=null;end;
 if actor is not null then
 ent:=private.billing_entitlement_for(actor);full_access:=full_access or(ent->>'fullLibrary')::boolean or ent#>>'{preview,fullStoryId}'=p_story_id or private.is_confirmed_email_admin(actor);
 preview_access:=exists(select 1 from jsonb_array_elements_text(ent#>'{preview,chapterOneStoryIds}') x where x=p_story_id);
 end if;end if;
 if full_access then return jsonb_build_object('story_id',p_story_id,'content_version',version,'published_at',published,'payload',payload,'access','full');end if;
 if preview_access then
 if jsonb_typeof(payload->'readingLevels')='object' then select jsonb_object_agg(k,jsonb_build_object('scenes',jsonb_build_object('',v#>array['scenes','']),'endings','{}'::jsonb)) into levels from jsonb_each(payload->'readingLevels') t(k,v);end if;
 payload:=(payload-'scenes'-'endings'-'readingLevels')||jsonb_build_object('parts',1,'scenes',jsonb_build_object('',payload#>array['scenes','']),'endings','{}'::jsonb)||case when levels is null then '{}'::jsonb else jsonb_build_object('readingLevels',levels) end;
 return jsonb_build_object('story_id',p_story_id,'content_version',version,'published_at',published,'payload',payload,'access','preview');end if;
 return jsonb_build_object('story_id',p_story_id,'content_version',version,'published_at',published,'payload',null,'access','locked');
end$$;
-- Data API reads cannot bypass the content gate by selecting full rows.
drop policy releases_public_read on public.content_releases;
create policy releases_admin_read on public.content_releases for select to authenticated using(exists(select 1 from public.content_admins a where a.user_id=(select auth.uid())));
revoke select on public.content_releases from anon;

-- Published private content is immutable, matching historical release behavior.
create function private.billing_premium_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'billing_published_content_immutable' using errcode='42501';end$$;
create trigger billing_premium_immutable before update or delete on private.billing_premium_releases for each row execute function private.billing_premium_immutable();



-- Existing profiles, DOB wrapper, route memories and consent are retained.
create or replace function private.valid_family_snapshot_before_birth_dates(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
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
    if (select count(*) from jsonb_object_keys(entry.value) as kk(key) where left(kk.key,6)='story-')>100 then return false;end if;
    if not (entry.key = any(ids)) or jsonb_typeof(entry.value) <> 'object' then return false; end if;
    for field in select * from jsonb_each(entry.value) loop
      if field.key in ('favorites','started') then
        if jsonb_typeof(field.value) <> 'array' or jsonb_array_length(field.value) > 100 then return false; end if;
        if exists (select 1 from jsonb_array_elements(field.value) v where jsonb_typeof(v) <> 'string' or not (v#>>'{}' ~ '^[a-z][a-z0-9_-]{1,79}$')) then return false; end if;
        if (select count(distinct v) from jsonb_array_elements(field.value) v) <> jsonb_array_length(field.value) then return false; end if;
      elsif left(field.key,6) = 'story-' and substring(field.key from 7) ~ '^[a-z][a-z0-9_-]{1,79}$' then
        if jsonb_typeof(field.value) <> 'object' or not (field.value ?& array['picks','updatedAt']) then return false; end if;
        if exists (select 1 from jsonb_object_keys(field.value) key where key not in ('picks','updatedAt','storyId','contentVersion','revision','lastCompletedPicks','lastCompletedContentVersion')) then return false; end if;
        if jsonb_typeof(field.value->'picks') <> 'array' or jsonb_array_length(field.value->'picks') > 5 then return false; end if;
        if exists (select 1 from jsonb_array_elements(field.value->'picks') v where v not in ('0'::jsonb,'1'::jsonb)) then return false; end if;
        if jsonb_typeof(field.value->'updatedAt') is distinct from 'number' or field.value->>'updatedAt' !~ '^[0-9]+$' or (field.value->>'updatedAt')::numeric > 9007199254740991 then return false; end if;
        if field.value ? 'storyId' and (jsonb_typeof(field.value->'storyId') is distinct from 'string' or field.value->>'storyId' is distinct from substring(field.key from 7)) then return false; end if;
        if field.value ? 'contentVersion' and (jsonb_typeof(field.value->'contentVersion') is distinct from 'string' or field.value->>'contentVersion' !~ '^[a-f0-9]{16,64}$') then return false; end if;
        if field.value ? 'revision' and (jsonb_typeof(field.value->'revision') is distinct from 'number' or field.value->>'revision' !~ '^[0-9]+$' or (field.value->>'revision')::numeric > 9007199254740991) then return false; end if;
        if field.value ? 'lastCompletedPicks' then
          if jsonb_typeof(field.value->'lastCompletedPicks') is distinct from 'array' or jsonb_array_length(field.value->'lastCompletedPicks') <> 5 then return false; end if;
          if exists(select 1 from jsonb_array_elements(field.value->'lastCompletedPicks') v where v not in ('0'::jsonb,'1'::jsonb)) then return false; end if;
        end if;
        if field.value ? 'lastCompletedContentVersion' and (not (field.value ? 'lastCompletedPicks') or jsonb_typeof(field.value->'lastCompletedContentVersion') is distinct from 'string' or field.value->>'lastCompletedContentVersion' !~ '^[a-f0-9]{16,64}$') then return false; end if;
      elsif field.key = 'prefs' then
        if jsonb_typeof(field.value) <> 'object' or jsonb_typeof(field.value->'muted') is distinct from 'boolean' or jsonb_typeof(field.value->'calm') is distinct from 'boolean' then return false; end if;
        if exists (select 1 from jsonb_object_keys(field.value) key where key not in ('muted','calm','textSize','readingLevel')) then return false; end if;
        if field.value ? 'textSize' and (jsonb_typeof(field.value->'textSize') is distinct from 'string' or field.value->>'textSize' not in ('normal','large')) then return false; end if;
        if field.value ? 'readingLevel' and (jsonb_typeof(field.value->'readingLevel') is distinct from 'string' or field.value->>'readingLevel' not in ('under6','6to8','9plus')) then return false; end if;
      elsif field.key = 'completed' then
        if jsonb_typeof(field.value) <> 'object' or(select count(*) from jsonb_object_keys(field.value))>100 then return false; end if;
        if exists (select 1 from jsonb_each(field.value) e where not (e.key ~ '^[a-z][a-z0-9_-]{1,79}$') or jsonb_typeof(e.value) is distinct from 'object' or not (e.value ?& array['ending','date']) or (select count(*) from jsonb_object_keys(e.value)) <> 2 or not private.valid_snapshot_text(e.value->'ending',160) or not private.valid_snapshot_date(e.value->'date')) then return false; end if;
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



create or replace function private.valid_family_memory(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
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
        or not private.valid_snapshot_text(item->'id',160) or item->>'id' = any(ids) or not coalesce(item->>'worldId' ~ '^[a-z][a-z0-9_-]{1,79}$',false) then return false; end if;
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


create function private.freeze_billing_email(p_job_id uuid,p_lease_token uuid,p_delivery jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.billing_jobs;begin
 select * into j from private.billing_jobs where id=p_job_id and kind='send_billing_email' and state='working' and lease_token=p_lease_token and locked_until>=clock_timestamp() for update;
 if j.id is null then return null;end if;
 if private.get_billing_email_context(p_job_id,p_lease_token) is null then return null;end if;
 if j.payload->'frozenDelivery' is not null then return j.payload->'frozenDelivery';end if;
 if jsonb_typeof(p_delivery)<>'object' or octet_length(p_delivery::text)>307200 then raise exception 'billing_invalid_email_delivery' using errcode='22023';end if;
 update private.billing_jobs set payload=payload||jsonb_build_object('frozenDelivery',p_delivery) where id=j.id;return p_delivery;
end$$;



create function private.reserve_billing_play_trial(p_period text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();c private.billing_control;cfg private.billing_credentials;r private.billing_purchase_reservations;q jsonb;begin
 if private.billing_environment()<>'staging' then raise exception 'billing_staging_trial_only' using errcode='42501';end if;
 perform private.billing_lock();select * into c from private.billing_control;
 if p_request_id is null or p_period not in ('month','year') then raise exception 'billing_invalid_request' using errcode='22023';end if;
 select * into r from private.billing_purchase_reservations where parent_id=actor and request_id=p_request_id;if r.id is not null then if not r.admin_trial then raise exception 'billing_idempotency_conflict' using errcode='22023';end if;return private.billing_reservation_json(r);end if;
 if exists(select 1 from private.billing_purchase_reservations where parent_id=actor and status in ('reserved','provider_pending') and expires_at>private.lifecycle_now()) then raise exception 'billing_purchase_already_reserved' using errcode='55000';end if;
 select * into cfg from private.billing_credentials where provider='play' and environment='staging' and mode='test' and verified and active and verification->>'productsVerified'='true';if cfg.revision is null then raise exception 'billing_trial_products_unverified' using errcode='55000';end if;
 q:=private.billing_quote(actor,p_period,null);
 insert into private.billing_purchase_reservations(parent_id,parent_digest,request_id,provider,period,environment,mode,amount_cents,base_amount_cents,settings_revision,credential_revision,offer_version,terms_version,quote,idempotency_key,obfuscated_account_id,expires_at,admin_trial) values(actor,encode(extensions.digest(actor::text,'sha256'),'hex'),p_request_id,'play',p_period,'staging','test',(q->>'amountCents')::integer,(q->>'baseAmountCents')::integer,c.revision,cfg.revision,c.settings->>'offerVersion',c.settings->>'termsVersion',q,'play-trial:'||actor::text||':'||p_request_id::text,encode(extensions.digest('fabelpad:'||actor::text,'sha256'),'hex'),private.lifecycle_now()+interval '30 minutes',true) returning * into r;return private.billing_reservation_json(r);
end$$;














revoke all on function private.billing_environment() from public,anon,authenticated,service_role;
revoke all on function private.configure_billing_environment(text) from public,anon,authenticated,service_role;
revoke all on function private.billing_defaults() from public,anon,authenticated,service_role;
revoke all on function private.billing_lock() from public,anon,authenticated,service_role;
revoke all on function private.billing_admin(boolean) from public,anon,authenticated,service_role;
revoke all on function private.authorize_billing_admin(boolean) from public,anon,authenticated,service_role;
revoke all on function private.billing_parent() from public,anon,authenticated,service_role;
revoke all on function private.billing_bump(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.billing_effective() from public,anon,authenticated,service_role;
revoke all on function private.billing_snapshot() from public,anon,authenticated,service_role;
revoke all on function private.get_billing_settings() from public,anon,authenticated,service_role;
revoke all on function private.billing_valid_settings(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.save_billing_settings(bigint,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.billing_phaseout_impact() from public,anon,authenticated,service_role;
revoke all on function private.billing_queue(text,text,uuid,uuid,text,jsonb,bigint,bigint,text,text) from public,anon,authenticated,service_role;
revoke all on function private.set_billing_gate(bigint,text,boolean,boolean) from public,anon,authenticated,service_role;
revoke all on function private.save_billing_credential(bigint,text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_provider_config(text,text,bigint) from public,anon,authenticated,service_role;
revoke all on function private.record_billing_provider_test(bigint,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.delete_billing_credential(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function private.billing_onboarding_completed() from public,anon,authenticated,service_role;
revoke all on function private.billing_preview(uuid) from public,anon,authenticated,service_role;
revoke all on function private.billing_entitlement_for(uuid) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_entitlement() from public,anon,authenticated,service_role;
revoke all on function private.choose_billing_free_story(text) from public,anon,authenticated,service_role;
revoke all on function private.save_billing_coupon_batch(bigint,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.set_billing_coupon_enabled(bigint,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function private.list_billing_coupons() from public,anon,authenticated,service_role;
revoke all on function private.billing_quote(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function private.quote_billing_purchase(text,text) from public,anon,authenticated,service_role;
revoke all on function private.billing_reservation_json(private.billing_purchase_reservations) from public,anon,authenticated,service_role;
revoke all on function private.reserve_billing_purchase(text,text,uuid,bigint,integer,text,boolean,text) from public,anon,authenticated,service_role;
revoke all on function private.recheck_billing_purchase(uuid) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_purchase(uuid) from public,anon,authenticated,service_role;
revoke all on function private.claim_billing_jobs(integer) from public,anon,authenticated,service_role;
revoke all on function private.complete_billing_job(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.fail_billing_job(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
revoke all on function private.record_billing_provider_event(text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_play_binding(text,text) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_play_reservation(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.apply_billing_provider_evidence(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.billing_mollie_context(private.billing_purchase_reservations,private.billing_subscriptions,private.billing_jobs,text) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_mollie_binding(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_mollie_job_context(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.record_billing_mollie_customer(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function private.recheck_billing_renewal(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.cancel_billing_subscription(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.list_billing_subscriptions() from public,anon,authenticated,service_role;
revoke all on function private.list_billing_operations() from public,anon,authenticated,service_role;
revoke all on function private.request_billing_refund(uuid,uuid,integer,text) from public,anon,authenticated,service_role;
revoke all on function private.billing_account_stopped() from public,anon,authenticated,service_role;
revoke all on function private.prepare_billing_jobs() from public,anon,authenticated,service_role;
revoke all on function private.get_billing_email_context(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_public_offer() from public,anon,authenticated,service_role;
revoke all on function private.billing_trial_json(private.billing_mollie_trials) from public,anon,authenticated,service_role;
revoke all on function private.prepare_billing_mollie_trial(bigint,uuid) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_mollie_trial(uuid,text) from public,anon,authenticated,service_role;
revoke all on function private.record_billing_mollie_trial(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.request_billing_withdrawal(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.confirm_billing_withdrawal(text) from public,anon,authenticated,service_role;
revoke all on function private.claim_billing_withdrawal(uuid) from public,anon,authenticated,service_role;
revoke all on function private.get_billing_email_context(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.publish_billing_premium_content(text,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function private.billing_content_catalog_rows() from public,anon,authenticated,service_role;
revoke all on function private.billing_premium_catalog_rows() from public,anon,authenticated,service_role;
revoke all on function private.get_billing_content_release(text,text) from public,anon,authenticated,service_role;
revoke all on function private.billing_premium_immutable() from public,anon,authenticated,service_role;
revoke all on function private.valid_family_snapshot_before_birth_dates(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.valid_family_memory(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.freeze_billing_email(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.reserve_billing_play_trial(text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.billing_account_email_context(uuid,uuid) from public,anon,authenticated,service_role;
-- BEGIN BILLING EXPOSED WRAPPERS
grant usage on schema private to service_role;
grant execute on function private.authorize_billing_admin(boolean) to authenticated;
create function public.authorize_billing_admin(p_fresh boolean default true) returns jsonb language sql security invoker set search_path='' as $$ select private.authorize_billing_admin(p_fresh) $$;
revoke all on function public.authorize_billing_admin(boolean) from public,anon,authenticated,service_role;
grant execute on function public.authorize_billing_admin(boolean) to authenticated;
grant execute on function private.get_billing_settings() to authenticated;
create function public.get_billing_settings() returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_settings() $$;
revoke all on function public.get_billing_settings() from public,anon,authenticated,service_role;
grant execute on function public.get_billing_settings() to authenticated;
grant execute on function private.save_billing_settings(bigint,jsonb) to authenticated;
create function public.save_billing_settings(p_expected_revision bigint,p_settings jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_billing_settings(p_expected_revision,p_settings) $$;
revoke all on function public.save_billing_settings(bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_billing_settings(bigint,jsonb) to authenticated;
grant execute on function private.set_billing_gate(bigint,text,boolean,boolean) to authenticated;
create function public.set_billing_gate(p_expected_revision bigint,p_gate text,p_enabled boolean,p_confirm_phaseout boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.set_billing_gate(p_expected_revision,p_gate,p_enabled,p_confirm_phaseout) $$;
revoke all on function public.set_billing_gate(bigint,text,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.set_billing_gate(bigint,text,boolean,boolean) to authenticated;
grant execute on function private.billing_phaseout_impact() to authenticated;
create function public.billing_phaseout_impact() returns jsonb language sql security invoker set search_path='' as $$ select private.billing_phaseout_impact() $$;
revoke all on function public.billing_phaseout_impact() from public,anon,authenticated,service_role;
grant execute on function public.billing_phaseout_impact() to authenticated;
grant execute on function private.save_billing_credential(bigint,text,text,text) to authenticated;
create function public.save_billing_credential(p_expected_revision bigint,p_provider text,p_mode text,p_secret text) returns jsonb language sql security invoker set search_path='' as $$ select private.save_billing_credential(p_expected_revision,p_provider,p_mode,p_secret) $$;
revoke all on function public.save_billing_credential(bigint,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.save_billing_credential(bigint,text,text,text) to authenticated;
grant execute on function private.delete_billing_credential(bigint,bigint) to authenticated;
create function public.delete_billing_credential(p_expected_revision bigint,p_credential_revision bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.delete_billing_credential(p_expected_revision,p_credential_revision) $$;
revoke all on function public.delete_billing_credential(bigint,bigint) from public,anon,authenticated,service_role;
grant execute on function public.delete_billing_credential(bigint,bigint) to authenticated;
grant execute on function private.get_billing_entitlement() to authenticated;
create function public.get_billing_entitlement() returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_entitlement() $$;
revoke all on function public.get_billing_entitlement() from public,anon,authenticated,service_role;
grant execute on function public.get_billing_entitlement() to authenticated;
grant execute on function private.choose_billing_free_story(text) to authenticated;
create function public.choose_billing_free_story(p_story_id text) returns jsonb language sql security invoker set search_path='' as $$ select private.choose_billing_free_story(p_story_id) $$;
revoke all on function public.choose_billing_free_story(text) from public,anon,authenticated,service_role;
grant execute on function public.choose_billing_free_story(text) to authenticated;
grant execute on function private.quote_billing_purchase(text,text) to authenticated;
create function public.quote_billing_purchase(p_period text,p_coupon_code text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.quote_billing_purchase(p_period,p_coupon_code) $$;
revoke all on function public.quote_billing_purchase(text,text) from public,anon,authenticated,service_role;
grant execute on function public.quote_billing_purchase(text,text) to authenticated;
grant execute on function private.reserve_billing_purchase(text,text,uuid,bigint,integer,text,boolean,text) to authenticated;
create function public.reserve_billing_purchase(p_provider text,p_period text,p_request_id uuid,p_expected_revision bigint,p_expected_amount_cents integer,p_terms_version text,p_accept_recurring boolean,p_coupon_code text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.reserve_billing_purchase(p_provider,p_period,p_request_id,p_expected_revision,p_expected_amount_cents,p_terms_version,p_accept_recurring,p_coupon_code) $$;
revoke all on function public.reserve_billing_purchase(text,text,uuid,bigint,integer,text,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.reserve_billing_purchase(text,text,uuid,bigint,integer,text,boolean,text) to authenticated;
grant execute on function private.get_billing_purchase(uuid) to authenticated;
create function public.get_billing_purchase(p_reservation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_purchase(p_reservation_id) $$;
revoke all on function public.get_billing_purchase(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_purchase(uuid) to authenticated;
grant execute on function private.cancel_billing_subscription(uuid,uuid) to authenticated;
create function public.cancel_billing_subscription(p_subscription_id uuid,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_billing_subscription(p_subscription_id,p_request_id) $$;
revoke all on function public.cancel_billing_subscription(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_billing_subscription(uuid,uuid) to authenticated;
grant execute on function private.save_billing_coupon_batch(bigint,jsonb) to authenticated;
create function public.save_billing_coupon_batch(p_expected_revision bigint,p_coupon jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_billing_coupon_batch(p_expected_revision,p_coupon) $$;
revoke all on function public.save_billing_coupon_batch(bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_billing_coupon_batch(bigint,jsonb) to authenticated;
grant execute on function private.set_billing_coupon_enabled(bigint,uuid,boolean) to authenticated;
create function public.set_billing_coupon_enabled(p_expected_revision bigint,p_batch_id uuid,p_enabled boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.set_billing_coupon_enabled(p_expected_revision,p_batch_id,p_enabled) $$;
revoke all on function public.set_billing_coupon_enabled(bigint,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.set_billing_coupon_enabled(bigint,uuid,boolean) to authenticated;
grant execute on function private.list_billing_coupons() to authenticated;
create function public.list_billing_coupons() returns jsonb language sql security invoker set search_path='' as $$ select private.list_billing_coupons() $$;
revoke all on function public.list_billing_coupons() from public,anon,authenticated,service_role;
grant execute on function public.list_billing_coupons() to authenticated;
grant execute on function private.list_billing_subscriptions() to authenticated;
create function public.list_billing_subscriptions() returns jsonb language sql security invoker set search_path='' as $$ select private.list_billing_subscriptions() $$;
revoke all on function public.list_billing_subscriptions() from public,anon,authenticated,service_role;
grant execute on function public.list_billing_subscriptions() to authenticated;
grant execute on function private.list_billing_operations() to authenticated;
create function public.list_billing_operations() returns jsonb language sql security invoker set search_path='' as $$ select private.list_billing_operations() $$;
revoke all on function public.list_billing_operations() from public,anon,authenticated,service_role;
grant execute on function public.list_billing_operations() to authenticated;
grant execute on function private.prepare_billing_mollie_trial(bigint,uuid) to authenticated;
create function public.prepare_billing_mollie_trial(p_credential_revision bigint,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.prepare_billing_mollie_trial(p_credential_revision,p_request_id) $$;
revoke all on function public.prepare_billing_mollie_trial(bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_billing_mollie_trial(bigint,uuid) to authenticated;
grant execute on function private.reserve_billing_play_trial(text,uuid) to authenticated;
create function public.reserve_billing_play_trial(p_period text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.reserve_billing_play_trial(p_period,p_request_id) $$;
revoke all on function public.reserve_billing_play_trial(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.reserve_billing_play_trial(text,uuid) to authenticated;
grant execute on function private.publish_billing_premium_content(text,text,jsonb,jsonb,text) to authenticated;
create function public.publish_billing_premium_content(p_story_id text,p_content_version text,p_metadata jsonb,p_payload jsonb,p_download_path text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.publish_billing_premium_content(p_story_id,p_content_version,p_metadata,p_payload,p_download_path) $$;
revoke all on function public.publish_billing_premium_content(text,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.publish_billing_premium_content(text,text,jsonb,jsonb,text) to authenticated;
grant execute on function private.get_billing_public_offer() to anon,authenticated,service_role;
create function public.get_billing_public_offer() returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_public_offer() $$;
revoke all on function public.get_billing_public_offer() from public,anon,authenticated,service_role;
grant execute on function public.get_billing_public_offer() to anon,authenticated,service_role;
grant execute on function private.get_billing_content_release(text,text) to anon,authenticated,service_role;
create function public.get_billing_content_release(p_story_id text,p_content_version text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_content_release(p_story_id,p_content_version) $$;
revoke all on function public.get_billing_content_release(text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_content_release(text,text) to anon,authenticated,service_role;
grant execute on function private.request_billing_withdrawal(text,text,uuid) to anon,authenticated,service_role;
create function public.request_billing_withdrawal(p_email text,p_reference text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.request_billing_withdrawal(p_email,p_reference,p_request_id) $$;
revoke all on function public.request_billing_withdrawal(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.request_billing_withdrawal(text,text,uuid) to anon,authenticated,service_role;
grant execute on function private.confirm_billing_withdrawal(text) to anon,authenticated,service_role;
create function public.confirm_billing_withdrawal(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.confirm_billing_withdrawal(p_token) $$;
revoke all on function public.confirm_billing_withdrawal(text) from public,anon,authenticated,service_role;
grant execute on function public.confirm_billing_withdrawal(text) to anon,authenticated,service_role;
grant execute on function private.get_billing_provider_config(text,text,bigint) to service_role;
create function public.get_billing_provider_config(p_provider text,p_mode text,p_credential_revision bigint default null) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_provider_config(p_provider,p_mode,p_credential_revision) $$;
revoke all on function public.get_billing_provider_config(text,text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_provider_config(text,text,bigint) to service_role;
grant execute on function private.record_billing_provider_test(bigint,jsonb) to service_role;
create function public.record_billing_provider_test(p_credential_revision bigint,p_result jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.record_billing_provider_test(p_credential_revision,p_result) $$;
revoke all on function public.record_billing_provider_test(bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_billing_provider_test(bigint,jsonb) to service_role;
grant execute on function private.claim_billing_jobs(integer) to service_role;
create function public.claim_billing_jobs(p_limit integer default 20) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_billing_jobs(p_limit) $$;
revoke all on function public.claim_billing_jobs(integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_billing_jobs(integer) to service_role;
grant execute on function private.complete_billing_job(uuid,uuid,jsonb) to service_role;
create function public.complete_billing_job(p_job_id uuid,p_lease_token uuid,p_result jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.complete_billing_job(p_job_id,p_lease_token,p_result) $$;
revoke all on function public.complete_billing_job(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.complete_billing_job(uuid,uuid,jsonb) to service_role;
grant execute on function private.fail_billing_job(uuid,uuid,text,boolean) to service_role;
create function public.fail_billing_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_uncertain boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.fail_billing_job(p_job_id,p_lease_token,p_error_code,p_uncertain) $$;
revoke all on function public.fail_billing_job(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.fail_billing_job(uuid,uuid,text,boolean) to service_role;
grant execute on function private.record_billing_provider_event(text,text,jsonb) to service_role;
create function public.record_billing_provider_event(p_provider text,p_event_id text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.record_billing_provider_event(p_provider,p_event_id,p_payload) $$;
revoke all on function public.record_billing_provider_event(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_billing_provider_event(text,text,jsonb) to service_role;
grant execute on function private.apply_billing_provider_evidence(jsonb) to service_role;
create function public.apply_billing_provider_evidence(p_evidence jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.apply_billing_provider_evidence(p_evidence) $$;
revoke all on function public.apply_billing_provider_evidence(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.apply_billing_provider_evidence(jsonb) to service_role;
grant execute on function private.recheck_billing_purchase(uuid) to service_role;
create function public.recheck_billing_purchase(p_reservation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.recheck_billing_purchase(p_reservation_id) $$;
revoke all on function public.recheck_billing_purchase(uuid) from public,anon,authenticated,service_role;
grant execute on function public.recheck_billing_purchase(uuid) to service_role;
grant execute on function private.prepare_billing_jobs() to service_role;
create function public.prepare_billing_jobs() returns jsonb language sql security invoker set search_path='' as $$ select private.prepare_billing_jobs() $$;
revoke all on function public.prepare_billing_jobs() from public,anon,authenticated,service_role;
grant execute on function public.prepare_billing_jobs() to service_role;
grant execute on function private.request_billing_refund(uuid,uuid,integer,text) to service_role;
create function public.request_billing_refund(p_payment_id uuid,p_request_id uuid,p_amount_cents integer,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select private.request_billing_refund(p_payment_id,p_request_id,p_amount_cents,p_reason) $$;
revoke all on function public.request_billing_refund(uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.request_billing_refund(uuid,uuid,integer,text) to service_role;
grant execute on function private.get_billing_play_binding(text,text) to service_role;
create function public.get_billing_play_binding(p_purchase_token_hash text,p_obfuscated_account_id text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_play_binding(p_purchase_token_hash,p_obfuscated_account_id) $$;
revoke all on function public.get_billing_play_binding(text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_play_binding(text,text) to service_role;
grant execute on function private.get_billing_play_reservation(uuid,uuid) to service_role;
create function public.get_billing_play_reservation(p_reservation_id uuid,p_parent_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_play_reservation(p_reservation_id,p_parent_id) $$;
revoke all on function public.get_billing_play_reservation(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_play_reservation(uuid,uuid) to service_role;
grant execute on function private.get_billing_mollie_binding(text,text,uuid) to service_role;
create function public.get_billing_mollie_binding(p_payment_id text,p_provider_subscription_id text default null,p_reservation_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_mollie_binding(p_payment_id,p_provider_subscription_id,p_reservation_id) $$;
revoke all on function public.get_billing_mollie_binding(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_mollie_binding(text,text,uuid) to service_role;
grant execute on function private.get_billing_mollie_job_context(uuid,uuid) to service_role;
create function public.get_billing_mollie_job_context(p_job_id uuid,p_lease_token uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_mollie_job_context(p_job_id,p_lease_token) $$;
revoke all on function public.get_billing_mollie_job_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_mollie_job_context(uuid,uuid) to service_role;
grant execute on function private.record_billing_mollie_customer(uuid,uuid,text) to service_role;
create function public.record_billing_mollie_customer(p_job_id uuid,p_lease_token uuid,p_customer_id text) returns boolean language sql security invoker set search_path='' as $$ select private.record_billing_mollie_customer(p_job_id,p_lease_token,p_customer_id) $$;
revoke all on function public.record_billing_mollie_customer(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.record_billing_mollie_customer(uuid,uuid,text) to service_role;
grant execute on function private.recheck_billing_renewal(uuid,uuid) to service_role;
create function public.recheck_billing_renewal(p_job_id uuid,p_lease_token uuid) returns boolean language sql security invoker set search_path='' as $$ select private.recheck_billing_renewal(p_job_id,p_lease_token) $$;
revoke all on function public.recheck_billing_renewal(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.recheck_billing_renewal(uuid,uuid) to service_role;
grant execute on function private.get_billing_email_context(uuid,uuid) to service_role;
create function public.get_billing_email_context(p_job_id uuid,p_lease_token uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_email_context(p_job_id,p_lease_token) $$;
revoke all on function public.get_billing_email_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_email_context(uuid,uuid) to service_role;
grant execute on function private.freeze_billing_email(uuid,uuid,jsonb) to service_role;
create function public.freeze_billing_email(p_job_id uuid,p_lease_token uuid,p_delivery jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.freeze_billing_email(p_job_id,p_lease_token,p_delivery) $$;
revoke all on function public.freeze_billing_email(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.freeze_billing_email(uuid,uuid,jsonb) to service_role;
grant execute on function private.get_billing_mollie_trial(uuid,text) to service_role;
create function public.get_billing_mollie_trial(p_trial_id uuid default null,p_payment_id text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.get_billing_mollie_trial(p_trial_id,p_payment_id) $$;
revoke all on function public.get_billing_mollie_trial(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_billing_mollie_trial(uuid,text) to service_role;
grant execute on function private.record_billing_mollie_trial(uuid,jsonb) to service_role;
create function public.record_billing_mollie_trial(p_trial_id uuid,p_result jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.record_billing_mollie_trial(p_trial_id,p_result) $$;
revoke all on function public.record_billing_mollie_trial(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_billing_mollie_trial(uuid,jsonb) to service_role;
grant execute on function private.claim_billing_withdrawal(uuid) to service_role;
create function public.claim_billing_withdrawal(p_withdrawal_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_billing_withdrawal(p_withdrawal_id) $$;
revoke all on function public.claim_billing_withdrawal(uuid) from public,anon,authenticated,service_role;
grant execute on function public.claim_billing_withdrawal(uuid) to service_role;
grant execute on function private.billing_content_catalog_rows() to anon,authenticated;
grant execute on function private.billing_premium_catalog_rows() to anon,authenticated;
