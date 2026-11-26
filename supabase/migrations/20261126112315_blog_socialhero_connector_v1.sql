-- Independent receiving-site blog. No family/story/billing/narration data changes.
-- The four public RPC dispatchers have explicit grants; every table is private.
create table private.blog_installation (
 singleton boolean primary key default true check(singleton), site_id text not null unique check(site_id='fabelpad'),
 environment text not null check(environment in ('local','staging','production')), origin text not null,
 canonical_origin text not null, project_ref text not null, socialhero_origin text not null,
 configured_at timestamptz not null default clock_timestamp(), binding_generation bigint not null default 0,
 active_connection_id uuid, current_attempt_id uuid, allow_draft boolean not null default true, allow_publish boolean not null default true,
 check(not allow_publish or allow_draft)
);
create table private.blog_authors (id uuid primary key default gen_random_uuid(),site_id text not null default 'fabelpad',name text not null check(length(btrim(name)) between 1 and 160),bio text not null default '' check(length(bio)<=2000),active boolean not null default true,is_default boolean not null default false,updated_at timestamptz not null default clock_timestamp());
create unique index blog_default_author on private.blog_authors(site_id) where is_default;
insert into private.blog_authors(name,is_default) values('Fabelpad',true);
create table private.blog_categories (id uuid primary key default gen_random_uuid(),site_id text not null default 'fabelpad',name text not null check(length(btrim(name)) between 1 and 160),bio text not null default '' check(length(bio)<=2000),active boolean not null default true,updated_at timestamptz not null default clock_timestamp(),unique(site_id,name));
create table private.blog_posts (
 id uuid primary key default gen_random_uuid(),site_id text not null default 'fabelpad',locale text not null check(locale='nl-NL'),
 revision bigint not null check(revision between 1 and 9007199254740991),draft_revision bigint,live_revision bigint,verified_revision bigint,
 published_at timestamptz,updated_at timestamptz not null default clock_timestamp()
);
create table private.blog_revisions (
 post_id uuid not null references private.blog_posts(id),revision bigint not null check(revision between 1 and 9007199254740991),
 document jsonb not null check(octet_length(document::text)<=2097152),content_hash text not null,
 author_snapshot jsonb not null,category_snapshot jsonb,created_at timestamptz not null default clock_timestamp(),
 actor_kind text not null check(actor_kind in ('admin','socialhero')),actor_id uuid references auth.users(id) on delete set null,connection_id uuid,
 primary key(post_id,revision)
);
create table private.blog_slug_claims (site_id text not null,locale text not null,slug text not null check(slug~'^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=160),post_id uuid not null references private.blog_posts(id),ever_published boolean not null default false,primary key(site_id,locale,slug));
create index blog_slug_claims_post on private.blog_slug_claims(post_id);
create table private.socialhero_destinations (site_id text not null,destination_id uuid not null,allow_draft boolean not null default true,allow_publish boolean not null default true,policy_actor_id uuid references auth.users(id) on delete set null,policy_at timestamptz not null default clock_timestamp(),created_at timestamptz not null default clock_timestamp(),primary key(site_id,destination_id),check(not allow_publish or allow_draft));
create table private.socialhero_pairing_attempts (id uuid primary key,site_id text not null,actor_id uuid references auth.users(id) on delete set null,session_id uuid not null,generation bigint not null,allow_draft boolean not null,allow_publish boolean not null,state text not null check(state in ('claiming','pending','active','expired','rejected')),code_hash text not null,code_secret_id uuid,token_secret_id uuid,connection_id uuid,expires_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),last_error text);
create table private.socialhero_connections (id uuid primary key,site_id text not null,destination_id uuid not null,token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),state text not null check(state in ('pending','active','revoked','expired')),attempt_id uuid not null references private.socialhero_pairing_attempts(id),supersedes_id uuid,expires_at timestamptz not null,connected_at timestamptz,last_checked_at timestamptz,revoked_at timestamptz,foreign key(site_id,destination_id) references private.socialhero_destinations(site_id,destination_id));
create table private.socialhero_policy_audit(id uuid primary key default gen_random_uuid(),site_id text not null,destination_id uuid not null,environment text not null,allow_draft boolean not null,allow_publish boolean not null,actor_id uuid references auth.users(id) on delete set null,decided_at timestamptz not null default clock_timestamp(),source text not null check(source in ('pair','admin')),foreign key(site_id,destination_id) references private.socialhero_destinations(site_id,destination_id));
create index socialhero_policy_audit_actor on private.socialhero_policy_audit(actor_id);
create index socialhero_attempt_expiry on private.socialhero_pairing_attempts(expires_at) where state in ('claiming','pending');
create table private.socialhero_post_mappings (site_id text not null,destination_id uuid not null,external_id text not null check(length(external_id) between 1 and 200),post_id uuid not null references private.blog_posts(id),primary key(site_id,destination_id,external_id),foreign key(site_id,destination_id) references private.socialhero_destinations(site_id,destination_id));
create index socialhero_mapping_post on private.socialhero_post_mappings(post_id);
create table private.socialhero_operations (site_id text not null,destination_id text not null,operation text not null,operation_key text not null check(length(operation_key) between 1 and 200),fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),response jsonb,asset_id uuid,publication_id uuid,created_at timestamptz not null default clock_timestamp(),primary key(site_id,destination_id,operation,operation_key));
create table private.blog_media (
 id uuid primary key default gen_random_uuid(),site_id text not null,destination_id uuid,sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 byte_length integer not null check(byte_length between 1 and 8388608),mime_type text not null check(mime_type in ('image/png','image/jpeg')),
 width integer not null check(width between 1 and 6000),height integer not null check(height between 1 and 6000),
 object_path text not null unique,state text not null check(state in ('reserved','ready')),lease_id uuid not null,lease_until timestamptz not null,
 actor_id uuid references auth.users(id) on delete set null,session_id uuid,connection_id uuid,created_at timestamptz not null default clock_timestamp(),
 check(width::bigint*height<=8000000)
);
create table private.blog_revision_assets (post_id uuid not null,revision bigint not null,asset_id uuid not null references private.blog_media(id),primary key(post_id,revision,asset_id),foreign key(post_id,revision) references private.blog_revisions(post_id,revision));
create index blog_revision_assets_media on private.blog_revision_assets(asset_id);
create table private.blog_publications (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references private.blog_posts(id),revision bigint not null,
 state text not null check(state in ('queued','working','published','cancelled')),proof text not null default encode(extensions.gen_random_bytes(32),'hex'),
 actor_id uuid references auth.users(id) on delete set null,session_id uuid,connection_id uuid,
 attempts integer not null default 0,lease_id uuid,lease_until timestamptz,next_attempt_at timestamptz not null default clock_timestamp(),
 promoted_at timestamptz,verified_at timestamptz,last_error text,created_at timestamptz not null default clock_timestamp(),
 foreign key(post_id,revision) references private.blog_revisions(post_id,revision)
);
create unique index blog_publication_inflight on private.blog_publications(post_id) where state in ('queued','working');
create index blog_publication_queue on private.blog_publications(next_attempt_at,created_at) where state in ('queued','working');
create index blog_publication_actor on private.blog_publications(actor_id);
create index blog_media_actor on private.blog_media(actor_id);
create index blog_revisions_actor on private.blog_revisions(actor_id);
create index blog_attempt_actor on private.socialhero_pairing_attempts(actor_id,created_at desc);
create index blog_posts_latest on private.blog_posts(site_id,published_at desc,id) where live_revision is not null;

do $$ declare t text;begin foreach t in array array['blog_installation','blog_authors','blog_categories','blog_posts','blog_revisions','blog_slug_claims','socialhero_destinations','socialhero_policy_audit','socialhero_pairing_attempts','socialhero_connections','socialhero_post_mappings','socialhero_operations','blog_media','blog_revision_assets','blog_publications'] loop execute 'alter table private.'||t||' enable row level security';execute 'revoke all on private.'||t||' from public,anon,authenticated,service_role';end loop;end$$;

