-- Owner-confirmed recovery copies may exist for up to 180 days. Preserve
-- minimal erasure evidence for 210 days (that horizon plus 30 days' margin).
-- This database-local evidence is NOT an independent restore journal: a
-- snapshot from before an erasure does not contain the later erasure event.
-- Before any restored environment can receive traffic, its operator must
-- replay current, independently preserved evidence in an isolated environment.

alter table private.deletion_receipts alter column expires_at
 set default (clock_timestamp()+interval '210 days');

create function private.enforce_deletion_evidence_retention() returns trigger
language plpgsql set search_path='' set timezone='UTC' as $$
begin
 -- The established worker still supplies its original 90-day expiry. Enforce
 -- the newer fixed duration here without rewriting an already applied migration or
 -- changing that worker's Auth/Storage completion checks.
 if tg_op='UPDATE' then
  if new.completed_at is distinct from old.completed_at then
   raise exception 'Erasure completion time is immutable' using errcode='42501';
  end if;
 end if;
 new.expires_at:=new.completed_at+interval '210 days';
 return new;
end $$;
revoke all on function private.enforce_deletion_evidence_retention() from public,anon,authenticated,service_role;
create trigger deletion_evidence_retention before insert or update on private.deletion_receipts
 for each row execute function private.enforce_deletion_evidence_retention();
update private.deletion_receipts
 set expires_at=completed_at+interval '210 days'
 where expires_at is distinct from completed_at+interval '210 days';

-- Operational child-consent tombstones live until account deletion. This
-- separate, minimal digest receipt survives that FK cascade for the recovery
-- horizon. It contains no nickname, progress, e-mail, raw account/profile ID,
-- message, access token or credential. It remains protected pseudonymous data.
create table private.child_erasure_evidence (
 parent_digest text not null check(parent_digest ~ '^[a-f0-9]{64}$'),
 child_digest text not null check(child_digest ~ '^[a-f0-9]{64}$'),
 withdrawn_at timestamptz not null,
 recorded_at timestamptz not null,
 expires_at timestamptz not null,
 primary key(parent_digest,child_digest),
 check(withdrawn_at<=recorded_at),
 check(expires_at=recorded_at+interval '210 days')
);
alter table private.child_erasure_evidence enable row level security;
revoke all on private.child_erasure_evidence from public,anon,authenticated,service_role;
create index child_erasure_evidence_expiry_idx on private.child_erasure_evidence(expires_at);

create function private.record_child_erasure_evidence() returns trigger
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare t timestamptz;
begin
 if tg_op='UPDATE' then
  if old.withdrawn_at is not null then
   if new.withdrawn_at is distinct from old.withdrawn_at then
    raise exception 'Profile withdrawal time is immutable' using errcode='42501';
   end if;
   -- Retrying the same withdrawal must not continually extend retention.
   return new;
  end if;
 end if;
 if new.withdrawn_at is null then return new; end if;
 t:=private.lifecycle_now();
 insert into private.child_erasure_evidence(parent_digest,child_digest,withdrawn_at,recorded_at,expires_at)
 values(encode(sha256(convert_to(new.parent_id::text,'UTF8')),'hex'),
  encode(sha256(convert_to('fabelpad-child-erasure-v1:'||new.parent_id::text||':'||new.child_id,'UTF8')),'hex'),
  new.withdrawn_at,t,t+interval '210 days')
 on conflict(parent_digest,child_digest) do nothing;
 return new;
end $$;
revoke all on function private.record_child_erasure_evidence() from public,anon,authenticated,service_role;
create trigger child_erasure_evidence_after_withdrawal after insert or update of withdrawn_at on private.child_profile_consents
 for each row execute function private.record_child_erasure_evidence();

-- Preserve existing, still-available withdrawals. Previously expired receipts
-- cannot be reconstructed, and this migration makes no such claim.
do $$ declare t timestamptz:=private.lifecycle_now(); begin
 insert into private.child_erasure_evidence(parent_digest,child_digest,withdrawn_at,recorded_at,expires_at)
  select encode(sha256(convert_to(parent_id::text,'UTF8')),'hex'),
   encode(sha256(convert_to('fabelpad-child-erasure-v1:'||parent_id::text||':'||child_id,'UTF8')),'hex'),
   withdrawn_at,t,t+interval '210 days'
  from private.child_profile_consents where withdrawn_at is not null;
end $$;

-- Keep the original scheduler's locks, deadlines, inactivity OFF gate, and
-- existing bounded metadata cleanup. Add only expiry of these new receipts.
alter function private.prepare_lifecycle_jobs() rename to prepare_lifecycle_jobs_before_erasure_retention;
revoke all on function private.prepare_lifecycle_jobs_before_erasure_retention() from public,anon,authenticated,service_role;
create function private.prepare_lifecycle_jobs() returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare result jsonb;
begin
 result:=private.prepare_lifecycle_jobs_before_erasure_retention();
 delete from private.child_erasure_evidence where expires_at<private.lifecycle_now();
 return result;
end $$;
revoke all on function private.prepare_lifecycle_jobs() from public,anon,authenticated,service_role;
