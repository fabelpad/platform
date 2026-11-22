-- pg_net's provider-managed queue can be readable to PUBLIC on hosted Supabase.
-- Never put a reusable credential there. Every request instead carries an
-- own-project HMAC, a short server-time window and a one-use nonce. The Vault
-- signing secret stays in Vault and never enters an HTTP queue or response.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table private.lifecycle_worker_nonces (
 nonce uuid primary key, expires_at timestamptz not null
);
create index lifecycle_worker_nonces_expiry_idx on private.lifecycle_worker_nonces(expires_at);
alter table private.lifecycle_worker_nonces enable row level security;
revoke all on private.lifecycle_worker_nonces from public,anon,authenticated,service_role;

create function private.verify_lifecycle_worker_request(p_nonce uuid,p_issued_at bigint,p_signature text) returns boolean
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare t timestamptz:=private.lifecycle_now(); target text; secret text; expected bytea; supplied bytea; mismatch integer:=0; i integer; added integer;
begin
 if p_nonce is null or p_issued_at is null or p_signature is null or p_signature!~'^[a-f0-9]{64}$' then return false; end if;
 -- Exact seconds, not rounded client clocks. A normal emitted request is at
 -- most 90 seconds old; the explicit future-skew allowance is 15 seconds.
 if p_issued_at::numeric<extract(epoch from t)-90 or p_issued_at::numeric>extract(epoch from t)+15 then return false; end if;
 select project_ref into target from private.lifecycle_worker_schedule where singleton;
 if target is null or target not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') then return false; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_lifecycle_worker_token';
 if secret is null or secret!~'^[a-f0-9]{64}$' then return false; end if;
 expected:=extensions.hmac(convert_to('fabelpad-lifecycle-worker-v1'||chr(10)||target||chr(10)||p_nonce::text||chr(10)||p_issued_at::text,'UTF8'),decode(secret,'hex'),'sha256');
 supplied:=decode(p_signature,'hex');
 -- Fixed 32-byte comparison; do not make matching-prefix timing meaningful.
 for i in 0..31 loop mismatch:=mismatch | (get_byte(expected,i) # get_byte(supplied,i)); end loop;
 if mismatch<>0 then return false; end if;
 delete from private.lifecycle_worker_nonces where expires_at<t;
 insert into private.lifecycle_worker_nonces(nonce,expires_at) values(p_nonce,to_timestamp(p_issued_at::double precision)+interval '90 seconds') on conflict do nothing;
 get diagnostics added=row_count;
 return added=1;
end $$;
revoke all on function private.verify_lifecycle_worker_request(uuid,bigint,text) from public,anon,authenticated;
grant execute on function private.verify_lifecycle_worker_request(uuid,bigint,text) to service_role;
create function public.verify_lifecycle_worker_request(p_nonce uuid,p_issued_at bigint,p_signature text) returns boolean
language sql security invoker set search_path='' as $$select private.verify_lifecycle_worker_request(p_nonce,p_issued_at,p_signature)$$;
revoke all on function public.verify_lifecycle_worker_request(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.verify_lifecycle_worker_request(uuid,bigint,text) to service_role;

create or replace function private.invoke_lifecycle_worker() returns bigint language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare target text; secret text; nonce uuid:=gen_random_uuid(); issued_at bigint:=floor(extract(epoch from private.lifecycle_now()))::bigint; signature text; request_id bigint;
begin
 select project_ref into target from private.lifecycle_worker_schedule where singleton;
 if target is null or target not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') then raise exception 'Lifecycle scheduler is not configured' using errcode='55000'; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_lifecycle_worker_token';
 if secret is null or secret!~'^[a-f0-9]{64}$' then raise exception 'Lifecycle scheduler credential unavailable' using errcode='55000'; end if;
 signature:=encode(extensions.hmac(convert_to('fabelpad-lifecycle-worker-v1'||chr(10)||target||chr(10)||nonce::text||chr(10)||issued_at::text,'UTF8'),decode(secret,'hex'),'sha256'),'hex');
 request_id:=net.http_post(url:='https://'||target||'.supabase.co/functions/v1/account-maintenance',
  body:=jsonb_build_object('nonce',nonce,'issuedAt',issued_at,'signature',signature),headers:=jsonb_build_object('Content-Type','application/json'),timeout_milliseconds:=45000);
 return request_id;
end $$;
revoke all on function private.invoke_lifecycle_worker() from public,anon,authenticated,service_role;

-- Replace only the private installer: no queue-ACL assumptions, no changing
-- provider-owned pg_net rights. Preserve all existing target/key/job checks.
create or replace function private.configure_lifecycle_worker(p_project_ref text) returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare existing_target text; secret text; job_id bigint; job record;
 job_name constant text:='fabelpad-account-maintenance';
 command_text constant text:='select private.invoke_lifecycle_worker();';
begin
 if p_project_ref is null or p_project_ref not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') then raise exception 'Unknown Fabelpad project target' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(1633837926,303);
 select project_ref into existing_target from private.lifecycle_worker_schedule where singleton for update;
 if existing_target is not null and existing_target<>p_project_ref then raise exception 'Lifecycle scheduler target is already pinned' using errcode='22023'; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_lifecycle_worker_token';
 if found then
  if secret is null or secret!~'^[a-f0-9]{64}$' then raise exception 'Existing lifecycle credential is invalid; explicit administrator review required' using errcode='55000'; end if;
 else
  secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  perform vault.create_secret(secret,'fabelpad_lifecycle_worker_token','Fabelpad internal lifecycle HMAC signing credential');
 end if;
 select * into job from cron.job where jobname=job_name;
 if found then
  if job.command is distinct from command_text or job.schedule is distinct from '* * * * *' or job.database is distinct from current_database() or job.username is distinct from current_user or job.active is distinct from true then raise exception 'Conflicting lifecycle cron job; existing job preserved' using errcode='55000'; end if;
  job_id:=job.jobid;
 else job_id:=cron.schedule(job_name,'* * * * *',command_text); end if;
 insert into private.lifecycle_worker_schedule(singleton,project_ref,cron_job_id) values(true,p_project_ref,job_id)
 on conflict(singleton) do update set cron_job_id=excluded.cron_job_id;
 return jsonb_build_object('projectRef',p_project_ref,'cronJobName',job_name,'cronJobId',job_id,'schedule','* * * * *','configured',true,'authentication','hmac-sha256-single-use-v1');
end $$;
revoke all on function private.configure_lifecycle_worker(text) from public,anon,authenticated,service_role;
