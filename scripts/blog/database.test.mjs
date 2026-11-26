import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {blogDatabaseFixture} from './database-fixture.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
// PGlite cannot load pg-safeupdate's native parse hook. Check the effective
// installed function bodies structurally instead: literals/comments and nested
// subquery WHERE clauses must never satisfy a top-level DML predicate guard.
function unboundedBlogDml(source) {
  const sql=source.replace(/'(?:''|[^'])*'|\$([a-z_][a-z0-9_]*)?\$[\s\S]*?\$\1\$|--[^\n]*|\/\*[\s\S]*?\*\//giu,match=>' '.repeat(match.length));
  const issues=[];
  for(const match of sql.matchAll(/\b(?:update|delete\s+from)\s+((?:private|public|vault|storage)\.[a-z_][a-z0-9_]*)\b/giu)) {
    const end=sql.indexOf(';',match.index),statement=sql.slice(match.index,end<0?undefined:end);let depth=0,predicate;
    for(let index=0;index<statement.length;index++) {
      if(statement[index]==='(')depth++;else if(statement[index]===')')depth--;
      else if(depth===0&&/\bwhere\b/iu.test(statement.slice(index,index+6))&&/^where\b/iu.test(statement.slice(index))) {predicate=statement.slice(index+5).trim();break;}
    }
    if(!predicate||/^(?:true\b|1\s*=\s*1\b)/iu.test(predicate))issues.push(match[1]);
  }
  return issues;
}
test('runtime DML guard rejects absent, nested-only, quoted and tautological WHERE clauses',()=>{
  for(const sql of ["update private.blog_installation set revision=1", "update private.blog_installation set revision=(select revision from private.blog_installation where singleton)","update private.blog_installation set settings='where singleton' -- where singleton","update private.blog_installation set revision=1 where true","delete from private.blog_posts /* where id=1 */"])assert.equal(unboundedBlogDml(sql).length,1);
  assert.deepEqual(unboundedBlogDml('update private.blog_installation set revision=revision+1 where singleton;delete from private.blog_posts where id=p_job_id;'),[]);
});


