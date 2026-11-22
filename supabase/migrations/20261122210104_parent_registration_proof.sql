-- Pre-auth declarations are short-lived server records. The browser receives
-- only a random capability; no metadata claim or unsigned consent is trusted.
create table private.parent_registration_proofs (
 nonce_hash text primary key check(nonce_hash ~ '^[a-f0-9]{64}$'),
 channel text not null check(channel in ('otp','google')),
 email_hash text check(email_hash ~ '^[a-f0-9]{64}$'),
 terms_version text not null, privacy_version text not null,
 parent_declaration boolean not null check(parent_declaration),
 accept_terms boolean not null check(accept_terms),
 declared_at timestamptz not null, expires_at timestamptz not null,
 consumed_at timestamptz, consumed_parent_hash text check(consumed_parent_hash ~ '^[a-f0-9]{64}$'),
 check((channel='otp' and email_hash is not null) or (channel='google' and email_hash is null)),
 check(expires_at=declared_at+interval '30 minutes'),
 check((consumed_at is null)=(consumed_parent_hash is null))
);
alter table private.parent_registration_proofs enable row level security;
revoke all on private.parent_registration_proofs from public,anon,authenticated,service_role;
create index parent_registration_proofs_expiry_idx on private.parent_registration_proofs(expires_at);
create index parent_registration_proofs_email_idx on private.parent_registration_proofs(email_hash,declared_at) where email_hash is not null;
alter table private.parent_acceptances add column registration_declared_at timestamptz;
comment on column private.parent_acceptances.registration_declared_at is 'Actual pre-auth declaration time for the new registration route; NULL for earlier/manual acceptances, never backfilled.';

create function private.cleanup_parent_registrations() returns void
language sql security definer set search_path='' set timezone='UTC' as $$
 delete from private.parent_registration_proofs where expires_at<=private.lifecycle_now()
$$;
revoke all on function private.cleanup_parent_registrations() from public,anon,authenticated,service_role;

