-- Optional adult marketing permission is separate from terms, privacy information
-- and child-profile consent. No existing identity is opted in or backfilled.
-- Evidence contains no copied email address, child data, IP or device metadata;
-- both current preference and its history disappear with the Auth identity.
create table private.parent_email_preferences (
 parent_id uuid primary key references auth.users(id) on delete cascade,
 marketing_consent boolean not null,
 consent_version text not null, consent_text text not null,
 channel text not null check(channel in ('otp','google','onboarding','account')),
 declared_at timestamptz not null, updated_at timestamptz not null,
 granted_at timestamptz, withdrawn_at timestamptz,
 check(not marketing_consent or (granted_at is not null and withdrawn_at is null))
);
create table private.parent_marketing_consent_events (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid not null references auth.users(id) on delete cascade,
 marketing_consent boolean not null,
 consent_version text not null, consent_text text not null,
 channel text not null check(channel in ('otp','google','onboarding','account')),
 declared_at timestamptz not null, recorded_at timestamptz not null,
 granted_at timestamptz, withdrawn_at timestamptz
);
create index parent_marketing_consent_events_parent on private.parent_marketing_consent_events(parent_id,recorded_at);
alter table private.parent_email_preferences enable row level security;
alter table private.parent_marketing_consent_events enable row level security;
revoke all on private.parent_email_preferences,private.parent_marketing_consent_events from public,anon,authenticated,service_role;

alter table private.parent_registration_proofs
 add column marketing_consent boolean not null default false,
 add column marketing_consent_version text,
 add column marketing_consent_text text,
 add constraint registration_marketing_evidence check(
  (marketing_consent_version is null and marketing_consent_text is null and not marketing_consent)
  or (marketing_consent_version is not null and marketing_consent_text is not null)
 );
comment on column private.parent_registration_proofs.marketing_consent is 'Optional declaration only; no permission exists until verified, once-only completion. Legacy proofs remain false without invented checkbox evidence.';

-- Internal helper only: the verified, locked registration/onboarding transaction
-- calls this once after account activation. Conflict handling preserves an opt-out.
create function private.initialize_parent_email_preferences(p_actor uuid,p_consent boolean,p_channel text,p_declared_at timestamptz,p_version text,p_text text)
returns void language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare t timestamptz:=private.lifecycle_now(); inserted uuid;
begin
 if p_actor is distinct from auth.uid() or p_consent is null or p_declared_at is null
 or p_version is null or p_text is null or not private.family_access_allowed(p_actor)
 then raise exception 'Invalid marketing declaration' using errcode='42501'; end if;
 insert into private.parent_email_preferences(parent_id,marketing_consent,consent_version,consent_text,channel,declared_at,updated_at,granted_at)
 values(p_actor,p_consent,p_version,p_text,p_channel,p_declared_at,t,case when p_consent then t end)
 on conflict(parent_id) do nothing returning parent_id into inserted;
 if inserted is not null then
  insert into private.parent_marketing_consent_events(parent_id,marketing_consent,consent_version,consent_text,channel,declared_at,recorded_at,granted_at)
  values(p_actor,p_consent,p_version,p_text,p_channel,p_declared_at,t,case when p_consent then t end);
 end if;
end $$;
revoke all on function private.initialize_parent_email_preferences(uuid,boolean,text,timestamptz,text,text) from public,anon,authenticated,service_role;

-- Preserve the old seven-argument RPC for older web/native clients. The distinct
-- new name avoids overloaded PostgREST dispatch and freezes the choice at start.
create function private.begin_parent_registration_with_marketing(p_nonce_hash text,p_channel text,p_email_hash text,p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean,p_marketing_consent boolean)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare existing private.parent_registration_proofs; result jsonb; had_proof boolean;
begin
 if p_marketing_consent is null then raise exception 'Invalid marketing declaration' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(726114922098231);
 perform private.cleanup_parent_registrations();
 select * into existing from private.parent_registration_proofs where nonce_hash=p_nonce_hash;
 had_proof:=found;
 result:=private.begin_parent_registration(p_nonce_hash,p_channel,p_email_hash,p_terms_version,p_privacy_version,p_parent_declaration,p_accept_terms);
 if had_proof then
  if existing.marketing_consent is distinct from p_marketing_consent then raise exception 'Invalid marketing declaration' using errcode='22023'; end if;
 else
  update private.parent_registration_proofs set marketing_consent=p_marketing_consent,
   marketing_consent_version='2026-11-24',marketing_consent_text='Ja, ik ontvang graag promotionele e-mails en updates van Fabelpad. Ik kan mij altijd afmelden.'
   where nonce_hash=p_nonce_hash;
 end if;
 return result;
end $$;
create function public.begin_parent_registration_with_marketing(p_nonce_hash text,p_channel text,p_email_hash text,p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean,p_marketing_consent boolean)
returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$
 select private.begin_parent_registration_with_marketing(p_nonce_hash,p_channel,p_email_hash,p_terms_version,p_privacy_version,p_parent_declaration,p_accept_terms,p_marketing_consent)