const denied=async(fn,code)=>assert.rejects(fn,e=>{assert.equal(e.message,code,e.where);return true;});
test('real SQL blog and SocialHero: CAS, privacy, durable workflows and credential authority',async t=>{
 const f=await blogDatabaseFixture();const {db,owner,admin,service,anonymous,rpc}=f;
 const user=(action,input={})=>rpc('blog_admin',action,input),svc=(action,input={})=>rpc('blog_service',action,input),pub=(action,input={})=>rpc('blog_public',action,input);
 const machine=async(c,action,input={})=>{await service();return(await db.query('select public.blog_connector($1,$2,$3) result',[c.hash,action,input])).rows[0].result;};
 let state,editor,document,firstPublic,connection,asset;
 const doc=(slug='eerste-artikel')=>({type:'blog',locale:'nl-NL',title:'Eerste artikel',slug,excerpt:'Een echte samenvatting.',authorId:state.defaultAuthorId,categoryId:null,tags:['voorlezen'],seo:{title:'SEO titel',description:'Veilige beschrijving'},hero:null,ogImageAssetId:null,content:{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Samen lezen'}]},{type:'paragraph',content:[{type:'text',text:'Veilige inhoud.'}]}]}});
 const pair=async(destinationId=randomUUID(),options={})=>{
  const attemptId=randomUUID(),connectionId=randomUUID(),token=randomBytes(32).toString('base64url');await admin();
  await user('pair_begin',{attemptId,code:'synthetic-pair-code',allowDraft:options.allowDraft??true,allowPublish:options.allowPublish??true});
  await user('pair_pending',{attemptId,connectionId,destinationId,accessToken:token,expiresAt:new Date(Date.now()+9*60*1000).toISOString()});
  if(options.pending!==true){await service();await svc('pair_activate',{attemptId,connectionId});}
  return {attemptId,connectionId,destinationId,hash:hash(token),token};
 };
 const publish=async(e)=>{await admin();const q=await user('publish',{postId:e.postId,revision:e.revision});await service();const {claim}=await svc('publication_claim',{publicationId:q.publicationId});const promoted=await svc('publication_promote',claim);await svc('publication_confirm',promoted);return promoted;};
 try{
  await t.test('explicit identity, private tables/helpers, narrow dispatcher grants and existing data remain intact',async()=>{
   assert.match(f.legacyBefore,/^[a-f0-9]{32}$/);assert.equal(f.legacyAfter,f.legacyBefore,'New blog migration preserves seeded family/release bytes and existing billing/narration settings');
   await admin();state=await user('list');assert.equal(state.site.origin,'https://staging.fabelpad.nl');assert.equal(state.site.siteId,'fabelpad');assert.equal(state.authors[0].name,'Fabelpad');
   await owner();for(const name of ['blog_public','blog_admin','blog_service','blog_connector']){const signature=name==='blog_connector'?`${name}(text,text,jsonb)`:`${name}(text,jsonb)`;assert.equal((await db.query('select prosecdef from pg_proc where oid=$1::regprocedure',[`public.${signature}`])).rows[0].prosecdef,false);}
   for(const role of ['anon','authenticated','service_role']){await owner();await db.exec(`set role ${role}`);await assert.rejects(db.exec('select * from private.socialhero_connections'),e=>e.code==='42501');await assert.rejects(db.exec('select private.blog_lock()'),e=>e.code==='42501');}
   await anonymous();await assert.rejects(rpc('blog_admin','list'),e=>e.code==='42501');await assert.rejects(rpc('blog_service','cleanup'),e=>e.code==='42501');
   await owner();await denied(()=>db.exec("select private.configure_blog_installation('production','https://fabelpad.nl','aptprpkosqctwrzeetgs','https://socialhero.example.test')"),'DESTINATION_MISMATCH');
  });
  await t.test('all installed blog runtime DML has a bounded top-level predicate for hosted pg-safeupdate',async()=>{
   await owner();const functions=(await db.query("select n.nspname,p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and (p.proname like 'blog_%' or p.proname like 'configure_blog_%' or p.proname='invoke_blog_worker')")).rows;
   assert.ok(functions.length>30);let mutations=0;
   for(const fn of functions){mutations+=(fn.prosrc.match(/\b(?:update|delete\s+from)\s+(?:private|public|vault|storage)\./giu)||[]).length;assert.deepEqual(unboundedBlogDml(fn.prosrc),[],fn.nspname+'.'+fn.proname);}
   assert.ok(mutations>25,'Checks actual installed runtime UPDATE/DELETE statements, not an empty function list');
  });
  await t.test('manual save, exact private preview and CAS; drafts absent from public routes and sitemap',async()=>{
   await admin();document=doc();editor=await user('save',{postId:null,baseRevision:null,document});assert.equal(editor.revision,1);assert.equal(editor.state,'draft');
   const preview=await user('preview',{postId:editor.postId,revision:1});assert.deepEqual(preview.document,document);assert.equal(preview.revision,1);
   await denied(()=>user('save',{postId:editor.postId,baseRevision:2,document}),'REVISION_CONFLICT');
   for(const invalid of [1.5,'1',0,9007199254740992]){await denied(()=>user('save',{postId:editor.postId,baseRevision:invalid,document}),'INVALID_CONTENT');await denied(()=>user('preview',{postId:editor.postId,revision:invalid}),'INVALID_CONTENT');await denied(()=>user('publish',{postId:editor.postId,revision:invalid}),'INVALID_CONTENT');}await anonymous();assert.equal((await pub('post',{slug:document.slug})).article,null);assert.equal((await pub('catalog')).total,0);assert.deepEqual((await pub('sitemap')).posts,[]);
  });
  await t.test('database independently rejects unsafe nodes, links, attributes, media and document field limits',async()=>{
   await admin();for(const mutate of [d=>d.content.content.push({type:'heading',attrs:{level:1},content:[]}),d=>d.content.content.push({type:'iframe',attrs:{src:'https://example.test'}}),d=>d.content.content[1].content[0].marks=[{type:'link',attrs:{href:'javascript:alert(1)'}}],d=>d.content.content.push({type:'image',attrs:{src:'https://example.test/x.png',assetId:randomUUID(),alt:'X'}}),d=>d.tags=Array(16).fill('tag'),d=>d.slug='s'.repeat(121),d=>d.excerpt='e'.repeat(601),d=>d.type=null,d=>d.authorId=randomUUID()]){const invalid=structuredClone(document);mutate(invalid);await denied(()=>user('save',{postId:editor.postId,baseRevision:1,document:invalid}),'INVALID_CONTENT');}
   const foreign=structuredClone(document);foreign.hero={assetId:randomUUID(),alt:'Afbeelding',focalPoint:{x:0.5,y:0.5}};await denied(()=>user('save',{postId:editor.postId,baseRevision:1,document:foreign}),'INVALID_MEDIA');
  });
  await t.test('authors/categories are real CRUD records and default author cannot be disabled',async()=>{
   await admin();const a=(await user('taxonomy',{kind:'author',id:null,name:'Redactie',bio:'Echte auteur'})).record;const c=(await user('taxonomy',{kind:'category',id:null,name:'Voorlezen'})).record;assert.ok(a.id&&c.id);assert.equal((await user('taxonomy',{kind:'category',id:c.id,name:'Samen lezen'})).record.name,'Samen lezen');await denied(()=>user('taxonomy',{kind:'author',id:state.defaultAuthorId,name:'Fabelpad',active:false}),'INVALID_CONTENT');
  });
  await t.test('publication remains publishing until real probe acknowledgement and immutable exact revision',async()=>{
   await admin();let q=await user('publish',{postId:editor.postId,revision:1});assert.equal(q.editor.state,'publishing');await anonymous();assert.equal((await pub('post',{slug:document.slug})).article,null);
   await service();let {claim}=await svc('publication_claim',{publicationId:q.publicationId});assert.ok(claim.leaseId);assert.equal((await svc('publication_claim',{publicationId:q.publicationId})).claim,null);claim=await svc('publication_promote',claim);
   await anonymous();firstPublic=(await pub('post',{slug:document.slug})).article;assert.equal(firstPublic.revision,1);await admin();assert.equal((await user('get',{postId:editor.postId})).state,'publishing');
   await service();await denied(()=>svc('publication_confirm',{...claim,proof:'wrong'}),'PUBLICATION_STALE');await svc('publication_confirm',claim);await admin();editor=await user('get',{postId:editor.postId});assert.equal(editor.state,'published');assert.equal(editor.publishedRevision,1);assert.equal(editor.draftRevision,null);
   await owner();await denied(()=>db.query("update private.blog_revisions set document='{}' where post_id=$1",[editor.postId]),'IMMUTABLE_REVISION');
  });
  await t.test('draft edits preserve live bytes/dates/URL; stale queued job cannot publish local newer work',async()=>{
   await admin();let changed={...document,title:'Aangepaste titel',slug:'volgende-url'};editor=await user('save',{postId:editor.postId,baseRevision:1,document:changed});let q=await user('publish',{postId:editor.postId,revision:2});editor=await user('save',{postId:editor.postId,baseRevision:2,document:{...changed,title:'Nieuwere lokale wijziging'}});
   await anonymous();assert.deepEqual((await pub('post',{slug:document.slug})).article,firstPublic);assert.equal((await pub('post',{slug:'volgende-url'})).article,null);
   await service();const {claim}=await svc('publication_claim',{publicationId:q.publicationId});await denied(()=>svc('publication_promote',claim),'PUBLICATION_STALE');await svc('publication_fail',{...claim,code:'PUBLICATION_STALE'});
   await anonymous();assert.deepEqual((await pub('post',{slug:document.slug})).article,firstPublic);
  });
  await t.test('conscious slug publish atomically redirects all history directly; reserved slugs cannot be stolen',async()=>{
   await publish(editor);await anonymous();assert.equal((await pub('post',{slug:document.slug})).redirect,'/blog/volgende-url');
   await admin();await denied(()=>user('save',{postId:null,baseRevision:null,document:doc(document.slug)}),'SLUG_CONFLICT');editor=await user('get',{postId:editor.postId});editor=await user('save',{postId:editor.postId,baseRevision:editor.revision,document:{...editor.document,slug:'laatste-url'}});await publish(editor);await anonymous();for(const slug of [document.slug,'volgende-url'])assert.equal((await pub('post',{slug})).redirect,'/blog/laatste-url');
  });
  await t.test('pending capability-only handshake, durable resume and explicit default-on policy audit',async()=>{
   connection=await pair(randomUUID(),{pending:true});const caps=await machine(connection,'capabilities');assert.equal(caps.credentialState,'pending');assert.deepEqual(caps.scopes,['read','draft','publish']);assert.deepEqual(caps.media.mimeTypes,['image/png','image/jpeg']);await denied(()=>machine(connection,'get',{externalId:'x'}),'PAIRING_IN_PROGRESS');
   await admin();assert.equal((await user('pair_resume')).attemptId,connection.attemptId);await service();assert.equal((await svc('pair_context',{attemptId:connection.attemptId})).accessToken,connection.token);await svc('pair_activate',{attemptId:connection.attemptId,connectionId:connection.connectionId});assert.equal((await machine(connection,'capabilities')).credentialState,'active');
   await owner();assert.equal((await db.query('select count(*)::int n from vault.secrets where name like \'fabelpad_blog_pair_%\'')).rows[0].n,0);assert.equal((await db.query('select allow_publish,actor_id,environment from private.socialhero_policy_audit order by decided_at desc limit 1')).rows[0].allow_publish,true);
  });
  await t.test('active connection check updates the actual credential timestamp and rejects stale selection',async()=>{
   await owner();await db.query("update private.socialhero_connections set last_checked_at='2020-01-01' where id=$1",[connection.connectionId]);await admin();
   const checked=await user('connection_check',{connectionId:connection.connectionId});assert.equal(checked.connectionId,connection.connectionId);assert.ok(Date.parse(checked.lastCheckedAt)>Date.parse('2020-01-01'));
   await denied(()=>user('connection_check',{connectionId:randomUUID()}),'DESTINATION_MISMATCH');
   await owner();const before=(await db.query('select last_checked_at from private.socialhero_connections where id=$1',[connection.connectionId])).rows[0].last_checked_at;
   await db.query('delete from auth.sessions where id=$1',[f.session]);await admin();await assert.rejects(user('connection_check'));await owner();
   assert.deepEqual((await db.query('select last_checked_at from private.socialhero_connections where id=$1',[connection.connectionId])).rows[0].last_checked_at,before);await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[f.session,f.actor]);
  });
  let remote;
  await t.test('durable mapping/idempotency exactly once after lost result; local edits cause revision conflict',async()=>{
   const input={externalId:'remote-1',baseRevision:null,document:doc('socialhero-concept'),idempotencyKey:'draft-1',fingerprint:hash('original markdown')};remote=await machine(connection,'put',input);assert.deepEqual(await machine(connection,'put',input),remote);
   await denied(()=>machine(connection,'put',{...input,fingerprint:hash('changed content')}),'IDEMPOTENCY_CONFLICT');await admin();let local=await user('get',{postId:remote.postId});await user('save',{postId:remote.postId,baseRevision:local.revision,document:{...local.document,title:'Lokale redactiebewerking'}});await denied(()=>machine(connection,'put',{...input,baseRevision:1,idempotencyKey:'draft-2'}),'REVISION_CONFLICT');
   const current=await machine(connection,'get',{externalId:'remote-1'});assert.equal(current.revision,2);await owner();assert.equal((await db.query('select count(*)::int n from private.socialhero_post_mappings where external_id=\'remote-1\'')).rows[0].n,1);
  });
  await t.test('local publish withdrawal is immediate, draft remains possible and reconnect preserves explicit opt-out',async()=>{
   await admin();await user('connection_policy',{connectionId:connection.connectionId,allowDraft:true,allowPublish:false});await denied(()=>machine(connection,'publish',{externalId:'remote-1',revision:2,idempotencyKey:'pub-denied',fingerprint:hash('pub2')}),'PERMISSION_DENIED');
   const old=connection;connection=await pair(connection.destinationId);assert.deepEqual((await machine(connection,'capabilities')).scopes,['read','draft']);assert.equal((await machine(connection,'get',{externalId:'remote-1'})).postId,remote.postId);await denied(()=>machine(old,'capabilities'),'INVALID_CREDENTIAL');await admin();await denied(()=>user('connection_policy',{connectionId:old.connectionId,allowDraft:true,allowPublish:true}),'DESTINATION_MISMATCH');
  });
  await t.test('media reservation is durable, private, lease-bound and site/destination constrained',async()=>{
   const input={idempotencyKey:'media-1',fingerprint:hash('synthetic image'),sha256:hash('synthetic image'),byteLength:20,mimeType:'image/png',width:2,height:2};asset=await machine(connection,'media_reserve',input);assert.equal((await machine(connection,'media_reserve',input)).assetId,asset.assetId);await anonymous();assert.equal(await pub('media',{assetId:asset.assetId}),null);
   await service();await denied(()=>svc('media_complete',{assetId:asset.assetId,leaseId:randomUUID()}),'LEASE_EXPIRED');await svc('media_complete',{assetId:asset.assetId,leaseId:asset.leaseId});await admin();assert.equal((await user('media_get',{assetId:asset.assetId})).sha256,input.sha256);await anonymous();assert.equal(await pub('media',{assetId:asset.assetId}),null);
   await denied(()=>machine(connection,'media_reserve',{...input,idempotencyKey:'bad-svg',mimeType:'image/svg+xml'}),'INVALID_MEDIA');
  });
  await t.test('withdrawn policy/revoked credential blocks previously queued publication before live switch',async()=>{
   await admin();await user('connection_policy',{connectionId:connection.connectionId,allowDraft:true,allowPublish:true});let q=await machine(connection,'publish',{externalId:'remote-1',revision:2,idempotencyKey:'pub-2',fingerprint:hash('pub2')});await admin();await user('connection_policy',{connectionId:connection.connectionId,allowDraft:true,allowPublish:false});await service();const {claim}=await svc('publication_claim',{publicationId:q.publicationId});await denied(()=>svc('publication_promote',claim),'PERMISSION_DENIED');await svc('publication_fail',{...claim,code:'PERMISSION_DENIED'});await anonymous();assert.equal((await pub('post',{slug:'socialhero-concept'})).article,null);
  });
  await t.test('destination isolation and specific-credential revoke cannot affect replacement connection',async()=>{
   const previous=connection;const other=await pair();await denied(()=>machine(other,'get',{externalId:'remote-1'}),'POST_NOT_FOUND');await denied(()=>machine(previous,'capabilities'),'INVALID_CREDENTIAL');
   connection=await pair(previous.destinationId);await admin();await user('connection_revoke',{connectionId:previous.connectionId});assert.equal((await machine(connection,'capabilities')).credentialState,'active');assert.equal((await machine(connection,'get',{externalId:'remote-1'})).postId,remote.postId);
   await machine(connection,'revoke');await denied(()=>machine(connection,'capabilities'),'INVALID_CREDENTIAL');
  });
  await t.test('owner-only Storage/cron bootstrap, HMAC body binding and replay rejection',async()=>{
   await owner();await db.exec('create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');await db.exec('select private.configure_blog_worker_schedule()');assert.equal((await db.query("select public from storage.buckets where id='fabelpad-blog'")).rows[0].public,false);await db.exec('select private.invoke_blog_worker()');const request=(await db.query("select * from net.http_request_queue where url like '%blog-runtime/worker' order by id desc limit 1")).rows[0];assert.equal(request.url,'https://tlwfpivafcokcjyjwgmq.supabase.co/functions/v1/blog-runtime/worker');const proof={timestamp:Number(request.headers['x-fabelpad-timestamp']),nonce:request.headers['x-fabelpad-nonce'],signature:request.headers['x-fabelpad-signature'],bodySha256:hash('{}')};await service();assert.equal((await svc('worker_verify',{...proof,bodySha256:hash('changed')})).valid,false);assert.equal((await svc('worker_verify',proof)).valid,true);assert.equal((await svc('worker_verify',proof)).valid,false);
  });
  await t.test('all supported rich-text nodes remain valid while malformed structural contexts are rejected',async()=>{
   await owner();const text={type:'text',text:'Veilig',marks:[{type:'bold'},{type:'italic'},{type:'underline'},{type:'strike'},{type:'code'},{type:'highlight',attrs:{color:'#ffcc00'}},{type:'link',attrs:{href:'/blog/laatste-url',target:'_blank',rel:'noopener noreferrer'}}]};
   const paragraph={type:'paragraph',content:[text,{type:'hardBreak'},{type:'text',text:'Verder'}]};
   const content={type:'doc',content:[paragraph,{type:'heading',attrs:{level:4},content:[{type:'text',text:'Kop'}]},{type:'bulletList',content:[{type:'listItem',content:[paragraph]}]},{type:'orderedList',attrs:{start:1000000},content:[{type:'listItem',content:[paragraph]}]},{type:'blockquote',content:[paragraph]},{type:'horizontalRule'},{type:'codeBlock',attrs:{language:'js'},content:[{type:'text',text:'const x = 1;'}]},{type:'image',attrs:{assetId:asset.assetId,alt:'Eigen afbeelding'}},{type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',attrs:{colspan:1,rowspan:100,colwidth:[200]},content:[paragraph]},{type:'tableCell',attrs:{colspan:12,rowspan:1,colwidth:null},content:[paragraph]}]}]}]};
   assert.equal((await db.query('select private.blog_valid_node($1) result',[content])).rows[0].result,true);
   for(const invalid of [{type:'doc',content:[{type:'text',text:'los'}]},{type:'doc',content:[{type:'heading',attrs:{level:'2'},content:[]}]},{type:'doc',content:[{type:'tableRow',content:[]}]},{type:'doc',content:[{type:'paragraph',content:[{type:'image',attrs:{assetId:asset.assetId,alt:'X'}}]}]}])assert.equal((await db.query('select private.blog_valid_node($1) result',[invalid])).rows[0].result,false);
  });
  await t.test('hard crash on final publication lease frees the durable slot while retaining the existing live revision',async()=>{
   await anonymous();const before=(await pub('post',{slug:'laatste-url'})).article;await admin();editor=await user('get',{postId:editor.postId});editor=await user('save',{postId:editor.postId,baseRevision:editor.revision,document:{...editor.document,title:'Herstel na workercrash'}});
   const original=await user('publish',{postId:editor.postId,revision:editor.revision});await owner();await db.query("update private.blog_publications set state='working',attempts=8,lease_id=$2,lease_until=clock_timestamp()-interval '1 second' where id=$1",[original.publicationId,randomUUID()]);
   await service();await svc('cleanup');assert.equal((await svc('publication_claim',{publicationId:original.publicationId})).claim,null);await anonymous();assert.deepEqual((await pub('post',{slug:'laatste-url'})).article,before);
   await admin();const replacement=await user('publish',{postId:editor.postId,revision:editor.revision});assert.notEqual(replacement.publicationId,original.publicationId);await service();const {claim}=await svc('publication_claim',{publicationId:replacement.publicationId});assert.equal(claim.revision,editor.revision);await svc('publication_fail',{...claim,code:'PUBLICATION_STALE'});
  });
  await t.test('pairing bearer is opaque URL-safe 43..1024 and new attempts have a durable actor quota with free exact retries',async()=>{
   await owner();await db.query("update private.socialhero_pairing_attempts set created_at=clock_timestamp()-interval '11 minutes' where actor_id=$1",[f.actor]);
   const inputs=[];for(let index=0;index<10;index++){const input={attemptId:randomUUID(),code:'quota-code-'+index,allowDraft:true,allowPublish:true};inputs.push(input);await admin();await user('pair_begin',input);}
   await user('pair_begin',inputs[0]);await denied(()=>user('pair_begin',{...inputs[0],attemptId:randomUUID()}),'RATE_LIMITED');
   await owner();assert.equal((await db.query("select count(*)::int n from private.socialhero_pairing_attempts where actor_id=$1 and created_at>clock_timestamp()-interval '10 minutes'",[f.actor])).rows[0].n,10);
   await admin();const attemptId=inputs[9].attemptId,connectionId=randomUUID(),destinationId=randomUUID(),expiresAt=new Date(Date.now()+8*60*1000).toISOString();
   for(const accessToken of ['a'.repeat(42),'a'.repeat(1025),'a'.repeat(43)+'+','a'.repeat(43)+'=','a'.repeat(43)+' '])await denied(()=>user('pair_pending',{attemptId,connectionId,destinationId,expiresAt,accessToken}),'DESTINATION_MISMATCH');
   const accessToken='a_-'.repeat(100);await user('pair_pending',{attemptId,connectionId,destinationId,expiresAt,accessToken});await service();assert.equal((await svc('pair_context',{attemptId})).accessToken,accessToken);await svc('pair_fail',{attemptId,definitive:true,code:'FIXTURE_DONE'});
  });
  await t.test('definitive Auth deletion redacts actor links without blocking deletion or changing revision bytes',async()=>{
   await owner();const before=(await db.query('select post_id,revision,document,content_hash from private.blog_revisions order by post_id,revision')).rows;
   await db.query('delete from auth.users where id=$1',[f.actor]);
   assert.deepEqual((await db.query('select post_id,revision,document,content_hash from private.blog_revisions order by post_id,revision')).rows,before);
   assert.equal((await db.query('select count(*)::int n from private.blog_revisions where actor_id=$1',[f.actor])).rows[0].n,0);
  });
 }finally{await db.close();}
});
