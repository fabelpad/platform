-- Repair only our newly installed, unused pg_net extension placement. Supabase
-- marks the extension non-relocatable, so ALTER EXTENSION SET SCHEMA cannot be
-- used. Refuse to replace an extension with any scheduled/network work; never
-- CASCADE and never edit pg_extension directly. The entire transaction rolls
-- back if the hosted administrator does not permit this extension operation.
do $$
declare placement text;
begin
 select n.nspname into placement from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_net';
 if placement is null or placement='extensions' then return; end if;
 if placement<>'public' then raise exception 'Unexpected pg_net placement; administrator review required'; end if;
 if exists(select 1 from cron.job) or exists(select 1 from net.http_request_queue) or exists(select 1 from net._http_response)
 then raise exception 'Existing network work is preserved; pg_net placement requires a separate maintenance plan'; end if;
 execute 'drop extension pg_net';
 execute 'create extension pg_net with schema extensions';
end $$;
