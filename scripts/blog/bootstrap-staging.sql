-- Owner-only staging provisioning after the tested additive migration.
-- This file contains no bearer token, service-role key or user data.
-- Phase 1: explicit site/environment binding and private media Storage.
begin;
do $$begin
 if not exists(select 1 from private.lifecycle_worker_schedule where singleton and project_ref='tlwfpivafcokcjyjwgmq') then
  raise exception 'Expected the existing Fabelpad staging project';
 end if;
end$$;
select private.configure_blog_installation(
 'staging',
 'https://staging.fabelpad.nl',
 'tlwfpivafcokcjyjwgmq',
 'https://socialhero-staging.dgwebservices.nl',
 'https://fabelpad.nl'
);
select private.configure_blog_storage();
notify pgrst, 'reload schema';
commit;

-- Phase 2: arm recovery only after blog-runtime has been deployed and checked.
-- The owner routine creates a Vault HMAC and an idempotent minute cron. It does
-- not reveal that secret or activate any SocialHero connection.
begin;
do $$begin
 if not exists(select 1 from private.blog_installation where singleton and environment='staging' and project_ref='tlwfpivafcokcjyjwgmq' and origin='https://staging.fabelpad.nl' and canonical_origin='https://fabelpad.nl' and socialhero_origin='https://socialhero-staging.dgwebservices.nl') then
  raise exception 'Expected the explicitly configured Fabelpad staging blog';
 end if;
end$$;
select private.configure_blog_worker_schedule();
notify pgrst, 'reload schema';
commit;
