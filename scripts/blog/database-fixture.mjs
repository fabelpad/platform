import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {installBillingFixture} from '../billing/database-fixture.mjs';
import {currentLegalVersions} from '../legal-fixture.mjs';
export async function blogDatabaseFixture(){
 const db=new PGlite({extensions:{pgcrypto}}),execute=db.exec.bind(db);
 let legacyBefore,legacyAfter;
 const legacyFingerprint=async()=> (await db.query(`select md5(jsonb_build_object(
 'families',(select jsonb_agg(to_jsonb(f) order by f.parent_id) from public.family_documents f),
 'releases',(select jsonb_agg(to_jsonb(r) order by r.story_id,r.content_version) from public.content_releases r),
 'billing',(select to_jsonb(b) from private.billing_control b where singleton),
 'narration',(select to_jsonb(n) from private.narration_control n where singleton))::text) fingerprint`)).rows[0].fingerprint;
 // Seed actual pre-existing rows immediately before the new additive migration,
 // while the shared fixture still executes every chronological SQL migration.
 db.exec=async source=>{
  if(typeof source==='string'&&source.includes('create table private.blog_installation (')){
   if(legacyBefore)throw new Error('Blog migration fixture was applied twice');
   const legacy='00000000-0000-4000-8000-000000000799';
   await db.query("insert into auth.users(id,email,email_confirmed_at)values($1,'legacy-fixture@example.test',now())",[legacy]);
   await db.query('insert into public.family_documents(parent_id,revision,snapshot)values($1,1,$2)',[legacy,{schemaVersion:1,family:{version:1,children:[{id:'legacy-child',name:'Voorbeeld',avatar:0,birthDate:'2020-01-01'}],activeId:'legacy-child'},data:{'legacy-child':{prefs:{muted:false,calm:false,textSize:'normal'}}}}]);
   await db.query("insert into public.content_releases(story_id,content_version,payload)values('station','1111111111111111',$1)",[{metadata:{title:'Ongewijzigd bestaand verhaal'},parts:5,scenes:{},endings:{}}]);
   legacyBefore=await legacyFingerprint();const result=await execute(source);legacyAfter=await legacyFingerprint();return result;
  }
  return execute(source);
 };
 try{await installBillingFixture(db);}catch(error){await db.close();throw error;}finally{db.exec=execute;}
 await db.exec("select private.configure_blog_installation('staging','https://staging.fabelpad.nl','tlwfpivafcokcjyjwgmq','https://socialhero.example.test','https://fabelpad.nl');");
 const legal=await currentLegalVersions(db);const actor='00000000-0000-4000-8000-000000000701',session='00000000-0000-4000-8000-000000000702';
 await db.query("insert into auth.users(id,email,email_confirmed_at)values($1,'blog-admin@example.test',now())",[actor]);await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[session,actor]);await db.query('insert into public.content_admins(user_id)values($1)',[actor]);
 const owner=()=>db.exec('reset role');
 const admin=async()=>{await owner();await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,session_id:session,amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec('set role authenticated');};
 const service=async()=>{await owner();await db.query("select set_config('request.jwt.claims','{}',false)");await db.exec('set role service_role');};
 const anonymous=async()=>{await owner();await db.query("select set_config('request.jwt.claims','{}',false)");await db.exec('set role anon');};
 await admin();await db.query('select public.complete_parent_onboarding($1,$2,true,true)',[legal.terms,legal.privacy]);await owner();
 const rpc=async(name,action,input={})=>(await db.query(`select public.${name}($1,$2) result`,[action,input])).rows[0].result;
 return {db,actor,session,owner,admin,service,anonymous,rpc,legacyBefore,legacyAfter};
}
