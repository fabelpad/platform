import {readFile,readdir} from 'node:fs/promises';
import {installEmailVaultTestFixture,localMigrationSql} from '../email/settings-db-fixture.mjs';
export async function installBillingFixture(db,{beforeBilling}={}) {
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}',raw_app_meta_data jsonb not null default '{}');
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
 await installEmailVaultTestFixture(db);
 const path=new URL('../../supabase/migrations/',import.meta.url);const names=(await readdir(path)).filter(n=>n.endsWith('.sql')).sort();
 for(const name of names){if(name.includes('_billing_entitlements_')&&beforeBilling)await beforeBilling(db);await db.exec(localMigrationSql(await readFile(new URL(name,path),'utf8')));}
}
