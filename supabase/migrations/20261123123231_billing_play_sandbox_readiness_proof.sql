-- Production readiness accepts an authoritative sandbox license proof through a
-- fresh-administrator ticket. It grants no content, payment or renewal rights.
create table private.billing_play_license_proofs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 credential_revision bigint not null references private.billing_credentials(revision),
 settings_revision bigint not null references private.billing_history(revision),
 environment text not null check(environment='production'),
 mode text not null check(mode='live'),
 config jsonb not null,
 obfuscated_account_id text not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default(clock_timestamp()+interval '5 minutes'),
 completed_at timestamptz,
 proof jsonb
);
alter table private.billing_play_license_proofs enable row level security;
revoke all on private.billing_play_license_proofs from public,anon,authenticated,service_role;

create function private.prepare_billing_play_license_proof(p_credential_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();r private.billing_credentials;c private.billing_control;t private.billing_play_license_proofs;begin
 perform private.billing_lock();select * into c from private.billing_control;
 select * into r from private.billing_credentials where revision=p_credential_revision;
 if private.billing_environment()<>'production' or r.revision is null or r.provider<>'play' or r.environment<>'production' or r.mode<>'live' or not r.active or not r.verified or not coalesce((r.verification->>'productsVerified')::boolean,false) or c.settings->'play' is distinct from(select settings->'play' from private.billing_history where revision=r.settings_revision) then raise exception 'billing_live_play_product_probe_required' using errcode='55000';end if;
 if exists(select 1 from private.billing_play_license_proofs where actor_id=actor and credential_revision=r.revision and created_at>clock_timestamp()-interval '1 minute') then raise exception 'billing_trial_rate_limited' using errcode='54000';end if;
 insert into private.billing_play_license_proofs(actor_id,credential_revision,settings_revision,environment,mode,config,obfuscated_account_id)
 values(actor,r.revision,c.revision,'production','live',c.settings,encode(extensions.digest('fabelpad:'||actor::text,'sha256'),'hex')) returning * into t;
 insert into private.billing_audit(actor_id,action,revision,details) values(actor,'play_license_proof_prepared',c.revision,jsonb_build_object('proofId',t.id,'credentialRevision',r.revision));
 return jsonb_build_object('id',t.id,'credentialRevision',r.revision,'settingsRevision',c.revision,'environment',t.environment,'mode',t.mode,'expiresAt',t.expires_at,'obfuscatedAccountId',t.obfuscated_account_id,'packageName',c.settings#>>'{play,packageName}','monthlyProductId',c.settings#>>'{play,monthlyProductId}','monthlyBasePlanId',c.settings#>>'{play,monthlyBasePlanId}','yearlyProductId',c.settings#>>'{play,yearlyProductId}','yearlyBasePlanId',c.settings#>>'{play,yearlyBasePlanId}','termsVersion',c.settings->>'termsVersion','prices',c.settings->'prices');
end$$;

create function private.get_billing_play_license_proof(p_proof_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.billing_play_license_proofs;begin
 select * into t from private.billing_play_license_proofs where id=p_proof_id and completed_at is null and expires_at>clock_timestamp();
 if t.id is null or t.actor_id is null or not private.is_confirmed_email_admin(t.actor_id) then return null;end if;
 return jsonb_build_object('id',t.id,'parentId',t.actor_id,'credentialRevision',t.credential_revision,'settingsRevision',t.settings_revision,'environment',t.environment,'mode',t.mode,'expiresAt',t.expires_at,'obfuscatedAccountId',t.obfuscated_account_id,'settings',t.config,'termsVersion',t.config->>'termsVersion','prices',t.config->'prices');
end$$;

create function private.record_billing_play_license_proof(p_proof_id uuid,p_proof jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.billing_play_license_proofs;r private.billing_credentials;c private.billing_control;verified_at timestamptz;period text;safe jsonb;begin
 perform private.billing_lock();select * into t from private.billing_play_license_proofs where id=p_proof_id for update;
 if t.id is null or t.actor_id is null or not private.is_confirmed_email_admin(t.actor_id) then raise exception 'billing_invalid_license_proof' using errcode='42501';end if;
 if jsonb_typeof(p_proof) is distinct from 'object' or octet_length(p_proof::text)>4096 or exists(select 1 from jsonb_object_keys(p_proof) k where k not in('sandbox','acknowledged','ownerBinding','tokenHash','packageName','productId','basePlanId','period','amountCents','currency','verifiedAt')) or not(p_proof?&array['sandbox','acknowledged','ownerBinding','tokenHash','packageName','productId','basePlanId','period','amountCents','currency','verifiedAt']) then raise exception 'billing_invalid_license_proof' using errcode='22023';end if;
 period:=p_proof->>'period';
 if p_proof->'sandbox' is distinct from 'true'::jsonb or p_proof->'acknowledged' is distinct from 'true'::jsonb or p_proof->>'ownerBinding' is distinct from t.obfuscated_account_id or p_proof->>'tokenHash' is null or p_proof->>'tokenHash'!~'^[a-f0-9]{64}$' or period is null or period not in('month','year') or p_proof->>'packageName' is distinct from t.config#>>'{play,packageName}' or p_proof->>'productId' is distinct from t.config#>>array['play',case when period='month' then 'monthlyProductId' else 'yearlyProductId' end] or p_proof->>'basePlanId' is distinct from t.config#>>array['play',case when period='month' then 'monthlyBasePlanId' else 'yearlyBasePlanId' end] or jsonb_typeof(p_proof->'amountCents') is distinct from 'number' or p_proof->>'amountCents' is distinct from t.config#>>array['prices',period,'amountCents'] or p_proof->>'currency' is distinct from 'EUR' then raise exception 'billing_license_proof_mismatch' using errcode='22023';end if;
 safe:=p_proof-'verifiedAt';
 if t.completed_at is not null then if safe is distinct from t.proof then raise exception 'billing_license_proof_replay_conflict' using errcode='22023';end if;return jsonb_build_object('saved',true,'credentialRevision',t.credential_revision,'serverVerificationVerified',true);end if;
 verified_at:=(p_proof->>'verifiedAt')::timestamptz;
 select * into c from private.billing_control;select * into r from private.billing_credentials where revision=t.credential_revision for update;
 if t.expires_at<=clock_timestamp() or verified_at is null or not isfinite(verified_at) or verified_at<t.created_at-interval '5 seconds' or verified_at>clock_timestamp()+interval '30 seconds' or verified_at<clock_timestamp()-interval '5 minutes' or private.billing_environment()<>'production' or c.revision<>t.settings_revision or c.settings is distinct from t.config or r.provider<>'play' or r.environment<>'production' or r.mode<>'live' or not r.active or not r.verified or not coalesce((r.verification->>'productsVerified')::boolean,false) then raise exception 'billing_license_proof_expired_or_changed' using errcode='55000';end if;
 update private.billing_play_license_proofs set completed_at=clock_timestamp(),proof=safe where id=t.id;
 update private.billing_credentials set verification=verification||jsonb_build_object('serverVerificationVerified',true,'licenseProofVerified',true),verified_at=clock_timestamp() where revision=r.revision;
 perform private.billing_bump(t.actor_id,'play_sandbox_license_proof_verified',jsonb_build_object('proofId',t.id,'credentialRevision',r.revision,'tokenHash',safe->>'tokenHash','packageName',safe->>'packageName','productId',safe->>'productId','basePlanId',safe->>'basePlanId','period',period,'amountCents',(safe->>'amountCents')::integer,'sandbox',true));
 return jsonb_build_object('saved',true,'credentialRevision',r.revision,'serverVerificationVerified',true);
end$$;

revoke all on function private.prepare_billing_play_license_proof(bigint),private.get_billing_play_license_proof(uuid),private.record_billing_play_license_proof(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.prepare_billing_play_license_proof(bigint) to authenticated;
grant execute on function private.get_billing_play_license_proof(uuid),private.record_billing_play_license_proof(uuid,jsonb) to service_role;
create function public.prepare_billing_play_license_proof(p_credential_revision bigint) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_billing_play_license_proof(p_credential_revision)$$;
create function public.get_billing_play_license_proof(p_proof_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_billing_play_license_proof(p_proof_id)$$;
create function public.record_billing_play_license_proof(p_proof_id uuid,p_proof jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.record_billing_play_license_proof(p_proof_id,p_proof)$$;
revoke all on function public.prepare_billing_play_license_proof(bigint),public.get_billing_play_license_proof(uuid),public.record_billing_play_license_proof(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prepare_billing_play_license_proof(bigint) to authenticated;
grant execute on function public.get_billing_play_license_proof(uuid),public.record_billing_play_license_proof(uuid,jsonb) to service_role;

-- Google charges the configured base plan. App coupons cannot silently change
-- its nonzero price. Fully free gifts still create no Google purchase at all.
alter function private.reserve_billing_purchase(text,text,uuid,bigint,integer,text,boolean,text) rename to reserve_billing_purchase_before_play_coupon_guard;
revoke all on function private.reserve_billing_purchase_before_play_coupon_guard(text,text,uuid,bigint,integer,text,boolean,text) from public,anon,authenticated,service_role;
create function private.reserve_billing_purchase(p_provider text,p_period text,p_request_id uuid,p_expected_revision bigint,p_expected_amount_cents integer,p_terms_version text,p_accept_recurring boolean,p_coupon_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 -- The underlying locked quote independently rejects a forged expected zero.
 -- Keeping its request-id replay first also preserves idempotent gift claims.
 if p_provider='play' and nullif(btrim(p_coupon_code),'') is not null and p_expected_amount_cents is distinct from 0 then raise exception 'billing_play_coupon_requires_configured_offer' using errcode='22023';end if;
 return private.reserve_billing_purchase_before_play_coupon_guard(p_provider,p_period,p_request_id,p_expected_revision,p_expected_amount_cents,p_terms_version,p_accept_recurring,p_coupon_code);
end$$;
revoke all on function private.reserve_billing_purchase(text,text,uuid,bigint,integer,text,boolean,text) from public,anon,authenticated,service_role;
grant execute on function private.reserve_billing_purchase(text,text,uuid,bigint,integer,text,boolean,text) to authenticated;
-- Rebind the exposed invoker by name rather than retaining a dependency on the
-- now-revoked implementation OID after the private function was renamed.
create or replace function public.reserve_billing_purchase(p_provider text,p_period text,p_request_id uuid,p_expected_revision bigint,p_expected_amount_cents integer,p_terms_version text,p_accept_recurring boolean,p_coupon_code text default null) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_billing_purchase(p_provider,p_period,p_request_id,p_expected_revision,p_expected_amount_cents,p_terms_version,p_accept_recurring,p_coupon_code)$$;

-- A Play product price is verified against its frozen offer. Changing only
-- app prices invalidates that proof and preserves the old key for obligations.
alter function private.save_billing_settings(bigint,jsonb) rename to save_billing_settings_before_play_price_guard;
revoke all on function private.save_billing_settings_before_play_price_guard(bigint,jsonb) from public,anon,authenticated,service_role;
create function private.save_billing_settings(p_expected_revision bigint,p_settings jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.billing_admin();before_settings jsonb;r private.billing_credentials;result jsonb;begin
 perform private.billing_lock();select settings into before_settings from private.billing_control;
 select * into r from private.billing_credentials where provider='play' and environment=private.billing_environment() and active and verified order by revision desc limit 1;
 result:=private.save_billing_settings_before_play_price_guard(p_expected_revision,p_settings);
 if result->>'saved'='true' and before_settings->'prices' is distinct from p_settings->'prices' and before_settings->'play' is not distinct from p_settings->'play' then
 update private.billing_credentials set active=false where provider='play' and environment=private.billing_environment() and active;
 if r.revision is not null then insert into private.billing_credentials(provider,environment,mode,secret_id,settings_revision,created_by) values('play',r.environment,r.mode,r.secret_id,(result->>'revision')::bigint,actor);end if;
 insert into private.billing_audit(actor_id,action,revision,details) values(actor,'play_price_probe_invalidated',(result->>'revision')::bigint,jsonb_build_object('previousCredentialRevision',r.revision));
 return jsonb_build_object('saved',true)||private.billing_snapshot();end if;
 return result;
end$$;
revoke all on function private.save_billing_settings(bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.save_billing_settings(bigint,jsonb) to authenticated;
create or replace function public.save_billing_settings(p_expected_revision bigint,p_settings jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.save_billing_settings(p_expected_revision,p_settings)$$;


-- A 100% percentage code is a calendar gift, independent of selected billing
-- interval. It never creates a mandate or a later payable renewal.
alter function private.billing_quote(uuid,text,text) rename to billing_quote_before_full_gift_rule;
revoke all on function private.billing_quote_before_full_gift_rule(uuid,text,text) from public,anon,authenticated,service_role;
create function private.billing_quote(p_parent uuid,p_period text,p_coupon_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb;b private.billing_coupon_batches;begin
 q:=private.billing_quote_before_full_gift_rule(p_parent,p_period,p_coupon_code);
 if q->>'couponId' is not null then select batch.* into b from private.billing_coupons cp join private.billing_coupon_batches batch on batch.id=cp.batch_id where cp.id=(q->>'couponId')::uuid;
 if b.kind='percentage' and b.value=100 then q:=q||jsonb_build_object('amountCents',0,'discountCents',(q->>'baseAmountCents')::integer,'gift',true,'renewalAmountCents',0);end if;end if;
 if q->>'gift'='true' then q:=q||jsonb_build_object('renewalAmountCents',0);end if;return q;
end$$;
revoke all on function private.billing_quote(uuid,text,text) from public,anon,authenticated,service_role;