-- Intentionally callable before authentication. This stores only bounded,
-- expiring hashes and declarations, and grants no access to any account.
create function private.begin_parent_registration(p_nonce_hash text,p_channel text,p_email_hash text,p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare t timestamptz; existing private.parent_registration_proofs;
begin
 if p_nonce_hash is null or p_nonce_hash!~'^[a-f0-9]{64}$' or p_channel is null or p_channel not in ('otp','google')
 or (p_channel='otp' and (p_email_hash is null or p_email_hash!~'^[a-f0-9]{64}$'))
 or (p_channel='google' and p_email_hash is not null)
 or p_parent_declaration is distinct from true or p_accept_terms is distinct from true then raise exception 'Invalid registration declaration' using errcode='22023'; end if;
 if p_terms_version is distinct from '2026-11-22' or p_privacy_version is distinct from '2026-11-22.1' then raise exception 'document_version_changed' using errcode='22023'; end if;
 -- Serialize admissions so concurrent anonymous requests cannot exceed caps.
 perform pg_advisory_xact_lock(726114922098231);
 perform private.cleanup_parent_registrations();
 t:=private.lifecycle_now();
 select * into existing from private.parent_registration_proofs where nonce_hash=p_nonce_hash;
 if found then
  if existing.channel<>p_channel or existing.email_hash is distinct from p_email_hash or existing.terms_version<>p_terms_version or existing.privacy_version<>p_privacy_version then raise exception 'Invalid registration declaration' using errcode='22023'; end if;
  return jsonb_build_object('expiresAt',existing.expires_at);
 end if;
 if (select count(*) from private.parent_registration_proofs)>=1000
 or (select count(*) from private.parent_registration_proofs where declared_at>t-interval '1 minute')>=100
 or (p_email_hash is not null and (select count(*) from private.parent_registration_proofs where email_hash=p_email_hash)>=5)
 then raise exception 'registration_rate_limited' using errcode='P0001'; end if;
 insert into private.parent_registration_proofs(nonce_hash,channel,email_hash,terms_version,privacy_version,parent_declaration,accept_terms,declared_at,expires_at)
 values(p_nonce_hash,p_channel,p_email_hash,p_terms_version,p_privacy_version,true,true,t,t+interval '30 minutes');
 return jsonb_build_object('expiresAt',t+interval '30 minutes');
end $$;
revoke all on function private.begin_parent_registration(text,text,text,text,text,boolean,boolean) from public,anon,authenticated,service_role;
grant usage on schema private to anon;
grant execute on function private.begin_parent_registration(text,text,text,text,text,boolean,boolean) to anon,authenticated;
create function public.begin_parent_registration(p_nonce_hash text,p_channel text,p_email_hash text,p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean)
returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$
 select private.begin_parent_registration(p_nonce_hash,p_channel,p_email_hash,p_terms_version,p_privacy_version,p_parent_declaration,p_accept_terms)
$$;
revoke all on function public.begin_parent_registration(text,text,text,text,text,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.begin_parent_registration(text,text,text,text,text,boolean,boolean) to anon,authenticated;

create function private.complete_parent_registration(p_nonce_hash text,p_channel text) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.require_fresh_parent(); proof private.parent_registration_proofs; l private.account_lifecycle;
 t timestamptz; actor_hash text; expected_email_hash text; verified_at timestamptz; result jsonb; had_acceptance boolean;
begin
 if p_nonce_hash is null or p_nonce_hash!~'^[a-f0-9]{64}$' or p_channel is null or p_channel not in ('otp','google') then raise exception 'Invalid registration proof' using errcode='22023'; end if;
 select * into strict l from private.account_lifecycle where parent_id=actor for update;
 if l.state in ('deletion_pending','deleting') then return jsonb_build_object('completed',false); end if;
 select * into proof from private.parent_registration_proofs where nonce_hash=p_nonce_hash for update;
 t:=private.lifecycle_now();
 if not found or proof.expires_at<=t or proof.channel<>p_channel then return jsonb_build_object('completed',false); end if;
 actor_hash:=encode(sha256(convert_to(actor::text,'UTF8')),'hex');
 if proof.consumed_at is not null then return jsonb_build_object('completed',proof.consumed_parent_hash=actor_hash and l.state='active' and l.terms_version='2026-11-22'); end if;
 if proof.terms_version<>'2026-11-22' or proof.privacy_version<>'2026-11-22.1' then return jsonb_build_object('completed',false); end if;
 select max(to_timestamp((a->>'timestamp')::double precision)) into verified_at from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
 where a->>'method'=case when p_channel='google' then 'oauth' else 'otp' end and a->>'timestamp' ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$';
 if verified_at is null or verified_at<t-interval '5 minutes' or verified_at<proof.declared_at-interval '1 minute' or verified_at>t+interval '1 minute' then return jsonb_build_object('completed',false); end if;
 if p_channel='otp' then
  select encode(sha256(convert_to(lower(btrim(email)),'UTF8')),'hex') into expected_email_hash from auth.users where id=actor;
  if expected_email_hash is distinct from proof.email_hash then return jsonb_build_object('completed',false); end if;
 end if;
 -- Already-complete accounts keep their original evidence, including an older
 -- informational privacy version. Signing in does not demand a new declaration.
 if l.state='active' and l.terms_version='2026-11-22' then
  result:=private.get_account_lifecycle();
 else
  select exists(select 1 from private.parent_acceptances where parent_id=actor and terms_version=proof.terms_version) into had_acceptance;
  result:=private.complete_parent_onboarding(proof.terms_version,proof.privacy_version,proof.parent_declaration,proof.accept_terms,p_channel);
  if not had_acceptance then update private.parent_acceptances set registration_declared_at=proof.declared_at where parent_id=actor and terms_version=proof.terms_version; end if;
 end if;
 update private.parent_registration_proofs set consumed_at=t,consumed_parent_hash=actor_hash where nonce_hash=p_nonce_hash;
 return jsonb_build_object('completed',true);
end $$;
revoke all on function private.complete_parent_registration(text,text) from public,anon,authenticated,service_role;
grant execute on function private.complete_parent_registration(text,text) to authenticated;
create function public.complete_parent_registration(p_nonce_hash text,p_channel text) returns jsonb
language sql security invoker set search_path='' set timezone='UTC' as $$ select private.complete_parent_registration(p_nonce_hash,p_channel) $$;
revoke all on function public.complete_parent_registration(text,text) from public,anon,authenticated,service_role;
grant execute on function public.complete_parent_registration(text,text) to authenticated;

-- Existing worker cadence cleans expired proofs even without another login.
-- Preserve the previous scheduler and its inactivity-OFF control unchanged.
alter function private.prepare_lifecycle_jobs() rename to prepare_lifecycle_jobs_before_registration_cleanup;
revoke all on function private.prepare_lifecycle_jobs_before_registration_cleanup() from public,anon,authenticated,service_role;
create function private.prepare_lifecycle_jobs() returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare result jsonb;
begin
 result:=private.prepare_lifecycle_jobs_before_registration_cleanup();
 perform private.cleanup_parent_registrations();
 return result;
end $$;
revoke all on function private.prepare_lifecycle_jobs() from public,anon,authenticated,service_role;
-- Invalidate a warm PL/pgSQL call plan that may still hold the renamed
-- prepare function's OID; keep the claim body and privileges unchanged.
do $$ begin execute pg_get_functiondef('private.claim_lifecycle_jobs(integer)'::regprocedure); end $$;