$$;
revoke all on function private.begin_parent_registration_with_marketing(text,text,text,text,text,boolean,boolean,boolean),public.begin_parent_registration_with_marketing(text,text,text,text,text,boolean,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function private.begin_parent_registration_with_marketing(text,text,text,text,text,boolean,boolean,boolean),public.begin_parent_registration_with_marketing(text,text,text,text,text,boolean,boolean,boolean) to anon,authenticated;

-- Retain every existing email/channel/session/freshness/version/consumption
-- check. Only the successful first onboarding branch may materialize permission.
do $migration$
declare definition text; needle text:='  if not had_acceptance then update private.parent_acceptances';
begin
 definition:=pg_catalog.pg_get_functiondef('private.complete_parent_registration(text,text)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception 'Registration implementation changed'; end if;
 definition:=replace(definition,needle,
  '  if l.state=''onboarding'' and proof.marketing_consent_version is not null then
   perform private.initialize_parent_email_preferences(actor,proof.marketing_consent,p_channel,proof.declared_at,proof.marketing_consent_version,proof.marketing_consent_text);
  end if;
'||needle);
 execute definition;
end $migration$;

-- Verified fallback onboarding can collect the same independent declaration.
-- Existing active accounts and later terms reacceptance retain their preference.
create function private.complete_parent_onboarding_with_marketing(p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean,p_marketing_consent boolean)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); l private.account_lifecycle; result jsonb; t timestamptz;
begin
 if p_marketing_consent is null then raise exception 'Invalid marketing declaration' using errcode='22023'; end if;
 select * into strict l from private.account_lifecycle where parent_id=actor for update;
 if l.state='onboarding' then perform private.require_fresh_parent(); end if;
 t:=private.lifecycle_now();
 result:=private.complete_parent_onboarding(p_terms_version,p_privacy_version,p_parent_declaration,p_accept_terms);
 if l.state='onboarding' then
  perform private.initialize_parent_email_preferences(actor,p_marketing_consent,'onboarding',t,'2026-11-24','Ja, ik ontvang graag promotionele e-mails en updates van Fabelpad. Ik kan mij altijd afmelden.');
 end if;
 return result;
end $$;
create function public.complete_parent_onboarding_with_marketing(p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean,p_marketing_consent boolean)
returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$
 select private.complete_parent_onboarding_with_marketing(p_terms_version,p_privacy_version,p_parent_declaration,p_accept_terms,p_marketing_consent)
$$;

create function private.get_parent_email_preferences() returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); p private.parent_email_preferences;
begin
 if not private.family_access_allowed(actor) then raise exception 'account_blocked' using errcode='42501'; end if;
 select * into p from private.parent_email_preferences where parent_id=actor;
 return jsonb_build_object('marketingConsent',coalesce(p.marketing_consent,false),'updatedAt',p.updated_at);
end $$;
create function public.get_parent_email_preferences() returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.get_parent_email_preferences() $$;

create function private.set_parent_email_preferences(p_marketing_consent boolean) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); t timestamptz; p private.parent_email_preferences;
 version constant text:='2026-11-24'; wording constant text:='Ja, ik ontvang graag promotionele e-mails en updates van Fabelpad. Ik kan mij altijd afmelden.';
begin
 if p_marketing_consent is null then raise exception 'Invalid marketing declaration' using errcode='22023'; end if;
 -- Serialize account deletion, registration and preference writes on the same row.
 perform 1 from private.account_lifecycle where parent_id=actor for update;
 if not private.family_access_allowed(actor) then raise exception 'account_blocked' using errcode='42501'; end if;
 t:=private.lifecycle_now();
 select * into p from private.parent_email_preferences where parent_id=actor;
 if found and p.marketing_consent=p_marketing_consent then return private.get_parent_email_preferences(); end if;
 insert into private.parent_email_preferences(parent_id,marketing_consent,consent_version,consent_text,channel,declared_at,updated_at,granted_at,withdrawn_at)
 values(actor,p_marketing_consent,version,wording,'account',t,t,case when p_marketing_consent then t else p.granted_at end,case when not p_marketing_consent and p.marketing_consent then t end)
 on conflict(parent_id) do update set marketing_consent=excluded.marketing_consent,consent_version=excluded.consent_version,consent_text=excluded.consent_text,
  channel=excluded.channel,declared_at=excluded.declared_at,updated_at=excluded.updated_at,granted_at=excluded.granted_at,withdrawn_at=excluded.withdrawn_at
 where private.parent_email_preferences.parent_id=actor;
 insert into private.parent_marketing_consent_events(parent_id,marketing_consent,consent_version,consent_text,channel,declared_at,recorded_at,granted_at,withdrawn_at)
 select parent_id,marketing_consent,consent_version,consent_text,channel,declared_at,t,granted_at,withdrawn_at from private.parent_email_preferences where parent_id=actor;
 return private.get_parent_email_preferences();
end $$;
create function public.set_parent_email_preferences(p_marketing_consent boolean) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.set_parent_email_preferences(p_marketing_consent) $$;

do $grants$
declare signature text;
begin
 foreach signature in array array['complete_parent_onboarding_with_marketing(text,text,boolean,boolean,boolean)','get_parent_email_preferences()','set_parent_email_preferences(boolean)'] loop
  execute 'revoke all on function private.'||signature||',public.'||signature||' from public,anon,authenticated,service_role';
  execute 'grant execute on function private.'||signature||',public.'||signature||' to authenticated';
 end loop;
end $grants$;
