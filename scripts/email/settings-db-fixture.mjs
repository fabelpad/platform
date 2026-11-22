/** Test-only Vault boundary. PostgreSQL still executes real application SQL,
 * privileges, locking, CAS and transactions. This stub does NOT test encryption:
 * hosted Supabase Vault provides that, with its own external encryption key.
 * Only synthetic credentials are accepted by tests that install this fixture.
 */
export async function installEmailVaultTestFixture(db) {
  await db.exec(`
    do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $$;
    create schema vault;
    revoke all on schema vault from public,anon,authenticated,service_role;
    create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,description text,secret text not null);
    create view vault.decrypted_secrets as select *,secret as decrypted_secret from vault.secrets;
    create table vault.test_writes(operation text not null);
    create function vault.create_secret(new_secret text,new_name text default null,new_description text default null,new_key_id uuid default null) returns uuid
    language plpgsql set search_path='' as $$ declare result uuid; begin
      insert into vault.secrets(name,description,secret) values(new_name,new_description,new_secret) returning id into result;
      insert into vault.test_writes values('create'); return result;
    end $$;
    create function vault.update_secret(secret_id uuid,new_secret text default null,new_name text default null,new_description text default null,new_key_id uuid default null) returns void
    language plpgsql set search_path='' as $$ begin
      update vault.secrets set secret=coalesce(new_secret,secret),name=coalesce(new_name,name),description=coalesce(new_description,description) where id=secret_id;
      insert into vault.test_writes values('update');
    end $$;
    revoke all on all tables in schema vault from public,anon,authenticated,service_role;
    revoke all on all functions in schema vault from public,anon,authenticated,service_role;
  `);
}