create function private.blog_fail(p_code text) returns void language plpgsql set search_path='' as $$begin raise exception '%',p_code using errcode='P0001';end$$;
create function private.blog_lock() returns void language sql volatile set search_path='' as $$select pg_advisory_xact_lock(1633837926,973)$$;
create function private.blog_hash(p jsonb) returns text language sql immutable set search_path='' as $$select encode(extensions.digest(private.canonical_content_json(p),'sha256'),'hex')$$;
create function private.blog_only(p jsonb,p_keys text[]) returns boolean language sql immutable set search_path='' as $$select jsonb_typeof(p)='object' and not exists(select 1 from jsonb_object_keys(p) k where not(k=any(p_keys)))$$;
create function private.blog_uuid(p text) returns boolean language sql immutable set search_path='' as $$select coalesce(p~*'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false)$$;
create function private.blog_string(p jsonb,p_max integer,p_empty boolean default false) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='string' and (p_empty or length(btrim(p#>>'{}'))>0) and length(p#>>'{}')<=p_max and (p#>>'{}')!~'[\x01-\x08\x0B\x0C\x0E-\x1F]',false)$$;
-- Revision JSON must be an integer, never a rounded decimal or a string.
create function private.blog_revision_value(p jsonb,p_nullable boolean default false) returns bigint language plpgsql immutable set search_path='' as $$begin
 if p_nullable and (p is null or p='null'::jsonb) then return null;end if;
 if jsonb_typeof(p) is distinct from 'number' or p::text!~'^[1-9][0-9]{0,15}$' then perform private.blog_fail('INVALID_CONTENT');end if;
 if p::numeric>9007199254740991 then perform private.blog_fail('INVALID_CONTENT');end if;return p::text::bigint;
end$$;
create function private.blog_site() returns jsonb language plpgsql stable security definer set search_path='' as $$declare c private.blog_installation;begin select * into c from private.blog_installation where singleton;if not found then perform private.blog_fail('CONFIGURATION_REQUIRED');end if;return jsonb_build_object('siteId',c.site_id,'siteName','Fabelpad','origin',c.origin,'canonicalOrigin',c.canonical_origin,'environment',c.environment,'blogPath','/blog','locales',jsonb_build_array('nl-NL'),'contentTypes',jsonb_build_array('blog','article'));end$$;
create function private.blog_admin_actor(p_fresh boolean default false) returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid;begin actor:=case when p_fresh then private.require_fresh_parent() else private.lifecycle_identity() end;if not private.family_access_allowed(actor) or not private.is_confirmed_email_admin(actor) then perform private.blog_fail('PERMISSION_DENIED');end if;return actor;end$$;
create function private.blog_actor_valid(p_actor uuid,p_session uuid) returns boolean language sql stable security definer set search_path='' as $$select p_actor is not null and p_session is not null and exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_actor and (s.not_after is null or s.not_after>clock_timestamp())) and exists(select 1 from public.content_admins a join auth.users u on u.id=a.user_id join private.account_lifecycle l on l.parent_id=u.id where u.id=p_actor and not u.is_anonymous and u.email_confirmed_at is not null and l.state='active' and l.terms_version=(select max(version) from private.legal_document_versions where kind='terms'))$$;
create function private.configure_blog_installation(p_environment text,p_origin text,p_project_ref text,p_socialhero_origin text,p_canonical_origin text default null) returns void language plpgsql security invoker set search_path='' as $$declare c private.blog_installation;begin
 if p_environment not in ('local','staging','production') or p_environment is null or p_origin is null or p_project_ref is null or p_socialhero_origin is null
 or p_socialhero_origin!~'^https://[a-zA-Z0-9][a-zA-Z0-9.-]+(:[0-9]+)?$'
 or (p_environment='staging' and (p_origin<>'https://staging.fabelpad.nl' or p_project_ref<>'tlwfpivafcokcjyjwgmq'))
 or (p_environment='production' and (p_origin<>'https://fabelpad.nl' or p_project_ref<>'aptprpkosqctwrzeetgs'))
 or (p_environment='local' and (p_origin!~'^http://(127\.0\.0\.1|localhost)(:[0-9]{1,5})?$' or p_project_ref<>'local'))
 or (p_canonical_origin is not null and p_canonical_origin!~'^https://[a-zA-Z0-9][a-zA-Z0-9.-]+(:[0-9]+)?$') then perform private.blog_fail('DESTINATION_MISMATCH');end if;
 perform private.blog_lock();select * into c from private.blog_installation where singleton;
 if found and (c.environment<>p_environment or c.origin<>p_origin or c.project_ref<>p_project_ref or c.socialhero_origin<>p_socialhero_origin or c.canonical_origin<>coalesce(p_canonical_origin,p_origin)) then perform private.blog_fail('DESTINATION_MISMATCH');end if;
 if p_environment<>'local' and exists(select 1 from private.lifecycle_worker_schedule where singleton and project_ref is not null and project_ref<>p_project_ref) then perform private.blog_fail('DESTINATION_MISMATCH');end if;
 insert into private.blog_installation(singleton,site_id,environment,origin,canonical_origin,project_ref,socialhero_origin) values(true,'fabelpad',p_environment,p_origin,coalesce(p_canonical_origin,p_origin),p_project_ref,p_socialhero_origin) on conflict(singleton) do nothing;
end$$;

-- Independent SQL validation protects direct RPC use as well as the server's
-- richer TipTap validator. No HTML, arbitrary src, event attributes or H1.
create function private.blog_valid_node(p jsonb,p_depth integer default 0,p_parent text default '') returns boolean language plpgsql immutable set search_path='' as $$
declare kind text;attrs jsonb;child jsonb;mark jsonb;m text;v jsonb;
begin
 if p_depth>20 or not private.blog_only(p,array['type','attrs','text','marks','content']) or not private.blog_string(p->'type',32) then return false;end if;
 kind:=p->>'type';attrs:=coalesce(p->'attrs','{}'::jsonb);
 if kind not in ('doc','paragraph','heading','text','hardBreak','bulletList','orderedList','listItem','blockquote','horizontalRule','image','table','tableRow','tableHeader','tableCell','codeBlock') or jsonb_typeof(attrs)<>'object' then return false;end if;
 if (p_depth=0 and kind<>'doc') or (kind='doc' and p_depth<>0)
 or (p_parent in ('paragraph','heading','codeBlock') and kind not in ('text','hardBreak'))
 or (kind in ('text','hardBreak') and p_parent not in ('paragraph','heading','codeBlock'))
 or (p_parent in ('bulletList','orderedList') and kind<>'listItem') or (kind='listItem' and p_parent not in ('bulletList','orderedList'))
 or (p_parent='table' and kind<>'tableRow') or (kind='tableRow' and p_parent<>'table')
 or (p_parent='tableRow' and kind not in ('tableCell','tableHeader')) or (kind in ('tableCell','tableHeader') and p_parent<>'tableRow') then return false;end if;
 if p?'text' and (kind<>'text' or not private.blog_string(p->'text',120000)) then return false;end if;
 if kind='text' and not(p?'text') then return false;end if;
 if kind='heading' then if not private.blog_only(attrs,array['level']) or jsonb_typeof(attrs->'level') is distinct from 'number' or attrs->>'level' not in ('2','3','4') then return false;end if;
 elsif kind='orderedList' then if not private.blog_only(attrs,array['start']) or (attrs?'start' and (jsonb_typeof(attrs->'start')<>'number' or attrs->>'start'!~'^[0-9]{1,7}$' or (attrs->>'start')::integer not between 1 and 1000000)) then return false;end if;
 elsif kind='image' then if not private.blog_only(attrs,array['assetId','alt']) or not private.blog_uuid(attrs->>'assetId') or not private.blog_string(attrs->'alt',500) then return false;end if;
 elsif kind in ('tableCell','tableHeader') then
  if not private.blog_only(attrs,array['colspan','rowspan','colwidth']) then return false;end if;
  foreach m in array array['colspan','rowspan'] loop if attrs?m and (jsonb_typeof(attrs->m)<>'number' or attrs->>m!~'^[0-9]{1,3}$' or (attrs->>m)::integer not between 1 and case when m='colspan' then 12 else 100 end) then return false;end if;end loop;
  if attrs?'colwidth' and attrs->'colwidth'<>'null'::jsonb then if jsonb_typeof(attrs->'colwidth')<>'array' or jsonb_array_length(attrs->'colwidth')>12 then return false;end if;for v in select * from jsonb_array_elements(attrs->'colwidth') loop if jsonb_typeof(v)<>'number' or v#>>'{}'!~'^[0-9]{1,4}$' or (v#>>'{}')::integer not between 1 and 2000 then return false;end if;end loop;end if;
 elsif kind='codeBlock' then if not private.blog_only(attrs,array['language']) or (attrs?'language' and attrs->'language'<>'null'::jsonb and (not private.blog_string(attrs->'language',32,true) or attrs->>'language'!~'^[a-zA-Z0-9_+-]*$')) then return false;end if;
 elsif attrs<>'{}'::jsonb then return false;end if;
 if p?'marks' then
  if kind<>'text' or jsonb_typeof(p->'marks')<>'array' or jsonb_array_length(p->'marks')>8 then return false;end if;
  for mark in select * from jsonb_array_elements(p->'marks') loop
   if not private.blog_only(mark,array['type','attrs']) then return false;end if;m:=mark->>'type';attrs:=coalesce(mark->'attrs','{}'::jsonb);
   if m not in ('bold','italic','underline','highlight','strike','code','link') then return false;end if;
   if m='link' then
    if not private.blog_only(attrs,array['href','title','target','rel']) or not private.blog_string(attrs->'href',2048) or (attrs->>'href')~'[[:space:]\x7f]' or strpos(attrs->>'href',chr(92))>0 or (attrs->>'href')~*'%0[ad]' or (attrs->>'href')!~'^(https?://[^/[:space:]@?#]+([/?#].*)?|mailto:[^[:space:]]+|/[a-zA-Z0-9_?=#%./&+~-]*|#[a-zA-Z0-9_-]+)$' or left(attrs->>'href',2)='//'
    or (attrs?'title' and attrs->'title'<>'null'::jsonb and not private.blog_string(attrs->'title',200,true))
    or (attrs?'target' and attrs->'target'<>'null'::jsonb and attrs->>'target' not in ('_blank','_self'))
    or (attrs?'rel' and attrs->'rel'<>'null'::jsonb and attrs->>'rel' not in ('noopener noreferrer','noopener noreferrer nofollow')) then return false;end if;
   elsif m='highlight' then if not private.blog_only(attrs,array['color']) or (attrs?'color' and attrs->'color'<>'null'::jsonb and attrs->>'color'!~'^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$') then return false;end if;
   elsif attrs<>'{}'::jsonb then return false;end if;
  end loop;
 end if;
 if p?'content' then
  if kind in ('text','hardBreak','horizontalRule','image') or jsonb_typeof(p->'content')<>'array' or jsonb_array_length(p->'content')>2000 then return false;end if;
  for child in select * from jsonb_array_elements(p->'content') loop if not private.blog_valid_node(child,p_depth+1,kind) then return false;end if;end loop;
 end if;
 if kind in ('doc','bulletList','orderedList','listItem','table','tableRow','tableHeader','tableCell') and coalesce(jsonb_array_length(p->'content'),0)=0 then return false;end if;
 if kind='listItem' and p#>>'{content,0,type}'<>'paragraph' then return false;end if;
 if p?'marks' and (select count(distinct mark_entry.value->>'type') from jsonb_array_elements(p->'marks') as mark_entry(value))<>jsonb_array_length(p->'marks') then return false;end if;
 return true;
exception when others then return false;
end$$;
create function private.blog_valid_document(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare tag jsonb;h jsonb;begin
 if not private.blog_only(p,array['type','locale','title','slug','excerpt','authorId','categoryId','tags','content','seo','hero','ogImageAssetId']) or not(p?&array['type','locale','title','slug','excerpt','authorId','categoryId','tags','content','seo','hero','ogImageAssetId']) or octet_length(p::text)>2097152
 or p->>'type' is null or p->>'type' not in ('blog','article') or p->>'locale' is distinct from 'nl-NL' or not private.blog_string(p->'title',200) or not private.blog_string(p->'slug',120) or p->>'slug'!~'^[a-z0-9]+(-[a-z0-9]+)*$'
 or not private.blog_string(p->'excerpt',600,true) or not private.blog_uuid(p->>'authorId') or (p->'categoryId'<>'null'::jsonb and not private.blog_uuid(p->>'categoryId')) or (p->'ogImageAssetId'<>'null'::jsonb and not private.blog_uuid(p->>'ogImageAssetId'))
 or not private.blog_only(p->'seo',array['title','description']) or not private.blog_string(p#>'{seo,title}',200,true) or not private.blog_string(p#>'{seo,description}',320,true)
 or jsonb_typeof(p->'tags')<>'array' or jsonb_array_length(p->'tags')>15 or p#>>'{content,type}'<>'doc' or octet_length((p->'content')::text)>262144 or not private.blog_valid_node(p->'content') then return false;end if;
 for tag in select * from jsonb_array_elements(p->'tags') loop if not private.blog_string(tag,50) then return false;end if;end loop;
 if p->'hero'<>'null'::jsonb then h:=p->'hero';if not private.blog_only(h,array['assetId','alt','focalPoint']) or not private.blog_uuid(h->>'assetId') or not private.blog_string(h->'alt',500) or not private.blog_only(h->'focalPoint',array['x','y']) or jsonb_typeof(h#>'{focalPoint,x}') is distinct from 'number' or jsonb_typeof(h#>'{focalPoint,y}') is distinct from 'number' or (h#>>'{focalPoint,x}')::numeric not between 0 and 1 or (h#>>'{focalPoint,y}')::numeric not between 0 and 1 then return false;end if;end if;
 return true;
exception when others then return false;
end$$;
create function private.blog_asset_ids(p jsonb) returns uuid[] language sql immutable set search_path='' as $$select coalesce(array_agg(distinct (v#>>'{}')::uuid),'{}'::uuid[]) from jsonb_path_query(p,'$.**.assetId') v where jsonb_typeof(v)='string'$$;

create function private.blog_connection_valid(p_id uuid,p_publish boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.socialhero_connections c join private.blog_installation s on s.site_id=c.site_id join private.socialhero_destinations d on d.site_id=c.site_id and d.destination_id=c.destination_id where c.id=p_id and c.state='active' and s.active_connection_id=c.id and d.allow_draft and (not p_publish or d.allow_publish))
$$;
create function private.blog_connection(p_hash text,p_scope text,p_capability boolean default false) returns private.socialhero_connections language plpgsql security definer set search_path='' as $$declare c private.socialhero_connections;d private.socialhero_destinations;begin
 if p_hash is null or p_hash!~'^[a-f0-9]{64}$' then perform private.blog_fail('INVALID_CREDENTIAL');end if;
 select * into c from private.socialhero_connections where token_hash=p_hash;
 if not found or c.state in ('revoked','expired') then perform private.blog_fail('INVALID_CREDENTIAL');end if;
 if c.state='pending' then if c.expires_at<=clock_timestamp() then perform private.blog_fail('PAIRING_EXPIRED');end if;if not p_capability then perform private.blog_fail('PAIRING_IN_PROGRESS');end if;
 elsif not exists(select 1 from private.blog_installation where singleton and active_connection_id=c.id) then perform private.blog_fail('INVALID_CREDENTIAL');end if;
 select * into strict d from private.socialhero_destinations where site_id=c.site_id and destination_id=c.destination_id;
 if (p_scope='draft' and not d.allow_draft) or (p_scope='publish' and (not d.allow_draft or not d.allow_publish)) then perform private.blog_fail('PERMISSION_DENIED');end if;
 return c;
end$$;
create function private.blog_cleanup() returns void language plpgsql security definer set search_path='' as $$declare a private.socialhero_pairing_attempts;begin
 for a in select * from private.socialhero_pairing_attempts where state in ('claiming','pending') and expires_at<=clock_timestamp() for update loop
  delete from vault.secrets where id in (a.code_secret_id,a.token_secret_id);
  update private.socialhero_pairing_attempts set state='expired',code_secret_id=null,token_secret_id=null where id=a.id;
  update private.socialhero_connections set state='expired' where attempt_id=a.id and state='pending';
 end loop;
 -- A hard worker crash on its final lease cannot permanently occupy the
 -- in-flight unique slot. Keep served bytes and permit a conscious new request.
 update private.blog_publications set state='cancelled',lease_id=null,lease_until=null,last_error='RETRY_EXHAUSTED'
 where state='working' and attempts>=8 and lease_until<=clock_timestamp();
end$$;
create function private.blog_connection_view() returns jsonb language plpgsql security definer set search_path='' as $$declare s private.blog_installation;a private.socialhero_pairing_attempts;c private.socialhero_connections;d private.socialhero_destinations;status text;begin
 perform private.blog_site();select * into strict s from private.blog_installation where singleton;select * into a from private.socialhero_pairing_attempts where id=s.current_attempt_id;
 if a.state in ('claiming','pending') then select * into c from private.socialhero_connections where id=a.connection_id;status:=case when a.expires_at<=clock_timestamp() then 'expired' else 'pending' end;
 else select * into c from private.socialhero_connections where id=s.active_connection_id;status:=coalesce(c.state,case when a.state='expired' then 'expired' when a.state='rejected' then 'revoked' else 'disconnected' end);end if;
 select * into d from private.socialhero_destinations where site_id=s.site_id and destination_id=c.destination_id;
 return jsonb_build_object('status',status,'connectionId',c.id,'destinationId',c.destination_id,'site',private.blog_site(),
 'allowDraft',coalesce(d.allow_draft,a.allow_draft,s.allow_draft),'allowPublish',coalesce(d.allow_publish,a.allow_publish,s.allow_publish),
 'scopes',to_jsonb(array['read']||case when coalesce(d.allow_draft,a.allow_draft,s.allow_draft) then array['draft'] else '{}'::text[] end||case when coalesce(d.allow_publish,a.allow_publish,s.allow_publish) and coalesce(d.allow_draft,a.allow_draft,s.allow_draft) then array['publish'] else '{}'::text[] end),
 'connectedAt',c.connected_at,'expiresAt',case when status in ('pending','expired') then coalesce(c.expires_at,a.expires_at) end,'lastCheckedAt',c.last_checked_at);
end$$;
create function private.blog_asset_dto(p private.blog_media) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('assetId',p.id,'mimeType',p.mime_type,'width',p.width,'height',p.height,'url','/api/blog/media/'||p.id::text,'createdAt',p.created_at)$$;
create function private.blog_media_context(p private.blog_media) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('assetId',p.id,'mimeType',p.mime_type,'width',p.width,'height',p.height,'byteLength',p.byte_length,'sha256',p.sha256,'objectPath',p.object_path)$$;
create function private.blog_editor(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare p private.blog_posts;r private.blog_revisions;l private.blog_revisions;j private.blog_publications;history jsonb;s jsonb:=private.blog_site();begin
 select * into p from private.blog_posts where id=p_id;if not found then perform private.blog_fail('POST_NOT_FOUND');end if;
 select * into strict r from private.blog_revisions where post_id=p.id and revision=p.revision;select * into l from private.blog_revisions where post_id=p.id and revision=p.live_revision;
 select * into j from private.blog_publications where post_id=p.id order by created_at desc,id desc limit 1;
 select coalesce(jsonb_agg(x.v order by x.revision desc),'[]'::jsonb) into history from (select revision,jsonb_build_object('revision',revision,'title',document->>'title','createdAt',created_at,'actor',actor_kind) v from private.blog_revisions where post_id=p.id order by revision desc limit 50)x;
 return jsonb_build_object('postId',p.id,'revision',p.revision,'draftRevision',p.draft_revision,'publishedRevision',p.verified_revision,'document',r.document,'liveDocument',l.document,
 'state',case when j.state in ('queued','working') or (p.live_revision is not null and p.live_revision is distinct from p.verified_revision) then 'publishing' when p.verified_revision is not null then 'published' else 'draft' end,'publishedAt',p.published_at,'updatedAt',p.updated_at,
 'publicUrl',case when p.live_revision is not null then s->>'origin'||'/blog/'||(l.document->>'slug') end,'previewUrl','/studio/blog/'||p.id::text||'/preview',
 'publication',case when j.id is not null then jsonb_build_object('revision',j.revision,'state',case when j.state='published' then 'published' else 'publishing' end,'attempts',j.attempts,'lastError',j.last_error,'verifiedAt',j.verified_at,'nextAttemptAt',j.next_attempt_at) end,'revisions',history);
end$$;
create function private.blog_post_status(p_id uuid,p_external_id text) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('postId',e->'postId','externalId',p_external_id,'slug',e#>'{document,slug}','state',e->'state','revision',e->'revision','draftRevision',e->'draftRevision','publishedRevision',e->'publishedRevision','previewUrl',e->'previewUrl','publicUrl',e->'publicUrl','publishedAt',e->'publishedAt') from (select private.blog_editor(p_id)e)x$$;
create function private.blog_save(p_id uuid,p_base bigint,p_document jsonb,p_actor uuid,p_connection uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p private.blog_posts;c private.socialhero_connections;s jsonb:=private.blog_site();a private.blog_authors;category private.blog_categories;asset uuid;claims private.blog_slug_claims;next_revision bigint;begin
 if private.blog_valid_document(p_document) is distinct from true then perform private.blog_fail('INVALID_CONTENT');end if;
 select * into a from private.blog_authors where id=(p_document->>'authorId')::uuid and site_id=s->>'siteId' and active;if not found then perform private.blog_fail('INVALID_CONTENT');end if;
 if p_document->'categoryId'<>'null'::jsonb then select * into category from private.blog_categories where id=(p_document->>'categoryId')::uuid and site_id=s->>'siteId' and active;if not found then perform private.blog_fail('INVALID_CONTENT');end if;end if;
 if p_connection is not null then select * into strict c from private.socialhero_connections where id=p_connection;end if;
 foreach asset in array private.blog_asset_ids(p_document)||case when p_document->'ogImageAssetId'<>'null'::jsonb then array[(p_document->>'ogImageAssetId')::uuid] else '{}'::uuid[] end loop
  if not exists(select 1 from private.blog_media m where m.id=asset and m.site_id=s->>'siteId' and m.state='ready' and (p_connection is null or m.destination_id=c.destination_id)) then perform private.blog_fail('INVALID_MEDIA');end if;
 end loop;
 if p_id is null then
  if p_base is not null then perform private.blog_fail('REVISION_CONFLICT');end if;
  insert into private.blog_posts(site_id,locale,revision,draft_revision) values(s->>'siteId',p_document->>'locale',1,1) returning * into p;next_revision:=1;
 else
  select * into p from private.blog_posts where id=p_id and site_id=s->>'siteId' for update;if not found then perform private.blog_fail('POST_NOT_FOUND');end if;
  if p_base is null or p_base<>p.revision or p.revision>=9007199254740991 then perform private.blog_fail('REVISION_CONFLICT');end if;
  next_revision:=p.revision+1;
 end if;
 insert into private.blog_slug_claims(site_id,locale,slug,post_id) values(s->>'siteId',p_document->>'locale',p_document->>'slug',p.id) on conflict(site_id,locale,slug) do nothing;
 select * into strict claims from private.blog_slug_claims where site_id=s->>'siteId' and locale=p_document->>'locale' and slug=p_document->>'slug';if claims.post_id<>p.id then perform private.blog_fail('SLUG_CONFLICT');end if;
 insert into private.blog_revisions(post_id,revision,document,content_hash,author_snapshot,category_snapshot,actor_kind,actor_id,connection_id)
 values(p.id,next_revision,p_document,private.blog_hash(p_document),jsonb_build_object('id',a.id,'name',a.name,'bio',a.bio),case when category.id is not null then jsonb_build_object('id',category.id,'name',category.name,'bio',category.bio) end,case when p_connection is null then 'admin' else 'socialhero' end,p_actor,p_connection);
 insert into private.blog_revision_assets(post_id,revision,asset_id) select p.id,next_revision,x from unnest(private.blog_asset_ids(p_document)||case when p_document->'ogImageAssetId'<>'null'::jsonb then array[(p_document->>'ogImageAssetId')::uuid] else '{}'::uuid[] end)x on conflict do nothing;
 update private.blog_posts set revision=next_revision,draft_revision=next_revision,updated_at=clock_timestamp() where id=p.id;
 return p.id;
end$$;
create function private.blog_immutable_revision() returns trigger language plpgsql set search_path='' as $$begin
 -- Auth deletion may erase the nullable actor link, as for existing content
 -- releases. Every reproducible content/snapshot/timestamp byte stays immutable.
 if tg_op='UPDATE' and new.actor_id is null and (to_jsonb(new)-'actor_id')=(to_jsonb(old)-'actor_id') then return new;end if;
 perform private.blog_fail('IMMUTABLE_REVISION');return null;end$$;
create trigger blog_revision_immutable before update or delete on private.blog_revisions for each row execute function private.blog_immutable_revision();
create function private.blog_request_publish(p_id uuid,p_revision bigint,p_actor uuid,p_session uuid,p_connection uuid) returns uuid language plpgsql security definer set search_path='' as $$declare p private.blog_posts;j private.blog_publications;begin
 select * into p from private.blog_posts where id=p_id for update;if not found then perform private.blog_fail('POST_NOT_FOUND');end if;
 if p_revision is null or p.revision<>p_revision or (p.draft_revision is distinct from p_revision and p.verified_revision is distinct from p_revision) then perform private.blog_fail('REVISION_CONFLICT');end if;
 select * into j from private.blog_publications where post_id=p.id and revision=p_revision and state='published' order by created_at desc limit 1;if found then return j.id;end if;
 select * into j from private.blog_publications where post_id=p.id and state in ('queued','working');if found then if j.revision=p_revision then return j.id;end if;perform private.blog_fail('PUBLICATION_BUSY');end if;
 insert into private.blog_publications(post_id,revision,state,actor_id,session_id,connection_id) values(p.id,p_revision,'queued',p_actor,p_session,p_connection) returning id into p_id;return p_id;
end$$;
create function private.blog_media_reserve(p_input jsonb,p_destination uuid,p_actor uuid,p_session uuid,p_connection uuid,p_key text,p_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb:=private.blog_site();op private.socialhero_operations;m private.blog_media;scope text:=coalesce(p_destination::text,'admin:'||p_actor::text);id uuid:=gen_random_uuid();ext text;fp text;
begin
 if not(p_input?&array['sha256','byteLength','mimeType','width','height']) or not private.blog_string(p_input->'sha256',64) or p_key is null or length(p_key) not between 1 and 200 or p_fingerprint is null or p_fingerprint!~'^[a-f0-9]{64}$' or p_input->>'sha256'!~'^[a-f0-9]{64}$' or p_input->>'mimeType' not in ('image/png','image/jpeg')
 or jsonb_typeof(p_input->'byteLength')<>'number' or p_input->>'byteLength'!~'^[0-9]{1,8}$' or (p_input->>'byteLength')::bigint not between 1 and 8388608
 or p_input->>'width'!~'^[0-9]{1,5}$' or p_input->>'height'!~'^[0-9]{1,5}$' or (p_input->>'width')::integer not between 1 and 6000 or (p_input->>'height')::integer not between 1 and 6000 or (p_input->>'width')::bigint*(p_input->>'height')::bigint>8000000 then perform private.blog_fail('INVALID_MEDIA');end if;
 fp:=private.blog_hash(jsonb_build_object('fingerprint',p_fingerprint,'sha256',p_input->'sha256','byteLength',p_input->'byteLength','mimeType',p_input->'mimeType','width',p_input->'width','height',p_input->'height'));
 select * into op from private.socialhero_operations where site_id=s->>'siteId' and destination_id=scope and operation='media' and operation_key=p_key;
 if found then if op.fingerprint<>fp then perform private.blog_fail('IDEMPOTENCY_CONFLICT');end if;select * into strict m from private.blog_media where blog_media.id=op.asset_id;
  if m.state='reserved' and (m.lease_until<=clock_timestamp() or m.connection_id is distinct from p_connection or m.session_id is distinct from p_session) then update private.blog_media set lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',actor_id=p_actor,session_id=p_session,connection_id=p_connection where blog_media.id=m.id returning * into m;end if;
 else
  ext:=case p_input->>'mimeType' when 'image/png' then 'png' when 'image/jpeg' then 'jpg' else 'webp' end;
  insert into private.blog_media(id,site_id,destination_id,sha256,byte_length,mime_type,width,height,object_path,state,lease_id,lease_until,actor_id,session_id,connection_id)
  values(id,s->>'siteId',p_destination,p_input->>'sha256',(p_input->>'byteLength')::integer,p_input->>'mimeType',(p_input->>'width')::integer,(p_input->>'height')::integer,'blog/'||id::text||'/'||(p_input->>'sha256')||'.'||ext,'reserved',gen_random_uuid(),clock_timestamp()+interval '2 minutes',p_actor,p_session,p_connection) returning * into m;
  insert into private.socialhero_operations(site_id,destination_id,operation,operation_key,fingerprint,asset_id) values(s->>'siteId',scope,'media',p_key,fp,m.id);
 end if;
 return private.blog_media_context(m)||jsonb_build_object('leaseId',m.lease_id,'complete',m.state='ready');
end$$;

create function private.blog_public(p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb:=private.blog_site();p private.blog_posts;r private.blog_revisions;m private.blog_media;j private.blog_publications;claim private.blog_slug_claims;result jsonb;items jsonb;categories jsonb;page integer;per_page integer;total integer;
begin
 if p_action='site' then return s;
 elsif p_action='media' then
  select * into m from private.blog_media where id=(p_input->>'assetId')::uuid and state='ready' and site_id=s->>'siteId' and exists(select 1 from private.blog_revision_assets ra join private.blog_posts bp on bp.id=ra.post_id and bp.live_revision=ra.revision where ra.asset_id=private.blog_media.id);
  if not found then return 'null'::jsonb;end if;return private.blog_media_context(m);
 elsif p_action='post' then
  select * into claim from private.blog_slug_claims where site_id=s->>'siteId' and locale='nl-NL' and slug=p_input->>'slug' and ever_published;
  if not found then return jsonb_build_object('article',null,'redirect',null,'verification',null);end if;
  select * into strict p from private.blog_posts where id=claim.post_id;select * into r from private.blog_revisions where post_id=p.id and revision=p.live_revision;
  if not found then return jsonb_build_object('article',null,'redirect',null,'verification',null);end if;
  if r.document->>'slug'<>claim.slug then return jsonb_build_object('article',null,'redirect','/blog/'||(r.document->>'slug'),'verification',null);end if;
  select coalesce(jsonb_agg(private.blog_asset_dto(bm) order by bm.id),'[]'::jsonb) into items from private.blog_media bm join private.blog_revision_assets ra on ra.asset_id=bm.id where ra.post_id=p.id and ra.revision=p.live_revision and bm.state='ready';
  select * into j from private.blog_publications where post_id=p.id and revision=p.live_revision and promoted_at is not null order by created_at desc limit 1;
  result:=jsonb_build_object('postId',p.id,'revision',p.live_revision,'document',r.document,'author',r.author_snapshot,'category',r.category_snapshot,'assets',items,'publishedAt',p.published_at,'updatedAt',r.created_at,'publicUrl',s->>'origin'||'/blog/'||(r.document->>'slug'),'canonicalUrl',s->>'canonicalOrigin'||'/blog/'||(r.document->>'slug'));
  return jsonb_build_object('article',result,'redirect',null,'verification',case when j.id is not null then jsonb_build_object('publicationId',j.id,'revision',j.revision,'proof',j.proof) end);
 elsif p_action='catalog' then
  page:=coalesce((p_input->>'page')::integer,1);per_page:=coalesce((p_input->>'pageSize')::integer,12);if page<1 or page>100000 or per_page not between 1 and 48 then perform private.blog_fail('INVALID_CONTENT');end if;
  select count(*) into total from private.blog_posts bp join private.blog_revisions br on br.post_id=bp.id and br.revision=bp.live_revision where bp.site_id=s->>'siteId' and (not(p_input?'categoryId') or br.document->>'categoryId'=p_input->>'categoryId');
  select coalesce(jsonb_agg(v order by published_at desc,id),'[]'::jsonb) into items from (
   select bp.id,bp.published_at,jsonb_build_object('postId',bp.id,'revision',bp.live_revision,'title',br.document->'title','slug',br.document->'slug','excerpt',br.document->'excerpt','type',br.document->'type','locale',br.document->'locale','author',br.author_snapshot,'category',br.category_snapshot,'hero',case when bm.id is not null then (br.document->'hero')||jsonb_build_object('asset',private.blog_asset_dto(bm)) end,'publishedAt',bp.published_at,'updatedAt',br.created_at,'publicUrl',s->>'origin'||'/blog/'||(br.document->>'slug'))v
   from private.blog_posts bp join private.blog_revisions br on br.post_id=bp.id and br.revision=bp.live_revision left join private.blog_media bm on bm.id=(br.document#>>'{hero,assetId}')::uuid and bm.state='ready'
   where bp.site_id=s->>'siteId' and (not(p_input?'categoryId') or br.document->>'categoryId'=p_input->>'categoryId') order by bp.published_at desc,bp.id offset (page-1)*per_page limit per_page)x;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) into categories from private.blog_categories where site_id=s->>'siteId' and active;
  return jsonb_build_object('posts',items,'page',page,'totalPages',greatest(1,ceil(total::numeric/per_page)::integer),'total',total,'categories',categories);
 elsif p_action='sitemap' then
  select coalesce(jsonb_agg(jsonb_build_object('slug',br.document->>'slug','updatedAt',br.created_at) order by bp.id),'[]'::jsonb) into items from private.blog_posts bp join private.blog_revisions br on br.post_id=bp.id and br.revision=bp.live_revision where bp.site_id=s->>'siteId';return jsonb_build_object('posts',items);
 end if;perform private.blog_fail('INVALID_CONTENT');return null;
end$$;
create function private.blog_admin(p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;sid uuid;s jsonb;site private.blog_installation;a private.socialhero_pairing_attempts;c private.socialhero_connections;d private.socialhero_destinations;r private.blog_revisions;post_record private.blog_posts;p_id uuid;publication uuid;records jsonb;authors jsonb;categories jsonb;assets jsonb;record_id uuid;secret_id uuid;token_hash text;made integer;kind text;result jsonb;
begin
 actor:=private.blog_admin_actor(p_action in ('publish','pair_begin','pair_resume','pair_pending','connection_policy','connection_revoke'));sid:=(auth.jwt()->>'session_id')::uuid;s:=private.blog_site();
 if p_action not in ('list','get','preview','media_get','connection_status') then perform private.blog_lock();end if;
 if p_action='list' then
  select coalesce(jsonb_agg(private.blog_editor(bp.id) order by bp.updated_at desc),'[]'::jsonb) into records from private.blog_posts bp join private.blog_revisions br on br.post_id=bp.id and br.revision=bp.revision where bp.site_id=s->>'siteId' and (coalesce(p_input->>'query','')='' or strpos(lower(br.document->>'title'),lower(left(p_input->>'query',200)))>0) and (coalesce(p_input->>'state','')='' or private.blog_editor(bp.id)->>'state'=p_input->>'state');
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'bio',bio,'active',active) order by name),'[]'::jsonb) into authors from private.blog_authors where site_id=s->>'siteId';
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'bio',bio,'active',active) order by name),'[]'::jsonb) into categories from private.blog_categories where site_id=s->>'siteId';
  select coalesce(jsonb_agg(private.blog_asset_dto(bm) order by created_at desc),'[]'::jsonb) into assets from private.blog_media bm where site_id=s->>'siteId' and state='ready';
  select ba.id into record_id from private.blog_authors ba where site_id=s->>'siteId' and is_default;
  return jsonb_build_object('site',s,'posts',records,'authors',authors,'categories',categories,'assets',assets,'defaultAuthorId',record_id);
 elsif p_action='preview' then
  select * into post_record from private.blog_posts where id=(p_input->>'postId')::uuid and site_id=s->>'siteId';if not found then perform private.blog_fail('POST_NOT_FOUND');end if;
  select * into r from private.blog_revisions where post_id=post_record.id and revision=coalesce(private.blog_revision_value(p_input->'revision',true),post_record.draft_revision,post_record.revision);if not found then perform private.blog_fail('POST_NOT_FOUND');end if;
  select coalesce(jsonb_agg(private.blog_asset_dto(bm) order by bm.id),'[]'::jsonb) into assets from private.blog_media bm join private.blog_revision_assets ra on ra.asset_id=bm.id where ra.post_id=post_record.id and ra.revision=r.revision and bm.state='ready';
  return jsonb_build_object('postId',post_record.id,'revision',r.revision,'document',r.document,'author',r.author_snapshot,'category',r.category_snapshot,'assets',assets,'publishedAt',coalesce(post_record.published_at,r.created_at),'updatedAt',r.created_at,'publicUrl',s->>'origin'||'/blog/'||(r.document->>'slug'),'canonicalUrl',s->>'canonicalOrigin'||'/blog/'||(r.document->>'slug'));
 elsif p_action='get' then return private.blog_editor((p_input->>'postId')::uuid);
 elsif p_action='save' then if not(p_input?&array['postId','baseRevision','document']) or (p_input->'postId'<>'null'::jsonb and not private.blog_uuid(p_input->>'postId')) or (p_input->'baseRevision'<>'null'::jsonb and jsonb_typeof(p_input->'baseRevision') is distinct from 'number') then perform private.blog_fail('INVALID_CONTENT');end if;p_id:=private.blog_save((p_input->>'postId')::uuid,private.blog_revision_value(p_input->'baseRevision',true),p_input->'document',actor,null);return private.blog_editor(p_id);
 elsif p_action='restore' then
  select * into r from private.blog_revisions where post_id=(p_input->>'postId')::uuid and revision=private.blog_revision_value(p_input->'revision');if not found then perform private.blog_fail('POST_NOT_FOUND');end if;
  p_id:=private.blog_save(r.post_id,private.blog_revision_value(p_input->'baseRevision',true),r.document,actor,null);return private.blog_editor(p_id);
 elsif p_action='taxonomy' then
  kind:=p_input->>'kind';if kind is null or kind not in ('author','category') or not private.blog_string(p_input->'name',160) or (p_input?'bio' and not private.blog_string(p_input->'bio',2000,true)) or (p_input?'active' and jsonb_typeof(p_input->'active')<>'boolean') then perform private.blog_fail('INVALID_CONTENT');end if;
  record_id:=(p_input->>'id')::uuid;
  if kind='author' then
   if record_id is null then insert into private.blog_authors(site_id,name,bio,active) values(s->>'siteId',btrim(p_input->>'name'),coalesce(p_input->>'bio',''),coalesce((p_input->>'active')::boolean,true)) returning blog_authors.id into record_id;
   else if exists(select 1 from private.blog_authors where blog_authors.id=record_id and is_default) and p_input->>'active'='false' then perform private.blog_fail('INVALID_CONTENT');end if;
    update private.blog_authors set name=btrim(p_input->>'name'),bio=coalesce(p_input->>'bio',''),active=coalesce((p_input->>'active')::boolean,true),updated_at=clock_timestamp() where blog_authors.id=record_id and site_id=s->>'siteId';if not found then perform private.blog_fail('POST_NOT_FOUND');end if;end if;
   select jsonb_build_object('id',ba.id,'name',name,'bio',bio,'active',active) into result from private.blog_authors ba where ba.id=record_id;
  else
   if record_id is null then insert into private.blog_categories(site_id,name,bio,active) values(s->>'siteId',btrim(p_input->>'name'),coalesce(p_input->>'bio',''),coalesce((p_input->>'active')::boolean,true)) returning blog_categories.id into record_id;
   else update private.blog_categories set name=btrim(p_input->>'name'),bio=coalesce(p_input->>'bio',''),active=coalesce((p_input->>'active')::boolean,true),updated_at=clock_timestamp() where blog_categories.id=record_id and site_id=s->>'siteId';if not found then perform private.blog_fail('POST_NOT_FOUND');end if;end if;
   select jsonb_build_object('id',bc.id,'name',name,'bio',bio,'active',active) into result from private.blog_categories bc where bc.id=record_id;
  end if;return jsonb_build_object('record',result);
 elsif p_action='media_reserve' then return private.blog_media_reserve(p_input,null,actor,sid,null,p_input->>'requestId',private.blog_hash(p_input));
 elsif p_action='media_get' then
  select private.blog_media_context(bm) into result from private.blog_media bm where bm.id=(p_input->>'assetId')::uuid and bm.site_id=s->>'siteId' and bm.state='ready';if result is null then perform private.blog_fail('INVALID_MEDIA');end if;return result;
 elsif p_action='publish' then
  publication:=private.blog_request_publish((p_input->>'postId')::uuid,private.blog_revision_value(p_input->'revision'),actor,sid,null);return jsonb_build_object('editor',private.blog_editor((p_input->>'postId')::uuid),'publicationId',publication);
 elsif p_action='connection_status' then return private.blog_connection_view();
 elsif p_action='connection_check' then
  select * into strict site from private.blog_installation where singleton;
  select * into c from private.socialhero_connections where id=site.active_connection_id and site_id=site.site_id and state='active';
  if c.id is null then perform private.blog_fail('INVALID_CREDENTIAL');end if;
  if p_input?'connectionId' and (p_input->>'connectionId')::uuid is distinct from c.id then perform private.blog_fail('DESTINATION_MISMATCH');end if;
  update private.socialhero_connections set last_checked_at=clock_timestamp() where id=c.id and state='active';return private.blog_connection_view();
 elsif p_action='pair_resume' then
  select * into a from private.socialhero_pairing_attempts where id=(select current_attempt_id from private.blog_installation where singleton) and state in ('claiming','pending') and expires_at>clock_timestamp();return jsonb_build_object('attemptId',a.id,'site',s);
 elsif p_action='pair_begin' then
  if not private.blog_uuid(p_input->>'attemptId') or not private.blog_string(p_input->'code',512) or jsonb_typeof(p_input->'allowDraft') is distinct from 'boolean' or jsonb_typeof(p_input->'allowPublish') is distinct from 'boolean' or (p_input->>'allowPublish'='true' and p_input->>'allowDraft'<>'true') then perform private.blog_fail('INVALID_PAIRING_CODE');end if;
  perform private.blog_cleanup();select * into strict site from private.blog_installation where singleton for update;
  record_id:=(p_input->>'attemptId')::uuid;select * into a from private.socialhero_pairing_attempts where socialhero_pairing_attempts.id=record_id;
  if found then if a.actor_id is distinct from actor or a.code_hash<>private.blog_hash(p_input->'code') or a.allow_draft<>(p_input->>'allowDraft')::boolean or a.allow_publish<>(p_input->>'allowPublish')::boolean then perform private.blog_fail('DESTINATION_MISMATCH');end if;return jsonb_build_object('attemptId',record_id,'site',s);end if;
  -- Exact retry above is free; only new attempts consume durable local quota.
  if (select count(*) from private.socialhero_pairing_attempts where actor_id=actor and site_id=site.site_id and created_at>clock_timestamp()-interval '10 minutes')>=10 then perform private.blog_fail('RATE_LIMITED');end if;
  -- A second attempt supersedes only pending provisioning. Existing active
  -- authority remains usable until the new exact credential is activated.
  for a in select * from private.socialhero_pairing_attempts where site_id=site.site_id and state in ('claiming','pending') loop
   delete from vault.secrets where vault.secrets.id in(a.code_secret_id,a.token_secret_id);update private.socialhero_pairing_attempts set state='rejected',code_secret_id=null,token_secret_id=null where socialhero_pairing_attempts.id=a.id;update private.socialhero_connections set state='revoked',revoked_at=clock_timestamp() where attempt_id=a.id and state='pending';
  end loop;
  secret_id:=vault.create_secret(p_input->>'code','fabelpad_blog_pair_code_'||record_id::text,'Temporary SocialHero pairing code');
  update private.blog_installation set binding_generation=binding_generation+1,current_attempt_id=record_id where singleton returning * into site;
  insert into private.socialhero_pairing_attempts(id,site_id,actor_id,session_id,generation,allow_draft,allow_publish,state,code_hash,code_secret_id,expires_at) values(record_id,site.site_id,actor,sid,site.binding_generation,(p_input->>'allowDraft')::boolean,(p_input->>'allowPublish')::boolean,'claiming',private.blog_hash(p_input->'code'),secret_id,clock_timestamp()+interval '10 minutes');
  return jsonb_build_object('attemptId',record_id,'site',s);
 elsif p_action='pair_pending' then
  select * into a from private.socialhero_pairing_attempts where socialhero_pairing_attempts.id=(p_input->>'attemptId')::uuid for update;select * into strict site from private.blog_installation where singleton;
  if not found or a.id is null or a.actor_id is distinct from actor or a.id is distinct from site.current_attempt_id or a.generation<>site.binding_generation or a.state not in ('claiming','pending') then perform private.blog_fail('DESTINATION_MISMATCH');end if;
  if a.expires_at<=clock_timestamp() then perform private.blog_fail('PAIRING_EXPIRED');end if;
  if not private.blog_uuid(p_input->>'connectionId') or not private.blog_uuid(p_input->>'destinationId') or not private.blog_string(p_input->'accessToken',1024) or length(p_input->>'accessToken')<43 or p_input->>'accessToken'!~'^[A-Za-z0-9_-]+$' or (p_input->>'expiresAt')::timestamptz<=clock_timestamp() or (p_input->>'expiresAt')::timestamptz>clock_timestamp()+interval '10 minutes 15 seconds' then perform private.blog_fail('DESTINATION_MISMATCH');end if;
  token_hash:=encode(extensions.digest(p_input->>'accessToken','sha256'),'hex');
  if a.state='pending' then select * into strict c from private.socialhero_connections where socialhero_connections.id=a.connection_id;if c.id is distinct from (p_input->>'connectionId')::uuid or c.destination_id is distinct from (p_input->>'destinationId')::uuid or c.token_hash<>token_hash then perform private.blog_fail('DESTINATION_MISMATCH');end if;return private.blog_connection_view();end if;
  insert into private.socialhero_destinations(site_id,destination_id,allow_draft,allow_publish,policy_actor_id) values(site.site_id,(p_input->>'destinationId')::uuid,a.allow_draft,a.allow_publish,actor) on conflict(site_id,destination_id) do nothing;get diagnostics made=row_count;
  if made=1 then insert into private.socialhero_policy_audit(site_id,destination_id,environment,allow_draft,allow_publish,actor_id,source) values(site.site_id,(p_input->>'destinationId')::uuid,site.environment,a.allow_draft,a.allow_publish,actor,'pair');end if;
  insert into private.socialhero_connections(id,site_id,destination_id,token_hash,state,attempt_id,supersedes_id,expires_at) values((p_input->>'connectionId')::uuid,site.site_id,(p_input->>'destinationId')::uuid,token_hash,'pending',a.id,site.active_connection_id,(p_input->>'expiresAt')::timestamptz);
  secret_id:=vault.create_secret(p_input->>'accessToken','fabelpad_blog_pair_token_'||a.id::text,'Temporary SocialHero provisioning bearer');
  delete from vault.secrets where vault.secrets.id=a.code_secret_id;
  update private.socialhero_pairing_attempts set state='pending',connection_id=(p_input->>'connectionId')::uuid,code_secret_id=null,token_secret_id=secret_id,expires_at=(p_input->>'expiresAt')::timestamptz where socialhero_pairing_attempts.id=a.id;
  return private.blog_connection_view();
 elsif p_action='connection_policy' then
  if jsonb_typeof(p_input->'allowDraft') is distinct from 'boolean' or jsonb_typeof(p_input->'allowPublish') is distinct from 'boolean' or (p_input->>'allowPublish'='true' and p_input->>'allowDraft'<>'true') then perform private.blog_fail('INVALID_CONTENT');end if;
  select * into strict site from private.blog_installation where singleton;select * into c from private.socialhero_connections where socialhero_connections.id=coalesce((select connection_id from private.socialhero_pairing_attempts where socialhero_pairing_attempts.id=site.current_attempt_id and state='pending'),site.active_connection_id);
  if c.id is null then perform private.blog_fail('INVALID_CREDENTIAL');end if;
  if p_input?'connectionId' and (p_input->>'connectionId')::uuid is distinct from c.id then perform private.blog_fail('DESTINATION_MISMATCH');end if;
  update private.socialhero_destinations set allow_draft=(p_input->>'allowDraft')::boolean,allow_publish=(p_input->>'allowPublish')::boolean,policy_actor_id=actor,policy_at=clock_timestamp() where site_id=site.site_id and destination_id=c.destination_id;
  insert into private.socialhero_policy_audit(site_id,destination_id,environment,allow_draft,allow_publish,actor_id,source) values(site.site_id,c.destination_id,site.environment,(p_input->>'allowDraft')::boolean,(p_input->>'allowPublish')::boolean,actor,'admin');return private.blog_connection_view();
 elsif p_action='connection_revoke' then
  select * into strict site from private.blog_installation where singleton;record_id:=coalesce((p_input->>'connectionId')::uuid,(select connection_id from private.socialhero_pairing_attempts where socialhero_pairing_attempts.id=site.current_attempt_id and state='pending'),site.active_connection_id);
  update private.socialhero_connections set state='revoked',revoked_at=coalesce(revoked_at,clock_timestamp()) where socialhero_connections.id=record_id and site_id=site.site_id;
  for a in select * from private.socialhero_pairing_attempts where site_id=site.site_id and connection_id=record_id loop delete from vault.secrets where vault.secrets.id in(a.code_secret_id,a.token_secret_id);update private.socialhero_pairing_attempts set state='rejected',code_secret_id=null,token_secret_id=null where socialhero_pairing_attempts.id=a.id;end loop;
  return private.blog_connection_view();
 end if;perform private.blog_fail('INVALID_CONTENT');return null;
end$$;

create function private.blog_connector(p_token_hash text,p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.socialhero_connections;d private.socialhero_destinations;s jsonb;scope text;id uuid;op private.socialhero_operations;fp text;result jsonb;authors jsonb;categories jsonb;publication uuid;
begin
 perform private.blog_lock();s:=private.blog_site();scope:=case when p_action in ('put','media_reserve') then 'draft' when p_action='publish' then 'publish' else 'read' end;c:=private.blog_connection(p_token_hash,scope,p_action='capabilities');
 if p_action='capabilities' then
  update private.socialhero_connections set last_checked_at=clock_timestamp() where socialhero_connections.id=c.id;
  select * into strict d from private.socialhero_destinations where site_id=c.site_id and destination_id=c.destination_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',ba.id,'name',name) order by name),'[]'::jsonb) into authors from private.blog_authors ba where site_id=c.site_id and active;
  select coalesce(jsonb_agg(jsonb_build_object('id',bc.id,'name',name) order by name),'[]'::jsonb) into categories from private.blog_categories bc where site_id=c.site_id and active;
  return (s-'canonicalOrigin')||jsonb_build_object('contractVersion',1,'connectionId',c.id,'destinationId',c.destination_id,'credentialState',c.state,'scopes',to_jsonb(array['read']||case when d.allow_draft then array['draft'] else '{}'::text[] end||case when d.allow_draft and d.allow_publish then array['publish'] else '{}'::text[] end),'authors',authors,'categories',categories,'media',jsonb_build_object('mimeTypes',jsonb_build_array('image/png','image/jpeg'),'maxBytes',8388608));
 elsif p_action='revoke' then update private.socialhero_connections set state='revoked',revoked_at=clock_timestamp() where socialhero_connections.id=c.id;return '{"revoked":true}'::jsonb;
 elsif p_action='media_reserve' then return private.blog_media_reserve(p_input,c.destination_id,null,null,c.id,p_input->>'idempotencyKey',p_input->>'fingerprint');
 elsif p_action in ('get','put','publish') then
  if not private.blog_string(p_input->'externalId',200) then perform private.blog_fail('INVALID_CONTENT');end if;
  select post_id into id from private.socialhero_post_mappings where site_id=c.site_id and destination_id=c.destination_id and external_id=p_input->>'externalId';
  if p_action='get' then if id is null then perform private.blog_fail('POST_NOT_FOUND');end if;return private.blog_post_status(id,p_input->>'externalId');end if;
  if not private.blog_string(p_input->'idempotencyKey',200) or not private.blog_string(p_input->'fingerprint',64) or p_input->>'fingerprint'!~'^[a-f0-9]{64}$' then perform private.blog_fail('INVALID_CONTENT');end if;
  fp:=private.blog_hash(p_input-'idempotencyKey');
  select * into op from private.socialhero_operations where site_id=c.site_id and destination_id=c.destination_id::text and operation=p_action and operation_key=p_input->>'idempotencyKey';
  if found then if op.fingerprint<>fp then perform private.blog_fail('IDEMPOTENCY_CONFLICT');end if;return op.response;end if;
  if p_action='put' then
   if id is null and p_input->'baseRevision' is distinct from 'null'::jsonb then perform private.blog_fail('REVISION_CONFLICT');end if;
   if not(p_input?'baseRevision') or (p_input->'baseRevision'<>'null'::jsonb and (jsonb_typeof(p_input->'baseRevision')<>'number' or p_input->>'baseRevision'!~'^[1-9][0-9]{0,15}$')) then perform private.blog_fail('REVISION_CONFLICT');end if;
   id:=private.blog_save(id,private.blog_revision_value(p_input->'baseRevision',true),p_input->'document',null,c.id);
   insert into private.socialhero_post_mappings(site_id,destination_id,external_id,post_id) values(c.site_id,c.destination_id,p_input->>'externalId',id) on conflict(site_id,destination_id,external_id) do nothing;
   result:=private.blog_post_status(id,p_input->>'externalId');
  else
   if id is null then perform private.blog_fail('POST_NOT_FOUND');end if;
   publication:=private.blog_request_publish(id,private.blog_revision_value(p_input->'revision'),null,null,c.id);result:=jsonb_build_object('status',private.blog_post_status(id,p_input->>'externalId'),'publicationId',publication);
  end if;
  insert into private.socialhero_operations(site_id,destination_id,operation,operation_key,fingerprint,response,publication_id) values(c.site_id,c.destination_id::text,p_action,p_input->>'idempotencyKey',fp,result,publication);
  return result;
 end if;perform private.blog_fail('INVALID_CONTENT');return null;
end$$;

create function private.blog_publication_context(j private.blog_publications) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('publicationId',j.id,'leaseId',j.lease_id,'postId',j.post_id,'revision',j.revision,'publicUrl',private.blog_site()->>'origin'||'/blog/'||(r.document->>'slug'),'proof',j.proof,'alreadyPromoted',j.promoted_at is not null) from private.blog_revisions r where r.post_id=j.post_id and r.revision=j.revision$$;
create function private.blog_service(p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.blog_installation;a private.socialhero_pairing_attempts;c private.socialhero_connections;m private.blog_media;j private.blog_publications;p private.blog_posts;r private.blog_revisions;code text;token text;result jsonb;valid boolean;next_at timestamptz;
begin
 perform private.blog_lock();perform private.blog_site();select * into strict s from private.blog_installation where singleton;
 if p_action='worker_verify' then return jsonb_build_object('valid',private.blog_verify_worker(p_input));
 elsif p_action='cleanup' then perform private.blog_cleanup();return '{"cleaned":true}'::jsonb;
 elsif p_action='pair_context' then
  select * into a from private.socialhero_pairing_attempts where id=(p_input->>'attemptId')::uuid;
  if not found or a.id is distinct from s.current_attempt_id or a.generation<>s.binding_generation or a.state not in ('claiming','pending') then perform private.blog_fail('DESTINATION_MISMATCH');end if;
  if a.expires_at<=clock_timestamp() then perform private.blog_fail('PAIRING_EXPIRED');end if;
  if not private.blog_actor_valid(a.actor_id,a.session_id) then perform private.blog_fail('PERMISSION_DENIED');end if;
  select decrypted_secret into code from vault.decrypted_secrets where id=a.code_secret_id;select decrypted_secret into token from vault.decrypted_secrets where id=a.token_secret_id;
  return jsonb_build_object('attemptId',a.id,'code',code,'accessToken',token,'connectionId',a.connection_id,'site',private.blog_site()||jsonb_build_object('socialheroOrigin',s.socialhero_origin),'expiresAt',a.expires_at);
 elsif p_action='pair_activate' then
  select * into a from private.socialhero_pairing_attempts where id=(p_input->>'attemptId')::uuid for update;
  if not found or a.id is distinct from s.current_attempt_id or a.generation<>s.binding_generation or a.connection_id is distinct from (p_input->>'connectionId')::uuid then perform private.blog_fail('DESTINATION_MISMATCH');end if;
  if a.state='active' then return private.blog_connection_view();end if;
  if a.state<>'pending' or a.expires_at<=clock_timestamp() then perform private.blog_fail('PAIRING_EXPIRED');end if;
  if not private.blog_actor_valid(a.actor_id,a.session_id) then perform private.blog_fail('PERMISSION_DENIED');end if;
  select * into strict c from private.socialhero_connections where id=a.connection_id and state='pending';
  update private.socialhero_connections set state='revoked',revoked_at=clock_timestamp() where id=c.supersedes_id and state='active';
  update private.socialhero_connections set state='active',connected_at=clock_timestamp(),last_checked_at=clock_timestamp() where id=c.id;
  update private.blog_installation set active_connection_id=c.id where singleton;
  delete from vault.secrets where id in(a.code_secret_id,a.token_secret_id);
  update private.socialhero_pairing_attempts set state='active',code_secret_id=null,token_secret_id=null where id=a.id;return private.blog_connection_view();
 elsif p_action='pair_fail' then
  select * into a from private.socialhero_pairing_attempts where id=(p_input->>'attemptId')::uuid;
  if a.id is null then perform private.blog_fail('DESTINATION_MISMATCH');end if;
  if p_input->>'definitive'='true' and a.state in ('claiming','pending') then
   delete from vault.secrets where id in(a.code_secret_id,a.token_secret_id);update private.socialhero_pairing_attempts set state='rejected',code_secret_id=null,token_secret_id=null,last_error=case when p_input->>'code'~'^[A-Z_]{1,80}$' then p_input->>'code' else 'PAIRING_FAILED' end where id=a.id;
   update private.socialhero_connections set state='revoked',revoked_at=clock_timestamp() where attempt_id=a.id and state='pending';
  end if;return private.blog_connection_view();
 elsif p_action in ('media_context','media_complete') then
  select * into m from private.blog_media where id=(p_input->>'assetId')::uuid;
  if not found or m.site_id<>s.site_id then perform private.blog_fail('INVALID_MEDIA');end if;
  if m.state='reserved' and ((p_input->>'leaseId')::uuid is distinct from m.lease_id or m.lease_until<=clock_timestamp()) then perform private.blog_fail('LEASE_EXPIRED');end if;
  if p_action='media_context' then return private.blog_media_context(m);end if;
  if m.state<>'ready' then
   if m.connection_id is not null then valid:=private.blog_connection_valid(m.connection_id,false);else valid:=private.blog_actor_valid(m.actor_id,m.session_id);end if;
   if not coalesce(valid,false) then perform private.blog_fail('PERMISSION_DENIED');end if;
   update private.blog_media set state='ready' where id=m.id;
  end if;
  return jsonb_build_object('assetId',m.id,'mimeType',m.mime_type,'width',m.width,'height',m.height);
 elsif p_action='publication_claim' then
  perform private.blog_cleanup();
  select * into j from private.blog_publications where (p_input->>'publicationId' is null or id=(p_input->>'publicationId')::uuid) and ((state='queued' and next_attempt_at<=clock_timestamp()) or (state='working' and lease_until<=clock_timestamp())) and attempts<8 order by created_at,id for update skip locked limit 1;
  if not found then return '{"claim":null}'::jsonb;end if;
  update private.blog_publications set state='working',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=j.id returning * into j;
  return jsonb_build_object('claim',private.blog_publication_context(j));
 elsif p_action in ('publication_promote','publication_confirm','publication_fail') then
  select * into j from private.blog_publications where id=(p_input->>'publicationId')::uuid and lease_id=(p_input->>'leaseId')::uuid for update;
  if not found or j.state<>'working' or j.lease_until<=clock_timestamp() then perform private.blog_fail('LEASE_EXPIRED');end if;
  select * into strict p from private.blog_posts where id=j.post_id for update;
  if p_action='publication_fail' then
   code:=case when p_input->>'code'~'^[A-Z_]{1,80}$' then p_input->>'code' else 'VERIFICATION_FAILED' end;
   next_at:=case when j.attempts<8 and code not in ('PERMISSION_DENIED','PUBLICATION_STALE') then clock_timestamp()+make_interval(secs=>least(3600,10*(2^j.attempts)::integer)) end;
   update private.blog_publications set state=case when next_at is null then 'cancelled' else 'queued' end,next_attempt_at=coalesce(next_at,next_attempt_at),lease_id=null,lease_until=null,last_error=code where id=j.id;
   return jsonb_build_object('retry',next_at is not null,'nextAttemptAt',next_at);
  elsif p_action='publication_promote' then
   if j.promoted_at is not null then return private.blog_publication_context(j);end if;
   if p.revision<>j.revision or p.draft_revision is distinct from j.revision then perform private.blog_fail('PUBLICATION_STALE');end if;
   if j.connection_id is not null then valid:=private.blog_connection_valid(j.connection_id,true);else valid:=private.blog_actor_valid(j.actor_id,j.session_id);end if;
   if not coalesce(valid,false) then perform private.blog_fail('PERMISSION_DENIED');end if;
   select * into strict r from private.blog_revisions where post_id=j.post_id and revision=j.revision;
   update private.blog_slug_claims set ever_published=true where site_id=s.site_id and locale='nl-NL' and slug=r.document->>'slug' and post_id=p.id;
   update private.blog_posts set live_revision=j.revision,published_at=coalesce(published_at,clock_timestamp()) where id=p.id;
   update private.blog_publications set promoted_at=clock_timestamp() where id=j.id returning * into j;return private.blog_publication_context(j);
  else
   if j.promoted_at is null or p.live_revision is distinct from j.revision or p_input->>'proof' is distinct from j.proof then perform private.blog_fail('PUBLICATION_STALE');end if;
   update private.blog_posts set verified_revision=j.revision,draft_revision=case when draft_revision=j.revision then null else draft_revision end where id=p.id;
   update private.blog_publications set state='published',verified_at=clock_timestamp(),lease_id=null,lease_until=null,last_error=null where id=j.id;
   return jsonb_build_object('published',true,'postId',j.post_id,'revision',j.revision);
  end if;
 end if;perform private.blog_fail('INVALID_CONTENT');return null;
end$$;

-- No direct table access, helper execution, private schema exposure or service
-- writes beyond the deliberately narrow dispatchers. Newly added helpers must
-- retain this prefix so the explicit revocation catches them as well.
do $acl$ declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'blog_%' or p.proname='configure_blog_installation') loop execute 'revoke all on function '||f.sig||' from public,anon,authenticated,service_role';end loop;
end$acl$;
create function public.blog_public(p_action text,p_input jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.blog_public(p_action,p_input)$$;
create function public.blog_admin(p_action text,p_input jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.blog_admin(p_action,p_input)$$;
create function public.blog_connector(p_token_hash text,p_action text,p_input jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.blog_connector(p_token_hash,p_action,p_input)$$;
create function public.blog_service(p_action text,p_input jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.blog_service(p_action,p_input)$$;
revoke all on function public.blog_public(text,jsonb),public.blog_admin(text,jsonb),public.blog_connector(text,text,jsonb),public.blog_service(text,jsonb) from public,anon,authenticated,service_role;
grant usage on schema private to anon,service_role;
grant execute on function public.blog_public(text,jsonb),private.blog_public(text,jsonb) to anon,authenticated,service_role;
grant execute on function public.blog_admin(text,jsonb),private.blog_admin(text,jsonb) to authenticated;
grant execute on function public.blog_connector(text,text,jsonb),private.blog_connector(text,text,jsonb),public.blog_service(text,jsonb),private.blog_service(text,jsonb) to service_role;

-- Opt-in owner bootstrap only. The migration creates no cron job, Storage
-- bucket, external request or credential. Unknown projects fail closed.
create table private.blog_worker_schedule(singleton boolean primary key default true check(singleton),project_ref text not null,cron_job_id bigint not null,last_tick_at timestamptz);
create table private.blog_worker_nonces(nonce uuid primary key,expires_at timestamptz not null);
alter table private.blog_worker_schedule enable row level security;
alter table private.blog_worker_nonces enable row level security;
revoke all on private.blog_worker_schedule,private.blog_worker_nonces from public,anon,authenticated,service_role;
create function private.blog_verify_worker(p jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare secret text;project text;expected bytea;supplied bytea;issued bigint;n uuid;added integer;different integer:=0;i integer;
begin
 if p->>'timestamp'!~'^[0-9]{10,12}$' or not private.blog_uuid(p->>'nonce') or p->>'signature'!~'^[a-f0-9]{64}$' or p->>'bodySha256'!~'^[a-f0-9]{64}$' then return false;end if;
 issued:=(p->>'timestamp')::bigint;n:=(p->>'nonce')::uuid;if abs(extract(epoch from clock_timestamp())-issued)>60 then return false;end if;
 select project_ref into project from private.blog_worker_schedule where singleton;if project is null then return false;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_blog_worker_hmac';if secret is null then return false;end if;
 expected:=extensions.hmac(convert_to('fabelpad-blog-worker-v1'||chr(10)||project||chr(10)||issued::text||chr(10)||n::text||chr(10)||(p->>'bodySha256'),'UTF8'),decode(secret,'hex'),'sha256');supplied:=decode(p->>'signature','hex');
 for i in 0..31 loop different:=different|(get_byte(expected,i)#get_byte(supplied,i));end loop;if different<>0 then return false;end if;
 delete from private.blog_worker_nonces where expires_at<clock_timestamp();insert into private.blog_worker_nonces values(n,clock_timestamp()+interval '5 minutes') on conflict do nothing;get diagnostics added=row_count;
 if added=1 then update private.blog_worker_schedule set last_tick_at=clock_timestamp() where singleton;end if;return added=1;
exception when others then return false;
end$$;
create function private.invoke_blog_worker() returns bigint language plpgsql set search_path='' as $$
declare secret text;project text;issued bigint:=floor(extract(epoch from clock_timestamp()))::bigint;n uuid:=gen_random_uuid();signature text;body_hash text:=encode(extensions.digest('{}','sha256'),'hex');begin
 select project_ref into project from private.blog_worker_schedule where singleton;if project not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') or project is null then perform private.blog_fail('CONFIGURATION_REQUIRED');end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_blog_worker_hmac';if secret is null then perform private.blog_fail('CONFIGURATION_REQUIRED');end if;
 signature:=encode(extensions.hmac(convert_to('fabelpad-blog-worker-v1'||chr(10)||project||chr(10)||issued::text||chr(10)||n::text||chr(10)||body_hash,'UTF8'),decode(secret,'hex'),'sha256'),'hex');
 return net.http_post(url:='https://'||project||'.supabase.co/functions/v1/blog-runtime/worker',body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-fabelpad-timestamp',issued::text,'x-fabelpad-nonce',n::text,'x-fabelpad-signature',signature),timeout_milliseconds:=45000);
end$$;
create function private.configure_blog_storage() returns jsonb language plpgsql security invoker set search_path='' as $$declare b record;begin
 perform private.blog_site();select * into b from storage.buckets where id='fabelpad-blog';
 if found then if b.public or b.name<>'fabelpad-blog' or b.file_size_limit is null or b.file_size_limit<>8388608 or b.allowed_mime_types is null or not(b.allowed_mime_types @> array['image/png','image/jpeg']) or not(b.allowed_mime_types <@ array['image/png','image/jpeg']) then perform private.blog_fail('STORAGE_CONFIGURATION_CONFLICT');end if;
 else insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fabelpad-blog','fabelpad-blog',false,8388608,array['image/png','image/jpeg']);end if;
 return '{"configured":true,"bucket":"fabelpad-blog","private":true}'::jsonb;
end$$;
create function private.configure_blog_worker_schedule() returns jsonb language plpgsql security invoker set search_path='' as $$declare s private.blog_installation;secret text;j record;job_id bigint;begin
 perform private.blog_lock();select * into strict s from private.blog_installation where singleton;
 if s.environment not in ('staging','production') or s.project_ref not in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs') then perform private.blog_fail('DESTINATION_MISMATCH');end if;
 perform private.configure_blog_storage();select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_blog_worker_hmac';
 if secret is null then perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'fabelpad_blog_worker_hmac','Fabelpad blog scheduler HMAC');elsif secret!~'^[a-f0-9]{64}$' then perform private.blog_fail('CONFIGURATION_REQUIRED');end if;
 select * into j from cron.job where jobname='fabelpad-blog-publication';
 if found then if j.command<>'select private.invoke_blog_worker();' or j.schedule<>'* * * * *' or j.database<>current_database() or j.username<>current_user or not j.active then perform private.blog_fail('SCHEDULER_CONFIGURATION_CONFLICT');end if;job_id:=j.jobid;
 else job_id:=cron.schedule('fabelpad-blog-publication','* * * * *','select private.invoke_blog_worker();');end if;
 insert into private.blog_worker_schedule(singleton,project_ref,cron_job_id) values(true,s.project_ref,job_id) on conflict(singleton) do update set cron_job_id=excluded.cron_job_id where blog_worker_schedule.project_ref=excluded.project_ref;
 return jsonb_build_object('configured',true,'projectRef',s.project_ref,'cronJobName','fabelpad-blog-publication');
end$$;
revoke all on function private.blog_verify_worker(jsonb),private.invoke_blog_worker(),private.configure_blog_storage(),private.configure_blog_worker_schedule() from public,anon,authenticated,service_role;
