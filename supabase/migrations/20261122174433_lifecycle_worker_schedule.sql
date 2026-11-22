-- Platform extensions are enabled only for this project's database. PGlite
-- regression fixtures replace this marked platform block with I/O stubs; all
-- application SQL below executes unchanged in those tests.
-- BEGIN FABELPAD HOSTED SCHEDULER EXTENSIONS
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
-- END FABELPAD HOSTED SCHEDULER EXTENSIONS

create table private.lifecycle_worker_schedule (
 singleton boolean primary key default true check(singleton),
 project_ref text not null check(project_ref in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs')),
 cron_job_id bigint not null,
 configured_at timestamptz not null default clock_timestamp()
);
alter table private.lifecycle_worker_schedule enable row level security;
revoke all on private.lifecycle_worker_schedule from public,anon,authenticated,service_role;

-- No runtime role can invoke this helper, read the encrypted credential, change
-- its target, or schedule a new task. pg_cron invokes it as the configuring
-- database administrator. Neither the cron command nor the HTTP body contains
-- a credential literal; pg_net receives it only in its private request queue.
create function private.invoke_lifecycle_worker() returns bigint language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare target text; secret text; request_id bigint;
begin
 select project_ref into target from private.lifecycle_worker_schedule where singleton;
 if target is null or target not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') then raise exception 'Lifecycle scheduler is not configured' using errcode='55000'; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_lifecycle_worker_token';
 if secret is null or secret!~'^[a-f0-9]{64}$' then raise exception 'Lifecycle scheduler credential unavailable' using errcode='55000'; end if;
 -- Abort rather than expose the queue's transient Authorization header if the
 -- platform was configured with excessive application-role table privileges.
 if has_table_privilege('anon','net.http_request_queue','SELECT') or has_table_privilege('authenticated','net.http_request_queue','SELECT') or has_table_privilege('service_role','net.http_request_queue','SELECT') then
  raise exception 'Lifecycle request queue permissions require administrator review' using errcode='42501';
 end if;
 request_id:=net.http_post(url:='https://'||target||'.supabase.co/functions/v1/account-maintenance',
  body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),timeout_milliseconds:=45000);
 return request_id;
end $$;
revoke all on function private.invoke_lifecycle_worker() from public,anon,authenticated,service_role;

-- Installation intentionally requires the already verified project ref. A
-- database name/hostname or an unverified GUC is never used to guess the site.
-- Once installed, another ref is rejected instead of silently redirecting jobs.
create function private.configure_lifecycle_worker(p_project_ref text) returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare existing_target text; secret text; job_id bigint; job record;
 job_name constant text:='fabelpad-account-maintenance';
 command_text constant text:='select private.invoke_lifecycle_worker();';
begin
 if p_project_ref is null or p_project_ref not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') then raise exception 'Unknown Fabelpad project target' using errcode='22023'; end if;
 if has_table_privilege('anon','net.http_request_queue','SELECT') or has_table_privilege('authenticated','net.http_request_queue','SELECT') or has_table_privilege('service_role','net.http_request_queue','SELECT') then
  raise exception 'Lifecycle request queue permissions require administrator review' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(1633837926,303);
 select project_ref into existing_target from private.lifecycle_worker_schedule where singleton for update;
 if existing_target is not null and existing_target<>p_project_ref then raise exception 'Lifecycle scheduler target is already pinned' using errcode='22023'; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_lifecycle_worker_token';
 if found then
  if secret is null or secret!~'^[a-f0-9]{64}$' then raise exception 'Existing lifecycle credential is invalid; explicit administrator review required' using errcode='55000'; end if;
 else
  -- Two independent PostgreSQL CSPRNG UUIDs yield 64 hex characters with
  -- approximately 244 bits of entropy. No external random source or plaintext
  -- secret is passed to/returned from this operation.
  secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  perform vault.create_secret(secret,'fabelpad_lifecycle_worker_token','Fabelpad internal lifecycle scheduler credential');
 end if;
 select * into job from cron.job where jobname=job_name;
 if found then
  if job.command is distinct from command_text or job.schedule is distinct from '* * * * *' or job.database is distinct from current_database() or job.username is distinct from current_user or job.active is distinct from true then raise exception 'Conflicting lifecycle cron job; existing job preserved' using errcode='55000'; end if;
  job_id:=job.jobid;
 else
  job_id:=cron.schedule(job_name,'* * * * *',command_text);
 end if;
 insert into private.lifecycle_worker_schedule(singleton,project_ref,cron_job_id) values(true,p_project_ref,job_id)
 on conflict(singleton) do update set cron_job_id=excluded.cron_job_id;
 -- This migration/configuration never changes the separate 90-day safety gate.
 return jsonb_build_object('projectRef',p_project_ref,'cronJobName',job_name,'cronJobId',job_id,'schedule','* * * * *','configured',true);
end $$;
revoke all on function private.configure_lifecycle_worker(text) from public,anon,authenticated,service_role;
