-- Keep a stable object response for empty and nonempty zero-argument claims.
-- Only these service-only public transport wrappers change; the private
-- claim functions retain their ownership, grants, leases and budget rules.
create or replace function public.claim_narration_job() returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('claim',private.claim_narration_job())
$$;
create or replace function public.claim_narration_item() returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('claim',private.claim_narration_item())
$$;
notify pgrst, 'reload schema';
