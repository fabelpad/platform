import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {installEmailVaultTestFixture,localMigrationSql} from './email/settings-db-fixture.mjs';
const {PGlite}=await import(process.env.FABELPAD_PGLITE_MODULE??'@electric-sql/pglite');
const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
const db=new PGlite({extensions:{pgcrypto}});
const staging='tlwfpivafcokcjyjwgmq',production='aptprpkosqctwrzeetgs';
const configure=async ref=>(await db.query('select private.configure_lifecycle_worker($1) result',[ref])).rows[0].result;
async function denied(sql,args=[],code='42501'){await assert.rejects(db.query(sql,args),error=>error.code===code);}
let clock='2026-11-22T12:00:00Z',counter=0;
const nonce=()=>`bbbbbbbb-bbbb-4bbb-8bbb-${String(++counter).padStart(12,'0')}`;
async function tick(value){clock=value;await db.exec('reset role');await db.exec(`create or replace function private.lifecycle_now() returns timestamptz language sql volatile set search_path='' as $$select '${value}'::timestamptz$$`);}
async function verify(proof){return(await db.query('select public.verify_lifecycle_worker_request($1,$2,$3) result',[proof.nonce,proof.issuedAt,proof.signature])).rows[0].result;}
async function service(){await db.exec('reset role');await db.query("select set_config('request.jwt.claims','{}',false)");await db.exec('set role service_role');}
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}');
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
 await installEmailVaultTestFixture(db);
 for(const file of(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await db.exec(localMigrationSql(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')));
 await tick(clock);
 await denied('select private.invoke_lifecycle_worker()',[],'55000');
 for(const ref of ['unknown',null,staging+'.evil.example'])await assert.rejects(configure(ref),e=>e.code==='22023');
 assert.equal((await db.query('select count(*)::int n from vault.secrets')).rows[0].n,0);
 // The actual provider can grant PUBLIC queue access and prevent revocation.
 // Preserve that ACL: the signed protocol must remain safe without changing it.
 await db.exec('grant usage on schema net to public;grant all on net.http_request_queue to public');
 const originalAcl=(await db.query("select relacl::text acl from pg_class where oid='net.http_request_queue'::regclass")).rows[0].acl;
 await db.query("select cron.schedule('fabelpad-account-maintenance','*/5 * * * *','select 123;')");await denied('select private.configure_lifecycle_worker($1)',[staging],'55000');
 assert.equal((await db.query('select count(*)::int n from vault.secrets')).rows[0].n,0,'Conflicting installation is atomic');
 assert.equal((await db.query("select command from cron.job where jobname='fabelpad-account-maintenance'")).rows[0].command,'select 123;');await db.exec('delete from cron.job');
 const configured=await configure(staging);assert.equal(configured.projectRef,staging);assert.equal(configured.schedule,'* * * * *');assert.equal(configured.configured,true);assert.equal(configured.authentication,'hmac-sha256-single-use-v1');assert.doesNotMatch(JSON.stringify(configured),/Bearer|secret|token/i);
 let secret=(await db.query("select decrypted_secret from vault.decrypted_secrets where name='fabelpad_lifecycle_worker_token'")).rows[0].decrypted_secret;
 assert.match(secret,/^[a-f0-9]{64}$/);assert.equal((await db.query('select count(*)::int n from vault.secrets')).rows[0].n,1);
 const sign=(proof,target=staging)=>({...proof,signature:createHmac('sha256',Buffer.from(secret,'hex')).update(['fabelpad-lifecycle-worker-v1',target,proof.nonce,String(proof.issuedAt)].join('\n')).digest('hex')});
 const configAgain=await configure(staging);assert.equal(configAgain.cronJobId,configured.cronJobId);assert.equal((await db.query('select count(*)::int n from cron.job')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from vault.test_writes')).rows[0].n,1);
 await assert.rejects(configure(production),e=>e.code==='22023');
 const job=(await db.query('select * from cron.job')).rows[0];assert.equal(job.command,'select private.invoke_lifecycle_worker();');assert.equal(job.command.includes(secret),false);
 await db.query('select private.invoke_lifecycle_worker()');let queued=(await db.query('select * from net.http_request_queue')).rows[0];
 assert.equal(queued.url,'https://'+staging+'.supabase.co/functions/v1/account-maintenance');assert.deepEqual(Object.keys(queued.body).sort(),['issuedAt','nonce','signature']);assert.deepEqual(queued.headers,{'Content-Type':'application/json'});assert.equal(queued.timeout_milliseconds,45000);assert.equal(JSON.stringify(queued).includes(secret),false,'Neither header, URL nor body contains the reusable Vault key');assert.equal(queued.body.signature,sign(queued.body).signature,'Real PostgreSQL pgcrypto matches independent Node HMAC bytes');
 assert.equal((await db.query('select inactivity_enabled from private.lifecycle_controls')).rows[0].inactivity_enabled,false);
 assert.equal((await db.query("select relacl::text acl from pg_class where oid='net.http_request_queue'::regclass")).rows[0].acl,originalAcl,'No provider ACL changes are needed');
 await service();assert.equal(await verify(queued.body),true);assert.equal(await verify(queued.body),false,'A visible request can trigger only once');
 const issuedAt=Date.parse(clock)/1000;
 const valid=sign({nonce:nonce(),issuedAt});assert.deepEqual((await Promise.all([verify(valid),verify(valid)])).sort(),[false,true],'Nonce consumption is atomic under repeated calls');
 for(const proof of [sign({nonce:nonce(),issuedAt:issuedAt-91}),sign({nonce:nonce(),issuedAt:issuedAt+16}),sign({nonce:nonce(),issuedAt},production),{...sign({nonce:nonce(),issuedAt}),signature:'0'.repeat(64)},{...sign({nonce:nonce(),issuedAt}),issuedAt:issuedAt+1}])assert.equal(await verify(proof),false);
 assert.equal(await verify(sign({nonce:nonce(),issuedAt:issuedAt-90})),true,'Exactly 90 seconds old is permitted');assert.equal(await verify(sign({nonce:nonce(),issuedAt:issuedAt+15})),true,'Explicit future-skew boundary is 15 seconds');
 const first=sign({nonce:nonce(),issuedAt});assert.equal(await verify(first),true);assert.equal(await verify(sign({...first,issuedAt:issuedAt+1})),false,'Same nonce cannot be reused with a changed valid signature');
 await tick('2026-11-22T12:01:31Z');await service();assert.equal(await verify(queued.body),false,'Expired visible proofs cannot be replayed');assert.equal(await verify(sign({nonce:nonce(),issuedAt:Date.parse(clock)/1000})),true);await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from private.lifecycle_worker_nonces where expires_at<private.lifecycle_now()')).rows[0].n,0,'Valid new requests clean expired nonce metadata');
 await db.exec("update cron.job set active=false where jobname='fabelpad-account-maintenance'");await assert.rejects(configure(staging),e=>e.code==='55000');await db.exec('update cron.job set active=true');
 await db.exec("update vault.secrets set secret='invalid' where name='fabelpad_lifecycle_worker_token'");await denied('select private.invoke_lifecycle_worker()',[],'55000');await denied('select private.configure_lifecycle_worker($1)',[staging],'55000');await db.query("update vault.secrets set secret=$1 where name='fabelpad_lifecycle_worker_token'",[secret]);
 for(const role of ['anon','authenticated','service_role']){
  await db.exec(`set role ${role}`);await denied('select private.configure_lifecycle_worker($1)',[staging]);await denied('select private.invoke_lifecycle_worker()');await denied('select * from private.lifecycle_worker_schedule');await denied('select * from vault.decrypted_secrets');await denied('select * from private.lifecycle_worker_nonces');assert.equal((await db.query('select headers,body from net.http_request_queue')).rows.length,1,'Public platform queue contains only short one-use proof');
  if(role!=='service_role')await denied('select public.verify_lifecycle_worker_request($1,$2,$3)',[nonce(),issuedAt,'0'.repeat(64)]);await db.exec('reset role');
 }
 await db.exec('delete from cron.job;delete from private.lifecycle_worker_schedule;delete from vault.secrets;delete from net.http_request_queue');await configure(production);await db.query('select private.invoke_lifecycle_worker()');queued=(await db.query('select url,headers,body from net.http_request_queue')).rows[0];assert.equal(queued.url,'https://'+production+'.supabase.co/functions/v1/account-maintenance');assert.equal('Authorization' in queued.headers,false);
 secret=null;
 console.log('Lifecycle scheduler SQL checks passed: real pgcrypto HMAC versus Node crypto, own-project binding, exact 90s/15s window, atomic one-use nonce/replay protection and expiry cleanup, no reusable key in a PUBLIC queue, preserved provider ACLs, target pinning, idempotency, conflicts and application-role revokes. 90-day automation remains disabled.');
 console.log('Only cron/pg_net transport and Vault encryption are local stubs; HMAC/PostgreSQL application logic and permissions run for real. Hosted HTTP response, provider mail and true multi-connection contention require separate rollout evidence. No credential value is printed.');
}catch(error){console.error('Lifecycle scheduler DB check failed:',error.code??error.name,error.message,error.where??'');process.exitCode=1;}finally{await db.close();}
