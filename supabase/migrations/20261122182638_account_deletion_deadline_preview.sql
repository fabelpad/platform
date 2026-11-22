-- Show the server's deletion deadline before the parent confirms it. The
-- preview takes no activity, acceptance, outbox or lifecycle-state writes.
create function private.preview_account_deletion() returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.require_fresh_parent(); l private.account_lifecycle; t timestamptz;
begin
 select * into l from private.account_lifecycle where parent_id=actor for share;
 if not found then raise exception 'account_blocked' using errcode='42501'; end if;
 -- Recheck the signed session and clock after waiting for the lifecycle lock.
 actor:=private.require_fresh_parent();
 t:=private.lifecycle_now();
 if l.state='deletion_pending' and l.deletion_reason='parent' and l.deletion_deadline>t then
  return jsonb_build_object('deletionDeadlineMinute',date_trunc('minute',l.deletion_deadline),'expiresAt',null);
 end if;
 if l.state<>'active' or not private.family_access_allowed(actor) then
  raise exception 'account_blocked' using errcode='42501';
 end if;
 return jsonb_build_object('deletionDeadlineMinute',date_trunc('minute',t+interval '30 days'),
  'expiresAt',date_trunc('minute',t)+interval '1 minute');
end $$;

create function public.preview_account_deletion() returns jsonb
language sql security invoker set search_path='' set timezone='UTC' as $$
 select private.preview_account_deletion()
$$;

-- The old zero-argument RPC remains compatible. The app uses this overload:
-- comparison happens inside the same statement transaction as the established
-- deletion implementation. A rollover raises an exception and therefore rolls
-- back the state change, warning cancellation, outbox insert AND session revoke.
create function private.request_account_deletion(p_expected_deadline_minute timestamptz) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.require_fresh_parent(); result jsonb; actual_deadline timestamptz;
begin
 if p_expected_deadline_minute is null or not isfinite(p_expected_deadline_minute)
 or p_expected_deadline_minute is distinct from date_trunc('minute',p_expected_deadline_minute) then
  raise exception 'deletion_preview_expired' using errcode='P0001';
 end if;
 result:=private.request_account_deletion();
 -- Reading the own locked row does not require the session that the successful
 -- first request has just revoked. Do not call a session-gated RPC afterwards.
 select deletion_deadline into actual_deadline from private.account_lifecycle where parent_id=actor;
 if actual_deadline is null or date_trunc('minute',actual_deadline) is distinct from p_expected_deadline_minute then
  raise exception 'deletion_preview_expired' using errcode='P0001';
 end if;
 return result;
end $$;

create function public.request_account_deletion(p_expected_deadline_minute timestamptz) returns jsonb
language sql security invoker set search_path='' set timezone='UTC' as $$
 select private.request_account_deletion(p_expected_deadline_minute)
$$;

revoke all on function private.preview_account_deletion() from public,anon,authenticated,service_role;
revoke all on function public.preview_account_deletion() from public,anon,authenticated,service_role;
revoke all on function private.request_account_deletion(timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.request_account_deletion(timestamptz) from public,anon,authenticated,service_role;
grant execute on function private.preview_account_deletion(),public.preview_account_deletion(),
 private.request_account_deletion(timestamptz),public.request_account_deletion(timestamptz) to authenticated;
