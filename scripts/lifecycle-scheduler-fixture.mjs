/** Platform boundary only: cron/HTTP are not available in PostgreSQL WASM.
 * Real application SQL, permissions, Vault access, pinning and jobs execute in
 * PGlite. This fixture does not claim hosted extension/network verification. */
export async function installLifecycleSchedulerTestFixture(db) {
  await db.exec(`
    create schema cron;
    create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,database text,username text,active boolean default true);
    revoke all on schema cron from public,anon,authenticated,service_role;
    revoke all on all tables in schema cron from public,anon,authenticated,service_role;
    create function cron.schedule(job_name text,job_schedule text,job_command text) returns bigint language plpgsql set search_path='' as $$declare result bigint;begin
      insert into cron.job(jobname,schedule,command,database,username) values(job_name,job_schedule,job_command,current_database(),current_user) returning jobid into result;return result;
    end$$;
    revoke all on function cron.schedule(text,text,text) from public,anon,authenticated,service_role;
    create schema net;
    create table net.http_request_queue(id bigint generated always as identity primary key,url text,body jsonb,headers jsonb,timeout_milliseconds integer);
    revoke all on schema net from public,anon,authenticated,service_role;
    revoke all on all tables in schema net from public,anon,authenticated,service_role;
    create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 1000) returns bigint language plpgsql set search_path='' as $$declare result bigint;begin
      insert into net.http_request_queue(url,body,headers,timeout_milliseconds) values(url,body,headers,timeout_milliseconds) returning id into result;return result;
    end$$;
    revoke all on function net.http_post(text,jsonb,jsonb,jsonb,integer) from public,anon,authenticated,service_role;
  `);
}
export function localMigrationSql(source) {
  const begin='-- BEGIN FABELPAD HOSTED SCHEDULER EXTENSIONS',end='-- END FABELPAD HOSTED SCHEDULER EXTENSIONS';
  if(!source.includes(begin))return source;
  const first=source.indexOf(begin),last=source.indexOf(end);
  if(first!==source.lastIndexOf(begin)||last<first||last!==source.lastIndexOf(end))throw new Error('Invalid scheduler platform test boundary');
  const platform=source.slice(first+begin.length,last).trim();
  if(platform!=="create extension if not exists pg_cron with schema pg_catalog;\ncreate extension if not exists pg_net;")throw new Error('Scheduler platform contract changed; review fixture first');
  return source.slice(0,first)+'-- Hosted cron/net extension activation replaced by explicit PGlite I/O fixture.\n'+source.slice(last+end.length);
}
