-- Audio is an additive, project-local release. The original text, billing,
-- consent and immutable release contracts remain authoritative.
alter function private.valid_family_snapshot_before_birth_dates(jsonb) rename to valid_family_snapshot_before_voice_slot;
revoke all on function private.valid_family_snapshot_before_voice_slot(jsonb) from public,anon,authenticated,service_role;
create function private.valid_family_snapshot_before_birth_dates(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare entry record;prefs jsonb;clean jsonb:=p;begin
 if jsonb_typeof(p->'data') is distinct from 'object' then return false;end if;
 for entry in select * from jsonb_each(p->'data') loop
 prefs:=entry.value->'prefs';
 if jsonb_typeof(prefs)='object' and prefs?'voiceSlot' then
 if jsonb_typeof(prefs->'voiceSlot') is distinct from 'string' or prefs->>'voiceSlot'!~'^stem-[1-5]$' then return false;end if;
 clean:=jsonb_set(clean,array['data',entry.key,'prefs'],prefs-'voiceSlot');
 end if;
 end loop;
 return private.valid_family_snapshot_before_voice_slot(clean);
exception when others then return false;
end$$;
revoke all on function private.valid_family_snapshot_before_birth_dates(jsonb) from public,anon,authenticated,service_role;
create table private.narration_control (
 singleton boolean primary key default true check(singleton),
 revision bigint not null default 0 check(revision between 0 and 9007199254740991),
 settings jsonb not null default '{}', secret_id uuid,
 tested_revision bigint, last_test_at timestamptz, last_test_result text,
 last_tick_at timestamptz, updated_by uuid references auth.users on delete set null,
 updated_at timestamptz not null default clock_timestamp()
);
insert into private.narration_control(singleton) values(true);
create table private.narration_jobs (
 id uuid primary key default gen_random_uuid(), identity_key text not null unique,
 story_id text not null, content_version text not null, source_kind text not null,
 source_revision bigint, source_fingerprint text not null, source jsonb not null,
 configuration_revision bigint not null, settings jsonb not null,
 plan jsonb, state text not null default 'waiting', reason text,
 expected_items integer not null default 0, completed_items integer not null default 0,
 attempt integer not null default 0, lease_id uuid, lease_until timestamptz,
 available_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp(), published_at timestamptz
);
create index narration_jobs_due on private.narration_jobs(available_at,created_at) where state in ('waiting','queued','planning','working');
create table private.narration_items (
 job_id uuid not null references private.narration_jobs on delete cascade,
 id text not null, fingerprint text not null, specification jsonb not null,
 state text not null default 'pending', reason text, asset_id uuid,force_generation boolean not null default false,
 attempt integer not null default 0, uncertain_attempts integer not null default 0,
 lease_id uuid, lease_until timestamptz, available_at timestamptz not null default clock_timestamp(),
 transcript text, reviewed_by uuid references auth.users on delete set null,
 reviewed_at timestamptz, review_note text, primary key(job_id,id)
);
create index narration_items_due on private.narration_items(available_at,job_id) where state in ('pending','working');
create index narration_items_fingerprint on private.narration_items(fingerprint);
create table private.narration_assets (
 id uuid primary key default gen_random_uuid(), fingerprint text not null,
 object_path text not null unique, sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 byte_length bigint not null check(byte_length between 45 and 16777216),
 duration_ms integer not null check(duration_ms between 1 and 180000),
 mime_type text not null check(mime_type='audio/wav'),
 quality text not null check(quality in ('pass','review','rejected')),
 provider_confirmed boolean not null check(provider_confirmed), transcript text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.narration_items add constraint narration_item_asset foreign key(asset_id) references private.narration_assets;
create index narration_assets_reuse on private.narration_assets(fingerprint) where quality='pass';
create table private.narration_asset_decisions (
 asset_id uuid primary key references private.narration_assets,approved boolean not null,
 actor_id uuid references auth.users on delete set null,reviewed_at timestamptz not null default clock_timestamp()
);
create table private.narration_budget (
 id uuid primary key default gen_random_uuid(),job_id uuid not null,item_id text not null,
 attempt integer not null,lease_id uuid not null,reserved_cents integer not null check(reserved_cents between 1 and 10000),
 actual_cents integer check(actual_cents>=0),usage jsonb,unknown boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),unique(job_id,item_id,attempt),
 foreign key(job_id,item_id) references private.narration_items(job_id,id)
);
create table private.narration_manifests (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references private.narration_jobs,
 story_id text not null,content_version text not null,reading_level text not null,voice_slot text not null,
 audio_revision bigint generated always as identity,manifest jsonb not null,
 published_at timestamptz not null default clock_timestamp(),
 unique(story_id,content_version,reading_level,voice_slot,audio_revision)
);
create table private.narration_active_manifests (
 story_id text not null,content_version text not null,reading_level text not null,voice_slot text not null,
 manifest_id uuid not null references private.narration_manifests,
 primary key(story_id,content_version,reading_level,voice_slot)
);
create table private.narration_catalogue_plans (
 id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users on delete set null,
 configuration_revision bigint not null,selection jsonb not null,estimate jsonb not null,
 created_at timestamptz not null default clock_timestamp(),consumed_at timestamptz
);
create table private.narration_served_sources (
 story_id text not null,content_version text not null,payload jsonb not null,source_fingerprint text not null,
 primary key(story_id,content_version)
);
create table private.narration_tests (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users on delete cascade,
 configuration_revision bigint not null,reserved_cents integer not null default 12,actual_cents integer check(actual_cents>=0),usage jsonb,unknown boolean not null default true,
 created_at timestamptz not null default clock_timestamp(),consumed_at timestamptz
);
create table private.narration_audit (
 id bigint generated always as identity primary key,actor_id uuid references auth.users on delete set null,
 action text not null,target_id uuid,details jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create table private.narration_worker_schedule (
 singleton boolean primary key default true check(singleton),project_ref text not null check(project_ref='tlwfpivafcokcjyjwgmq'),cron_job_id bigint not null
);
create table private.narration_worker_nonces(nonce uuid primary key,expires_at timestamptz not null);
do $$ declare r record;begin
 for r in select tablename from pg_tables where schemaname='private' and tablename like 'narration_%' loop
 execute format('alter table private.%I enable row level security',r.tablename);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',r.tablename);
 end loop;
end $$;

create function private.narration_admin(p_fresh boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;begin
 actor:=case when p_fresh then private.require_fresh_parent() else private.lifecycle_identity() end;
 if not private.family_access_allowed(actor) or not private.is_confirmed_email_admin(actor) then raise exception 'narration_admin_required' using errcode='42501';end if;
 return actor;
end$$;
create function private.narration_lock() returns void language sql volatile set search_path='' as $$select pg_advisory_xact_lock(1633837926,711)$$;
create function private.narration_bump() returns void language sql volatile set search_path='' as $$update private.narration_control set revision=revision+1,tested_revision=case when tested_revision=revision then revision+1 else null end,updated_at=clock_timestamp()$$;
create function private.narration_asset_available(p_asset_id uuid) returns boolean language sql stable set search_path='' as $$select exists(select 1 from private.narration_assets where id=p_asset_id) and not exists(select 1 from private.narration_asset_decisions where asset_id=p_asset_id and not approved)$$;
create function private.narration_pack_available(p_pack jsonb) returns boolean language sql stable set search_path='' as $$select not exists(select 1 from jsonb_each(p_pack->'assets') a where not private.narration_asset_available((a.value->>'id')::uuid))$$;
create function private.narration_defaults() returns jsonb language sql immutable set search_path='' as $$
 select '{"generationEnabled":false,"playbackEnabled":false,"defaultVoiceSlot":"stem-1","model":"gpt-realtime-2.1-mini","styleVersion":1,"budgetCents":2500,"maxParallel":1,"slots":[{"slotId":"stem-1","label":"Warme verteller","providerVoice":"marin","presetVersion":1,"model":"gpt-realtime-2.1-mini","locale":"nl-NL","instructions":"Lees de aangeleverde tekst letterlijk voor in helder Nederlands. Spreek rustig, warm en duidelijk, met natuurlijke korte rustpunten. Dialogen blijven letterlijk. Voeg geen uitleg, begroeting, muziek of andere woorden toe. Spannende passages blijven kalm en verstaanbaar.","styleVersion":1,"pronunciationVersion":1,"encoderVersion":1},{"slotId":"stem-2","label":"Zachte voorlezer","providerVoice":"cedar","presetVersion":1,"model":"gpt-realtime-2.1-mini","locale":"nl-NL","instructions":"Lees de aangeleverde tekst letterlijk voor in helder Nederlands. Spreek rustig, warm en duidelijk, met natuurlijke korte rustpunten. Dialogen blijven letterlijk. Voeg geen uitleg, begroeting, muziek of andere woorden toe. Spannende passages blijven kalm en verstaanbaar.","styleVersion":1,"pronunciationVersion":1,"encoderVersion":1},{"slotId":"stem-3","label":"Heldere verteller","providerVoice":"sage","presetVersion":1,"model":"gpt-realtime-2.1-mini","locale":"nl-NL","instructions":"Lees de aangeleverde tekst letterlijk voor in helder Nederlands. Spreek rustig, warm en duidelijk, met natuurlijke korte rustpunten. Dialogen blijven letterlijk. Voeg geen uitleg, begroeting, muziek of andere woorden toe. Spannende passages blijven kalm en verstaanbaar.","styleVersion":1,"pronunciationVersion":1,"encoderVersion":1},{"slotId":"stem-4","label":"Sprookjesstem","providerVoice":"ballad","presetVersion":1,"model":"gpt-realtime-2.1-mini","locale":"nl-NL","instructions":"Lees de aangeleverde tekst letterlijk voor in helder Nederlands. Spreek rustig, warm en duidelijk, met natuurlijke korte rustpunten. Dialogen blijven letterlijk. Voeg geen uitleg, begroeting, muziek of andere woorden toe. Spannende passages blijven kalm en verstaanbaar.","styleVersion":1,"pronunciationVersion":1,"encoderVersion":1},{"slotId":"stem-5","label":"Vrolijke verteller","providerVoice":"shimmer","presetVersion":1,"model":"gpt-realtime-2.1-mini","locale":"nl-NL","instructions":"Lees de aangeleverde tekst letterlijk voor in helder Nederlands. Spreek rustig, warm en duidelijk, met natuurlijke korte rustpunten. Dialogen blijven letterlijk. Voeg geen uitleg, begroeting, muziek of andere woorden toe. Spannende passages blijven kalm en verstaanbaar.","styleVersion":1,"pronunciationVersion":1,"encoderVersion":1}],"cueCatalogue":[{"id":"avonturier","kind":"fallback","displayName":"Avonturier","pronunciations":[{"id":"nl","spokenSpelling":"Avonturier"}]},{"id":"n-noor","kind":"firstName","displayName":"Noor","pronunciations":[{"id":"nl","spokenSpelling":"Noor"}]},{"id":"n-amir","kind":"firstName","displayName":"Amir","pronunciations":[{"id":"nl","spokenSpelling":"Amir"}]},{"id":"n-aisha","kind":"firstName","displayName":"Aïsha","pronunciations":[{"id":"nl","spokenSpelling":"Aïsha"}]},{"id":"n-celine","kind":"firstName","displayName":"Céline","pronunciations":[{"id":"nl","spokenSpelling":"Céline"}]},{"id":"a-dappere-vos","kind":"alias","displayName":"Dappere Vos","pronunciations":[{"id":"nl","spokenSpelling":"Dappere Vos"}]},{"id":"a-kleine-kompasheld","kind":"alias","displayName":"Kleine Kompasheld","pronunciations":[{"id":"nl","spokenSpelling":"Kleine Kompasheld"}]}],"nameCues":[{"id":"kom-mee","template":"Kom mee, {{naam}}."},{"id":"jij-bent-aan-zet","template":"Jij bent aan zet, {{naam}}."},{"id":"goed-gedaan","template":"Goed gedaan, {{naam}}."},{"id":"daar-ga-je","template":"Daar ga je, {{naam}}."}],"namePackVersion":1}'::jsonb
$$;
update private.narration_control set settings=private.narration_defaults();
create function private.valid_narration_settings(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare slot jsonb;entry jsonb;pronunciation jsonb;cue jsonb;i integer:=0;ids text[]:='{}';begin
 if jsonb_typeof(p) is distinct from 'object' or not(p?&array['generationEnabled','playbackEnabled','defaultVoiceSlot','model','styleVersion','budgetCents','maxParallel','slots'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in ('generationEnabled','playbackEnabled','defaultVoiceSlot','model','styleVersion','budgetCents','maxParallel','slots','cueCatalogue','nameCues','namePackVersion'))
 or jsonb_typeof(p->'generationEnabled')<>'boolean' or jsonb_typeof(p->'playbackEnabled')<>'boolean'
 or p->>'defaultVoiceSlot'!~'^stem-[1-5]$' or p->>'model' not in ('gpt-realtime-2.1-mini','gpt-realtime-2.1')
 or p->>'styleVersion'!~'^[1-9][0-9]{0,5}$' or p->>'budgetCents'!~'^[0-9]{1,7}$' or (p->>'budgetCents')::integer>1000000
 or p->>'maxParallel' not in ('1','2') or jsonb_typeof(p->'slots')<>'array' or jsonb_array_length(p->'slots')<>5 or octet_length(p::text)>65536 then return false;end if;
 for slot in select * from jsonb_array_elements(p->'slots') loop
 i:=i+1;
 if slot->>'slotId'<>'stem-'||i or not(slot?&array['slotId','label','providerVoice','instructions','presetVersion'])
 or exists(select 1 from jsonb_object_keys(slot) k where k not in ('slotId','label','providerVoice','instructions','presetVersion','model','locale','styleVersion','pronunciationVersion','encoderVersion'))
 or private.valid_snapshot_text(slot->'label',80) is distinct from true
 or private.valid_snapshot_text(slot->'instructions',4000) is distinct from true
 or slot->>'model' is distinct from p->>'model' or slot->>'locale' is distinct from 'nl-NL' or slot->'styleVersion' is distinct from p->'styleVersion'
 or slot?'encoderVersion' and slot->>'encoderVersion'<>'1'
 or slot?'pronunciationVersion' and slot->>'pronunciationVersion'!~'^[1-9][0-9]{0,8}$'
 or slot->>'providerVoice' not in ('marin','cedar','sage','ballad','shimmer')
 or slot->>'presetVersion'!~'^[1-9][0-9]{0,8}$' then return false;end if;
 end loop;
 if jsonb_typeof(p->'cueCatalogue') is distinct from 'array' or jsonb_array_length(p->'cueCatalogue') not between 1 and 2000 or jsonb_typeof(p->'nameCues') is distinct from 'array' or jsonb_array_length(p->'nameCues') not between 1 and 20 or p->>'namePackVersion'!~'^[1-9][0-9]{0,8}$' then return false;end if;
 for entry in select * from jsonb_array_elements(p->'cueCatalogue') loop
 if not(entry?&array['id','kind','displayName','pronunciations']) or(select count(*) from jsonb_object_keys(entry))<>4 or entry->>'id'!~'^[a-z0-9][a-z0-9-]{0,79}$' or entry->>'id'=any(ids) or entry->>'kind' not in ('firstName','alias','fallback') or private.valid_snapshot_text(entry->'displayName',100) is distinct from true or jsonb_typeof(entry->'pronunciations')<>'array' or jsonb_array_length(entry->'pronunciations') not between 1 and 5 then return false;end if;
 ids:=array_append(ids,entry->>'id');
 for pronunciation in select * from jsonb_array_elements(entry->'pronunciations') loop
 if not(pronunciation?&array['id','spokenSpelling']) or(select count(*) from jsonb_object_keys(pronunciation))<>2 or pronunciation->>'id'!~'^[a-z0-9][a-z0-9-]{0,79}$' or private.valid_snapshot_text(pronunciation->'spokenSpelling',100) is distinct from true or pronunciation->>'spokenSpelling'~'[{}<>]' then return false;end if;
 end loop;
 end loop;
 if not exists(select 1 from jsonb_array_elements(p->'cueCatalogue')n where n->>'id'='avonturier' and n->>'kind'='fallback' and n->>'displayName'='Avonturier' and n->'pronunciations' @> '[{"id":"nl","spokenSpelling":"Avonturier"}]'::jsonb) then return false;end if;
 ids:='{}';
 for cue in select * from jsonb_array_elements(p->'nameCues') loop
 if not(cue?&array['id','template']) or(select count(*) from jsonb_object_keys(cue))<>2 or cue->>'id'!~'^[a-z0-9][a-z0-9-]{0,79}$' or cue->>'id'=any(ids) or private.valid_snapshot_text(cue->'template',300) is distinct from true or length(cue->>'template')-length(replace(cue->>'template','{{naam}}',''))<>8 or replace(cue->>'template','{{naam}}','')~'[{}<>]' then return false;end if;
 ids:=array_append(ids,cue->>'id');end loop;
 return true;
exception when others then return false;
end$$;

create function private.narration_snapshot(p_job_id uuid default null) returns jsonb language plpgsql stable set search_path='' as $$
declare c private.narration_control;detail jsonb;begin
 select * into strict c from private.narration_control;
 if p_job_id is not null then
 select jsonb_build_object('jobId',j.id,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'readingLevel',i.specification->>'readingLevel','voiceSlot',i.specification#>>'{preset,slotId}','kind',i.specification->>'kind','route',i.specification->>'route','choiceIndex',i.specification->'choiceIndex','state',i.state,'transcript',i.transcript,'expectedText',i.specification->>'text','reviewReason',i.reason,'assetId',i.asset_id,'durationMs',a.duration_ms) order by i.id) from private.narration_items i left join private.narration_assets a on a.id=i.asset_id where i.job_id=j.id),'[]')) into detail from private.narration_jobs j where j.id=p_job_id;
 end if;
 return jsonb_build_object('environment',private.billing_environment(),'revision',c.revision,'settings',c.settings,
 'keyConfigured',c.secret_id is not null,'lastTestAt',c.last_test_at,'lastTestResult',c.last_test_result,
 'providerConfirmed',c.tested_revision=c.revision and c.last_test_result='passed',
 'supportedModels',jsonb_build_array('gpt-realtime-2.1-mini','gpt-realtime-2.1'),
 'workerHealth',jsonb_build_object('lastTickAt',c.last_tick_at,'state',case when c.last_tick_at>clock_timestamp()-interval '5 minutes' then 'healthy' when exists(select 1 from private.narration_worker_schedule) then 'waiting' else 'not_configured' end),
 'queue',coalesce((select jsonb_agg(q order by q."createdAt" desc) from(select j.id,j.story_id as "storyId",j.content_version as "contentVersion",j.source_kind as "sourceKind",j.state,j.reason,j.expected_items as "expectedItems",j.completed_items as "completedItems",(select count(*) from private.narration_items i where i.job_id=j.id and i.state='review') as "reviewItems",j.attempt,j.created_at as "createdAt" from private.narration_jobs j order by j.created_at desc limit 100)q),'[]'),
 'coverage',jsonb_build_object('expectedCombinations',(select count(*)*15 from(select story_id,content_version from public.content_releases union select story_id,content_version from private.billing_premium_releases union select story_id,content_version from private.narration_served_sources) sources),'publishedCombinations',(select count(*) from private.narration_active_manifests),'missingItems',(select count(*) from private.narration_items where state<>'approved'),'uniqueAssets',(select count(*) from private.narration_assets)),
 'usage',(select jsonb_build_object('reservedCents',coalesce(sum(case when actual_cents is null then reserved_cents else 0 end),0),'actualCents',coalesce(sum(actual_cents),0),'unknownAttempts',count(*)filter(where unknown),'textInputTokens',coalesce(sum(case when usage->>'textInputTokens'~'^[0-9]{1,12}$' then(usage->>'textInputTokens')::bigint else 0 end),0),'audioOutputTokens',coalesce(sum(case when usage->>'audioOutputTokens'~'^[0-9]{1,12}$' then(usage->>'audioOutputTokens')::bigint else 0 end),0),'textOutputTokens',coalesce(sum(case when usage->>'textOutputTokens'~'^[0-9]{1,12}$' then(usage->>'textOutputTokens')::bigint else 0 end),0)) from(select reserved_cents,actual_cents,unknown,usage from private.narration_budget union all select reserved_cents,actual_cents,unknown,usage from private.narration_tests)budget),
 'detail',detail);
end$$;
create function private.get_narration_admin_status(p_job_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.narration_admin(false);return private.narration_snapshot(p_job_id);end$$;

create function private.save_narration_settings(p_expected_revision bigint,p_settings jsonb,p_api_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.narration_admin(true);c private.narration_control;slot jsonb;old_slot jsonb;begin
 perform private.narration_lock();select * into strict c from private.narration_control for update;
 if c.revision is distinct from p_expected_revision then return jsonb_build_object('saved',false)||private.narration_snapshot();end if;
 if private.valid_narration_settings(p_settings) is distinct from true or (p_api_key is not null and p_api_key!~'^sk-[A-Za-z0-9_-]{16,250}$') then raise exception 'narration_invalid_request' using errcode='22023';end if;
 -- Slot semantics are immutable per preset version; labels alone are display metadata.
 for slot in select * from jsonb_array_elements(p_settings->'slots') loop
 select s into old_slot from jsonb_array_elements(c.settings->'slots') s where s->>'slotId'=slot->>'slotId';
 if (slot-'label'-'presetVersion') is distinct from (old_slot-'label'-'presetVersion') or p_settings->'model' is distinct from c.settings->'model' or p_settings->'styleVersion' is distinct from c.settings->'styleVersion' then
 if (slot->>'presetVersion')::bigint<=(old_slot->>'presetVersion')::bigint then raise exception 'narration_preset_version_required' using errcode='22023';end if;
 elsif slot->'presetVersion' is distinct from old_slot->'presetVersion' then raise exception 'narration_preset_version_invalid' using errcode='22023';end if;
 end loop;
 if (p_settings->'cueCatalogue' is distinct from c.settings->'cueCatalogue' or p_settings->'nameCues' is distinct from c.settings->'nameCues') and coalesce((p_settings->>'namePackVersion')::bigint,1)<=coalesce((c.settings->>'namePackVersion')::bigint,1) then raise exception 'narration_name_pack_version_required' using errcode='22023';end if;
 if p_api_key is not null then
 if c.secret_id is null then c.secret_id:=vault.create_secret(p_api_key,'fabelpad_narration_openai_key','Fabelpad staging narration provider');else perform vault.update_secret(c.secret_id,p_api_key);end if;
 end if;
 update private.narration_control set revision=revision+1,settings=p_settings,secret_id=c.secret_id,tested_revision=case when p_api_key is null and c.tested_revision=c.revision and private.narration_semantic(c.settings)=private.narration_semantic(p_settings) then revision+1 else null end,last_test_result=case when p_api_key is not null then 'not_tested' else last_test_result end,updated_by=actor,updated_at=clock_timestamp() where singleton;
 if private.narration_semantic(c.settings) is distinct from private.narration_semantic(p_settings) then update private.narration_jobs set state='stale',reason='configuration_changed' where state in ('waiting','queued','planning','working','review','ready');end if;
 insert into private.narration_audit(actor_id,action,details) values(actor,'settings_saved',jsonb_build_object('keyReplaced',p_api_key is not null));
 return jsonb_build_object('saved',true)||private.narration_snapshot();
end$$;

-- No caller can read a secret through settings. Test context is short-lived,
-- service-only, and tied to a fresh authenticated administrator reservation.
create function private.reserve_narration_test(p_expected_revision bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.narration_admin(true);c private.narration_control;result uuid;begin
 perform private.narration_lock();select * into strict c from private.narration_control;
 if c.revision is distinct from p_expected_revision then raise exception 'narration_revision_conflict' using errcode='40001';end if;
 if c.secret_id is null then raise exception 'narration_key_required' using errcode='55000';end if;
 if exists(select 1 from private.narration_tests where created_at>clock_timestamp()-interval '30 seconds') then raise exception 'narration_rate_limited' using errcode='53300';end if;
 if (select coalesce(sum(coalesce(actual_cents,reserved_cents)),0) from private.narration_budget)+(select coalesce(sum(coalesce(actual_cents,reserved_cents)),0) from private.narration_tests)+12>(c.settings->>'budgetCents')::bigint then raise exception 'narration_budget_limit' using errcode='55000';end if;
 insert into private.narration_tests(actor_id,configuration_revision) values(actor,c.revision) returning id into result;return result;
end$$;
create function private.get_narration_test_context(p_test_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 select jsonb_build_object('apiKey',v.decrypted_secret,'revision',c.revision,'settings',c.settings) into result from private.narration_tests t join private.narration_control c on c.revision=t.configuration_revision join vault.decrypted_secrets v on v.id=c.secret_id where t.id=p_test_id and t.consumed_at is null and t.created_at>clock_timestamp()-interval '2 minutes' and private.is_confirmed_email_admin(t.actor_id);
 return result;
end$$;
create function private.complete_narration_test(p_test_id uuid,p_passed boolean,p_usage jsonb default null,p_actual_cents integer default null) returns boolean language plpgsql security definer set search_path='' as $$
declare t private.narration_tests;begin
 perform private.narration_lock();update private.narration_tests set consumed_at=clock_timestamp(),usage=p_usage,actual_cents=p_actual_cents,unknown=p_actual_cents is null where id=p_test_id and consumed_at is null and created_at>clock_timestamp()-interval '2 minutes' returning * into t;
 if t.id is null then return false;end if;
 update private.narration_control set tested_revision=case when p_passed then revision else null end,last_test_result=case when p_passed then 'passed' else 'failed' end,last_test_at=clock_timestamp() where revision=t.configuration_revision;
 return found;
end$$;

create function private.enqueue_narration_source(p_story_id text,p_content_version text,p_source jsonb,p_source_kind text,p_source_revision bigint default null) returns uuid language plpgsql set search_path='' as $$
declare c private.narration_control;fingerprint text;identity text;result uuid;begin
 select * into strict c from private.narration_control;
 fingerprint:=encode(extensions.digest(private.canonical_content_json(p_source),'sha256'),'hex');
 -- Control-plane CAS revisions also advance for review and budget changes.
 -- Only a semantic recording configuration creates a different audio job.
 identity:=p_story_id||':'||p_content_version||':'||encode(extensions.digest(private.canonical_content_json(private.narration_semantic(c.settings)),'sha256'),'hex');
 insert into private.narration_jobs(identity_key,story_id,content_version,source_kind,source_revision,source_fingerprint,source,configuration_revision,settings,reason)
 values(identity,p_story_id,p_content_version,p_source_kind,p_source_revision,fingerprint,p_source,c.revision,c.settings,case when p_source_kind='draft-uncompiled' then 'source_materialization_required' when c.secret_id is null then 'key_required' when c.tested_revision is distinct from c.revision then 'provider_test_required' when not(c.settings->>'generationEnabled')::boolean then 'generation_paused' else null end)
 on conflict(identity_key) do nothing returning id into result;
 if result is null then
 if exists(select 1 from private.narration_jobs where identity_key=identity and source_fingerprint<>fingerprint) then raise exception 'narration_source_immutable' using errcode='40001';end if;
 select id into result from private.narration_jobs where identity_key=identity;end if;
 return result;
end$$;
create function private.narration_release_outbox() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform private.enqueue_narration_source(new.story_id,new.content_version,new.payload,case when tg_table_schema='private' then 'premium' else 'release' end,null);return new;
end$$;
create trigger narration_release_saved after insert on public.content_releases for each row execute function private.narration_release_outbox();
create trigger narration_premium_saved after insert on private.billing_premium_releases for each row execute function private.narration_release_outbox();
create function private.narration_draft_outbox() returns trigger language plpgsql security definer set search_path='' as $$begin
 -- Older app versions still leave a durable, accurately labelled snapshot.
 perform private.enqueue_narration_source(new.story_id,'draft-'||new.revision::text,jsonb_build_object('draft',new.draft),'draft-uncompiled',new.revision);return new;
end$$;
create trigger narration_draft_saved after insert or update on public.content_drafts for each row execute function private.narration_draft_outbox();
create function private.save_narration_content_draft(p_story_id text,p_base_revision bigint,p_draft jsonb,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb;version text;job uuid;begin
 perform private.narration_admin(false);
 if jsonb_typeof(p_payload)<>'object' or p_payload->>'nameToken'<>'__FABELPAD_CHILD__' or not(p_payload?&array['metadata','parts','scenes','endings']) or octet_length(p_payload::text)>4194304 then raise exception 'narration_invalid_source' using errcode='22023';end if;
 saved:=private.save_content_draft(p_story_id,p_base_revision,p_draft);
 if saved->>'saved'='true' then
 version:=substring(encode(extensions.digest(private.canonical_content_json(p_payload),'sha256'),'hex') from 1 for 16);
 job:=private.enqueue_narration_source(p_story_id,version,p_payload,'draft',(saved->>'revision')::bigint);
 update private.narration_jobs set state='superseded',reason='materialized' where story_id=p_story_id and content_version='draft-'||(saved->>'revision') and source_kind='draft-uncompiled';
 saved:=saved||jsonb_build_object('audio',(select jsonb_build_object('jobId',id,'state',state,'reason',reason) from private.narration_jobs where id=job));
 end if;return saved;
end$$;

create function private.claim_narration_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.narration_control;j private.narration_jobs;begin
 perform private.narration_lock();select * into strict c from private.narration_control;
 update private.narration_control set last_tick_at=clock_timestamp();
 -- Planning has no provider cost and proceeds without a key. Legacy snapshots
 -- cannot be guessed by a worker and remain explicitly blocked.
 select * into j from private.narration_jobs where plan is null and source_kind<>'draft-uncompiled' and state in ('waiting','planning','queued') and available_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) order by created_at for update skip locked limit 1;
 if j.id is null then return null;end if;
 update private.narration_jobs set state='planning',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',attempt=attempt+1 where id=j.id returning * into j;
 return jsonb_build_object('id',j.id,'leaseId',j.lease_id,'storyId',j.story_id,'contentVersion',j.content_version,'sourceKind',j.source_kind,'sourceFingerprint',j.source_fingerprint,'source',j.source,'configurationRevision',j.configuration_revision,'settings',j.settings);
end$$;
create function private.install_narration_plan(p_job_id uuid,p_lease_id uuid,p_plan jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.narration_jobs;item jsonb;asset uuid;approved boolean;begin
 select * into j from private.narration_jobs where id=p_job_id and lease_id=p_lease_id and lease_until>=clock_timestamp() and state='planning' for update;
 if j.id is null then return false;end if;
 if jsonb_typeof(p_plan->'items')<>'array' or jsonb_array_length(p_plan->'items')>100000 or octet_length(p_plan::text)>33554432 then raise exception 'narration_invalid_plan' using errcode='22023';end if;
 if j.source_kind<>'library' and (p_plan->>'storyId' is distinct from j.story_id or p_plan->>'contentVersion' is distinct from j.content_version or p_plan->>'sourceFingerprint' is distinct from encode(extensions.digest(private.canonical_content_json(j.source||jsonb_build_object('storyId',j.story_id,'contentVersion',j.content_version)),'sha256'),'hex')) then raise exception 'narration_source_changed' using errcode='40001';end if;
 for item in select * from jsonb_array_elements(p_plan->'items') loop
 if item->>'id' is null or char_length(item->>'id')>200 or item->>'fingerprint'!~'^[a-f0-9]{64}$' or char_length(item->>'text') not between 1 and 6000 or item#>>'{preset,slotId}'!~'^stem-[1-5]$' then raise exception 'narration_invalid_item' using errcode='22023';end if;
 asset:=null;approved:=false;
 select a.id,exists(select 1 from private.narration_items reviewed where reviewed.asset_id=a.id and reviewed.state='approved' and reviewed.reviewed_at is not null) into asset,approved from private.narration_assets a where a.fingerprint=item->>'fingerprint' and a.quality in ('pass','review') and private.narration_asset_available(a.id) and exists(select 1 from private.narration_items candidate where candidate.asset_id=a.id and candidate.state in ('review','approved')) order by exists(select 1 from private.narration_items reviewed where reviewed.asset_id=a.id and reviewed.state='approved' and reviewed.reviewed_at is not null) desc,a.created_at desc limit 1;
 insert into private.narration_items(job_id,id,fingerprint,specification,state,asset_id,reason) values(j.id,item->>'id',item->>'fingerprint',item,case when asset is null then 'pending' when approved then 'approved' else 'review' end,asset,case when asset is not null and not approved then 'listening_required' else null end) on conflict(job_id,id) do nothing;
 end loop;
 update private.narration_jobs set plan=p_plan,state='queued',lease_id=null,lease_until=null,expected_items=(select count(*) from private.narration_items where job_id=j.id),completed_items=(select count(*) from private.narration_items where job_id=j.id and state='approved') where id=j.id;
 return true;
end$$;

create function private.narration_semantic(p jsonb) returns jsonb language sql immutable set search_path='' as $$select p-'generationEnabled'-'playbackEnabled'-'budgetCents'-'maxParallel'$$;
create function private.claim_narration_item() returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.narration_control;i private.narration_items;j private.narration_jobs;reserved integer;tokens integer;spent bigint;key text;begin
 perform private.narration_lock();select * into strict c from private.narration_control for update;
 update private.narration_control set last_tick_at=clock_timestamp();
 if c.secret_id is null or c.tested_revision is distinct from c.revision or c.last_test_result<>'passed' or not(c.settings->>'generationEnabled')::boolean then
 update private.narration_jobs set reason=case when c.secret_id is null then 'key_required' when c.tested_revision is distinct from c.revision then 'provider_test_required' else 'generation_paused' end where state in ('waiting','queued','working');return null;end if;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.secret_id;if key is null then return null;end if;
 -- A lost connection has unknown spend. Keep its reservation and bound retries.
 update private.narration_budget b set unknown=true from private.narration_items x where x.job_id=b.job_id and x.id=b.item_id and x.attempt=b.attempt and x.state='working' and x.lease_until<clock_timestamp() and b.actual_cents is null;
 update private.narration_items set uncertain_attempts=uncertain_attempts+1,state=case when uncertain_attempts>=1 or attempt>=3 then 'failed' else 'pending' end,reason='provider_outcome_unknown',lease_id=null,lease_until=null where state='working' and lease_until<clock_timestamp();
 if (select count(*) from private.narration_items where state='working' and lease_until>=clock_timestamp())>=(c.settings->>'maxParallel')::integer then return null;end if;
 select x.* into i from private.narration_items x join private.narration_jobs y on y.id=x.job_id where x.state='pending' and x.attempt<3 and x.uncertain_attempts<2 and x.available_at<=clock_timestamp() and y.state in ('queued','working','waiting') and private.narration_semantic(y.settings)=private.narration_semantic(c.settings) and not exists(select 1 from private.narration_items other where other.fingerprint=x.fingerprint and other.state='working' and other.lease_until>=clock_timestamp()) order by y.created_at,x.id for update of x skip locked limit 1;
 if i.id is null then return null;end if;select * into strict j from private.narration_jobs where id=i.job_id;
 tokens:=least(16384,greatest(256,char_length(i.specification->>'text')*6));
 -- Conservative upper bound: 80 USD / million output tokens plus input.
 -- The actual provider usage is reconciled independently after completion.
 reserved:=greatest(1,ceil(tokens*0.008+(char_length(i.specification->>'text')+char_length(i.specification#>>'{preset,instructions}')+2000)*0.0004)::integer);
 select coalesce(sum(coalesce(actual_cents,reserved_cents)),0)+(select coalesce(sum(coalesce(actual_cents,reserved_cents)),0) from private.narration_tests) into spent from private.narration_budget;
 if spent+reserved>(c.settings->>'budgetCents')::bigint then update private.narration_jobs set reason='budget_limit' where id=j.id;return null;end if;
 update private.narration_items set state='working',attempt=attempt+1,lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '150 seconds',reason=null where job_id=i.job_id and id=i.id returning * into i;
 insert into private.narration_budget(job_id,item_id,attempt,lease_id,reserved_cents) values(i.job_id,i.id,i.attempt,i.lease_id,reserved);
 update private.narration_jobs set state='working',reason=null where id=j.id;
 return jsonb_build_object('jobId',j.id,'itemId',i.id,'leaseId',i.lease_id,'attempt',i.attempt,'item',i.specification,'apiKey',key,'maxOutputTokens',tokens,'reservedCents',reserved,'configurationRevision',c.revision);
end$$;

create function private.fail_narration_job(p_job_id uuid,p_lease_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 update private.narration_jobs set state='failed',reason='invalid_source',lease_id=null,lease_until=null where id=p_job_id and lease_id=p_lease_id and lease_until>=clock_timestamp();return found;
end$$;
create function private.get_narration_source_status(p_story_id text,p_content_version text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform private.narration_admin(false);return(select jsonb_build_object('jobId',id,'state',state,'reason',reason) from private.narration_jobs where story_id=p_story_id and content_version=p_content_version order by created_at desc limit 1);
end$$;
create function private.renew_narration_lease(p_job_id uuid,p_item_id text,p_lease_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 update private.narration_items set lease_until=clock_timestamp()+interval '150 seconds' where job_id=p_job_id and id=p_item_id and lease_id=p_lease_id and state='working' and lease_until>=clock_timestamp();return found;
end$$;
create function private.complete_narration_item(p_job_id uuid,p_item_id text,p_lease_id uuid,p_asset jsonb,p_usage jsonb,p_actual_cents integer default null) returns boolean language plpgsql security definer set search_path='' as $$
declare i private.narration_items;asset uuid;begin
 select * into i from private.narration_items where job_id=p_job_id and id=p_item_id and lease_id=p_lease_id and state='working' and lease_until>=clock_timestamp() for update;
 if i.id is null then
 update private.narration_budget set actual_cents=p_actual_cents,usage=p_usage,unknown=false where job_id=p_job_id and item_id=p_item_id and lease_id=p_lease_id and actual_cents is null and p_actual_cents is not null;return false;end if;
 if p_asset->>'providerConfirmed' is distinct from 'true' or p_asset->>'quality' not in ('pass','review') or p_asset->>'sha256'!~'^[a-f0-9]{64}$' or p_asset->>'objectPath'!~'^assets/[a-f0-9]{64}/[a-f0-9-]{36}\.wav$' or octet_length(p_usage::text)>16384 then raise exception 'narration_invalid_result' using errcode='22023';end if;
 insert into private.narration_assets(fingerprint,object_path,sha256,byte_length,duration_ms,mime_type,quality,provider_confirmed,transcript)
 values(i.fingerprint,p_asset->>'objectPath',p_asset->>'sha256',(p_asset->>'byteLength')::bigint,(p_asset->>'durationMs')::integer,'audio/wav',p_asset->>'quality',true,left(p_asset->>'transcript',20000)) returning id into asset;
 update private.narration_items set state='review',asset_id=asset,transcript=left(p_asset->>'transcript',20000),reason=case when p_asset->>'quality'='pass' then 'listening_required' else 'transcript_mismatch' end,lease_id=null,lease_until=null where job_id=i.job_id and id=i.id;
 update private.narration_items set state='review',asset_id=asset,transcript=left(p_asset->>'transcript',20000),reason=case when p_asset->>'quality'='pass' then 'listening_required' else 'transcript_mismatch' end where fingerprint=i.fingerprint and state='pending' and not force_generation;
 update private.narration_budget set actual_cents=p_actual_cents,usage=p_usage,unknown=p_actual_cents is null where job_id=i.job_id and item_id=i.id and attempt=i.attempt;
 update private.narration_jobs set state=case when private.narration_semantic(settings) is distinct from private.narration_semantic((select settings from private.narration_control)) then 'stale' when exists(select 1 from private.narration_items where job_id=i.job_id and state in ('pending','working')) then 'queued' else 'review' end where id=i.job_id;
 return true;
end$$;
create function private.fail_narration_item(p_job_id uuid,p_item_id text,p_lease_id uuid,p_error text,p_uncertain boolean default false,p_retryable boolean default false,p_usage jsonb default null,p_actual_cents integer default null) returns boolean language plpgsql security definer set search_path='' as $$
declare i private.narration_items;begin
 if p_error not in ('provider_unauthorized','provider_rate_limited','provider_unavailable','provider_timeout','provider_incomplete','audio_invalid','transcript_mismatch','storage_unavailable','configuration_changed') then p_error:='provider_unavailable';end if;
 update private.narration_items set state=case when p_retryable and attempt<3 and uncertain_attempts+case when p_uncertain then 1 else 0 end<2 then 'pending' else 'failed' end,uncertain_attempts=uncertain_attempts+case when p_uncertain then 1 else 0 end,reason=p_error,lease_id=null,lease_until=null,available_at=clock_timestamp()+interval '30 seconds' where job_id=p_job_id and id=p_item_id and lease_id=p_lease_id and state='working' and lease_until>=clock_timestamp() returning * into i;
 if i.id is null then update private.narration_budget set actual_cents=p_actual_cents,usage=p_usage,unknown=false where job_id=p_job_id and item_id=p_item_id and lease_id=p_lease_id and actual_cents is null and p_actual_cents is not null;return false;end if;
 update private.narration_budget set actual_cents=coalesce(p_actual_cents,case when not p_uncertain then 0 else null end),usage=p_usage,unknown=p_actual_cents is null and p_uncertain where job_id=i.job_id and item_id=i.id and attempt=i.attempt;
 update private.narration_jobs set state=case when i.state='failed' then 'failed' else 'queued' end,reason=p_error where id=i.job_id;return true;
end$$;
create function private.retry_narration_job(p_expected_revision bigint,p_job_id uuid,p_item_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.narration_admin(true);c private.narration_control;j private.narration_jobs;begin
 perform private.narration_lock();select * into strict c from private.narration_control;
 if c.revision is distinct from p_expected_revision then raise exception 'narration_revision_conflict' using errcode='40001';end if;
 select * into j from private.narration_jobs where id=p_job_id for update;if j.id is null then raise exception 'narration_job_not_found' using errcode='22023';end if;
 if private.narration_semantic(c.settings) is distinct from private.narration_semantic(j.settings) then raise exception 'narration_configuration_changed' using errcode='40001';end if;
 if exists(select 1 from private.narration_items where job_id=j.id and state='working' and lease_until>=clock_timestamp()) then raise exception 'narration_job_busy' using errcode='55000';end if;
 -- Explicit retries never erase spend, uncertainty or the bounded attempts.
 update private.narration_items set state='pending',reason=null,asset_id=null,reviewed_at=null,reviewed_by=null,review_note=null,force_generation=p_item_id is not null,available_at=clock_timestamp() where job_id=j.id and (p_item_id is null and state in ('pending','failed','rejected') or id=p_item_id) and attempt<3 and uncertain_attempts<2;
 update private.narration_jobs set state='queued',reason=null,available_at=clock_timestamp(),completed_items=(select count(*) from private.narration_items where job_id=j.id and state='approved') where id=j.id;
 insert into private.narration_audit(actor_id,action,target_id) values(actor,'retry_requested',j.id);
 perform private.narration_bump();
 return private.narration_snapshot(j.id);
end$$;
create function private.review_narration_item(p_expected_revision bigint,p_job_id uuid,p_item_id text,p_decision text,p_listened boolean,p_transcript_checked boolean,p_note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.narration_admin(true);i private.narration_items;affected integer;begin
 perform private.narration_lock();
 if (select revision from private.narration_control) is distinct from p_expected_revision then raise exception 'narration_revision_conflict' using errcode='40001';end if;
 if p_decision not in ('approve','reject') or p_listened is distinct from true or p_transcript_checked is distinct from true or char_length(coalesce(p_note,''))>500 then raise exception 'narration_review_required' using errcode='22023';end if;
 select * into i from private.narration_items where job_id=p_job_id and id=p_item_id and state in ('review','rejected','approved') and asset_id is not null for update;
 if i.id is null then raise exception 'narration_item_not_reviewable' using errcode='22023';end if;
 if p_decision='approve' and i.reason='transcript_mismatch' and char_length(btrim(coalesce(p_note,'')))<10 then raise exception 'narration_review_note_required' using errcode='22023';end if;
 insert into private.narration_asset_decisions(asset_id,approved,actor_id) values(i.asset_id,p_decision='approve',actor) on conflict(asset_id) do update set approved=excluded.approved,actor_id=excluded.actor_id,reviewed_at=clock_timestamp();
 update private.narration_items set state=case when p_decision='approve' then 'approved' else 'rejected' end,reviewed_by=actor,reviewed_at=clock_timestamp(),review_note=p_note,force_generation=false where asset_id=i.asset_id and fingerprint=i.fingerprint and(job_id=p_job_id and id=p_item_id or state='review' and not force_generation);
 get diagnostics affected=row_count;
 update private.narration_jobs j set completed_items=(select count(*) from private.narration_items x where x.job_id=j.id and x.state='approved'),state=case when j.state='published' then 'published' when private.narration_semantic(j.settings) is distinct from private.narration_semantic((select settings from private.narration_control)) then 'stale' when not exists(select 1 from private.narration_items x where x.job_id=j.id and x.state<>'approved') then 'ready' when exists(select 1 from private.narration_items x where x.job_id=j.id and x.state in('pending','working')) then 'queued' else 'review' end where exists(select 1 from private.narration_items x where x.job_id=j.id and x.asset_id=i.asset_id and x.fingerprint=i.fingerprint);
 insert into private.narration_audit(actor_id,action,target_id,details) values(actor,'item_reviewed',p_job_id,jsonb_build_object('decision',p_decision,'affectedItems',affected));perform private.narration_bump();return private.narration_snapshot(p_job_id);
end$$;

create function private.get_narration_catalogue_sources() returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform private.narration_admin(false);
 return coalesce((select jsonb_agg(x) from(
 select story_id as "storyId",content_version as "contentVersion",payload from(
 select r.story_id,r.content_version,r.payload from public.content_releases r
 union select r.story_id,r.content_version,r.payload from private.billing_premium_releases r join private.billing_content_catalog c on c.story_id=r.story_id where c.available
 union select r.story_id,r.content_version,r.payload from private.narration_served_sources r
 ) rows order by story_id,content_version)x),'[]');
end$$;
create function private.save_narration_catalogue_plan(p_expected_revision bigint,p_selection jsonb,p_estimate jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.narration_admin(true);plan uuid;item jsonb;available jsonb;begin
 perform private.narration_lock();if (select revision from private.narration_control) is distinct from p_expected_revision then raise exception 'narration_revision_conflict' using errcode='40001';end if;
 if jsonb_typeof(p_selection)<>'array' or jsonb_array_length(p_selection)>5000 or jsonb_typeof(p_estimate)<>'object' or octet_length(p_estimate::text)>65536 then raise exception 'narration_invalid_plan' using errcode='22023';end if;
 available:=private.get_narration_catalogue_sources();
 for item in select * from jsonb_array_elements(p_selection) loop
 if not exists(select 1 from jsonb_array_elements(available) a where a->>'storyId'=item->>'storyId' and a->>'contentVersion'=item->>'contentVersion') then raise exception 'narration_source_changed' using errcode='40001';end if;end loop;
 insert into private.narration_catalogue_plans(actor_id,configuration_revision,selection,estimate) values(actor,p_expected_revision,p_selection,p_estimate) returning id into plan;
 return p_estimate||jsonb_build_object('planId',plan,'stories',jsonb_array_length(p_selection));
end$$;
create function private.enqueue_narration_catalogue(p_expected_revision bigint,p_plan_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.narration_admin(true);p private.narration_catalogue_plans;item jsonb;available jsonb;source jsonb;begin
 perform private.narration_lock();if (select revision from private.narration_control) is distinct from p_expected_revision then raise exception 'narration_revision_conflict' using errcode='40001';end if;
 select * into p from private.narration_catalogue_plans where id=p_plan_id and actor_id=actor and created_at>clock_timestamp()-interval '1 hour' for update;
 if p.id is null then raise exception 'narration_plan_expired' using errcode='22023';end if;
 if p.consumed_at is not null then return private.narration_snapshot();end if;
 if p.configuration_revision<>p_expected_revision then raise exception 'narration_revision_conflict' using errcode='40001';end if;
 available:=private.get_narration_catalogue_sources();
 select settings into source from private.narration_control;
 perform private.enqueue_narration_source('narration-library',substring(encode(extensions.digest(private.canonical_content_json(private.narration_semantic(source)),'sha256'),'hex') from 1 for 16),jsonb_build_object('catalogue',source->'cueCatalogue','cues',source->'nameCues','namePackVersion',source->'namePackVersion'),'library');
 for item in select * from jsonb_array_elements(p.selection) loop
 select a->'payload' into source from jsonb_array_elements(available) a where a->>'storyId'=item->>'storyId' and a->>'contentVersion'=item->>'contentVersion';
 if source is null then raise exception 'narration_source_changed' using errcode='40001';end if;
 perform private.enqueue_narration_source(item->>'storyId',item->>'contentVersion',source,'catalogue');
 end loop;
 update private.narration_catalogue_plans set consumed_at=clock_timestamp() where id=p.id;
 insert into private.narration_audit(actor_id,action,target_id,details) values(actor,'catalogue_enqueued',p.id,jsonb_build_object('stories',jsonb_array_length(p.selection)));perform private.narration_bump();return private.narration_snapshot();
end$$;

create table private.narration_libraries (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references private.narration_jobs,
 voice_slot text not null,preset_version bigint not null,preset jsonb not null,pack jsonb not null,
 sample_asset_id uuid not null references private.narration_assets,published_at timestamptz not null default clock_timestamp()
);
alter table private.narration_libraries enable row level security;
revoke all on private.narration_libraries from public,anon,authenticated,service_role;
create function private.register_narration_served_sources(p_sources jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare row jsonb;old private.narration_served_sources;fingerprint text;count integer:=0;begin
 if jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources)>100 then raise exception 'narration_invalid_sources' using errcode='22023';end if;
 for row in select * from jsonb_array_elements(p_sources) loop
 if not exists(select 1 from private.billing_content_catalog where story_id=row->>'storyId' and legacy_free) or row->>'contentVersion'!~'^[a-f0-9]{16,64}$' or row#>>'{payload,nameToken}'<>'__FABELPAD_CHILD__' or octet_length(row::text)>4194304 then raise exception 'narration_invalid_sources' using errcode='22023';end if;
 fingerprint:=encode(extensions.digest(private.canonical_content_json(row->'payload'),'sha256'),'hex');
 select * into old from private.narration_served_sources where story_id=row->>'storyId' and content_version=row->>'contentVersion';
 if old.story_id is not null and old.source_fingerprint<>fingerprint then raise exception 'narration_source_immutable' using errcode='40001';end if;
 insert into private.narration_served_sources values(row->>'storyId',row->>'contentVersion',row->'payload',fingerprint) on conflict do nothing;count:=count+1;
 end loop;return count;
end$$;
create function private.narration_materialize_assets(p_job_id uuid,p_assets jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb:='{}';entry record;asset private.narration_assets;begin
 for entry in select * from jsonb_each(p_assets) loop
 select a.* into asset from private.narration_items i join private.narration_assets a on a.id=i.asset_id where i.job_id=p_job_id and i.id=entry.key and i.state='approved';
 if asset.id is null or not private.narration_asset_available(asset.id) then raise exception 'narration_incomplete' using errcode='55000';end if;
 result:=result||jsonb_build_object(entry.key,jsonb_build_object('id',asset.id,'sha256',asset.sha256,'byteLength',asset.byte_length,'durationMs',asset.duration_ms,'mimeType',asset.mime_type));
 end loop;return result;
end$$;
create function private.publish_narration_job(p_expected_revision bigint,p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.narration_admin(true);c private.narration_control;j private.narration_jobs;m jsonb;manifest_id uuid;revision bigint;source jsonb;pack jsonb;sample uuid;preset jsonb;begin
 perform private.narration_lock();select * into strict c from private.narration_control;
 if c.revision is distinct from p_expected_revision then raise exception 'narration_revision_conflict' using errcode='40001';end if;
 select * into j from private.narration_jobs where id=p_job_id for update;
 if j.id is null or j.plan is null or j.expected_items=0 or exists(select 1 from private.narration_items where job_id=j.id and state<>'approved') then raise exception 'narration_incomplete' using errcode='55000';end if;
 if private.narration_semantic(j.settings) is distinct from private.narration_semantic(c.settings) then raise exception 'narration_configuration_changed' using errcode='40001';end if;
 if j.state='published' then return private.narration_snapshot(j.id);end if;
 if j.source_kind='library' then
 for pack in select * from jsonb_array_elements(j.plan->'cuePacks') loop
 select a.id into sample from private.narration_items i join private.narration_assets a on a.id=i.asset_id where i.job_id=j.id and i.id=j.plan#>>array['samples',pack->>'voiceSlot'] and i.state='approved';
 select s into preset from jsonb_array_elements(j.settings->'slots') s where s->>'slotId'=pack->>'voiceSlot';
 if sample is null or preset is null then raise exception 'narration_incomplete' using errcode='55000';end if;
 insert into private.narration_libraries(job_id,voice_slot,preset_version,preset,pack,sample_asset_id) values(j.id,pack->>'voiceSlot',(pack->>'presetVersion')::bigint,preset,pack||jsonb_build_object('assets',private.narration_materialize_assets(j.id,pack->'assets')),sample);
 end loop;
 else
 select r.payload into source from public.content_releases r where r.story_id=j.story_id and r.content_version=j.content_version;
 if source is null then select r.payload into source from private.billing_premium_releases r where r.story_id=j.story_id and r.content_version=j.content_version;end if;
 if source is null then select r.payload into source from private.narration_served_sources r where r.story_id=j.story_id and r.content_version=j.content_version;end if;
 if source is null or encode(extensions.digest(private.canonical_content_json(source),'sha256'),'hex') is distinct from j.source_fingerprint then raise exception 'narration_source_not_published' using errcode='40001';end if;
 if jsonb_array_length(j.plan->'manifests')<>15 then raise exception 'narration_incomplete' using errcode='55000';end if;
 for m in select * from jsonb_array_elements(j.plan->'manifests') loop
 if m->>'storyId' is distinct from j.story_id or m->>'contentVersion' is distinct from j.content_version then raise exception 'narration_source_changed' using errcode='40001';end if;
 if m->>'sourceFingerprint' is distinct from j.plan->>'sourceFingerprint' then raise exception 'narration_source_changed' using errcode='40001';end if;
 if not exists(select 1 from private.narration_libraries l where l.voice_slot=m#>>'{voice,slotId}' and l.preset_version=(m#>>'{voice,presetVersion}')::bigint and l.pack->>'packId'=m#>>'{cuePack,packId}' and (l.pack->>'packVersion')::bigint=(m#>>'{cuePack,packVersion}')::bigint and l.preset=(select s from jsonb_array_elements(j.settings->'slots')s where s->>'slotId'=m#>>'{voice,slotId}')) then raise exception 'narration_name_pack_required' using errcode='55000';end if;
 m:=m||jsonb_build_object('assets',private.narration_materialize_assets(j.id,m->'assets'));
 insert into private.narration_manifests(job_id,story_id,content_version,reading_level,voice_slot,manifest) values(j.id,j.story_id,j.content_version,m->>'readingLevel',m#>>'{voice,slotId}',m) returning id,audio_revision into manifest_id,revision;
 update private.narration_manifests set manifest=manifest||jsonb_build_object('audioRevision',revision,'id',manifest_id) where id=manifest_id;
 insert into private.narration_active_manifests(story_id,content_version,reading_level,voice_slot,manifest_id) values(j.story_id,j.content_version,m->>'readingLevel',m#>>'{voice,slotId}',manifest_id) on conflict(story_id,content_version,reading_level,voice_slot) do update set manifest_id=excluded.manifest_id;
 end loop;
 end if;
 update private.narration_jobs set state='published',reason=null,published_at=clock_timestamp() where id=j.id;
 insert into private.narration_audit(actor_id,action,target_id) values(actor,'audio_published',j.id);perform private.narration_bump();return private.narration_snapshot(j.id);
end$$;

create function private.narration_references(p jsonb) returns text[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct v#>>'{}'),'{}') from jsonb_path_query(p,'$.**.asset') q(v) where jsonb_typeof(v)='string'
$$;
create function private.get_narration_manifest(p_story_id text,p_content_version text,p_reading_level text,p_voice_slot text) returns jsonb language plpgsql security definer set search_path='' as $$
declare release jsonb;m jsonb;refs text[];begin
 if p_reading_level not in ('under6','6to8','9plus') or p_voice_slot!~'^stem-[1-5]$' then raise exception 'narration_invalid_request' using errcode='22023';end if;
 if not(select(settings->>'playbackEnabled')::boolean from private.narration_control) then return jsonb_build_object('manifest',null,'reason','playback_paused');end if;
 release:=private.get_billing_content_release(p_story_id,p_content_version);
 if release is null and exists(select 1 from private.narration_served_sources where story_id=p_story_id and content_version=p_content_version) then release:=private.get_billing_content_release(p_story_id,null);end if;
 if release is null or release->>'access'='locked' then raise exception 'narration_content_locked' using errcode='42501';end if;
 select x.manifest into m from private.narration_active_manifests a join private.narration_manifests x on x.id=a.manifest_id where a.story_id=p_story_id and a.content_version=p_content_version and a.reading_level=p_reading_level and a.voice_slot=p_voice_slot;
 if m is null then return jsonb_build_object('manifest',null,'reason','audio_not_published');end if;
 if release->>'access'='preview' then
 m:=m||jsonb_build_object('scenes',jsonb_build_object('',m#>array['scenes','']),'endings','{}'::jsonb);
 refs:=private.narration_references(m-'assets');
 refs:=refs||coalesce((select array_agg(distinct v#>>'{}') from jsonb_path_query(m-'assets','$.**.fallbackAsset')q(v)),'{}');
 m:=m||jsonb_build_object('assets',coalesce((select jsonb_object_agg(key,value) from jsonb_each(m->'assets') where key=any(refs)),'{}'));
 end if;
 if not private.narration_pack_available(m) then return jsonb_build_object('manifest',null,'reason','audio_review_rejected');end if;
 return jsonb_build_object('manifest',m||jsonb_build_object('access',jsonb_build_object('scope',release->>'access','offlineUntil',null)));
end$$;
create function private.authorize_narration_asset(p_story_id text,p_content_version text,p_reading_level text,p_voice_slot text,p_asset_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 result:=private.get_narration_manifest(p_story_id,p_content_version,p_reading_level,p_voice_slot);
 return exists(select 1 from jsonb_each(result#>'{manifest,assets}') a where a.value->>'id'=p_asset_id::text);
end$$;
create function private.get_narration_asset_context(p_asset_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'objectPath',object_path,'sha256',sha256,'byteLength',byte_length,'durationMs',duration_ms,'mimeType',mime_type) from private.narration_assets where id=p_asset_id
$$;
create function private.get_narration_voices() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.narration_control;voices jsonb;begin
 select * into strict c from private.narration_control;
 select jsonb_agg(jsonb_build_object('slotId',coalesce(l.preset,s)->>'slotId','label',coalesce(l.preset,s)->>'label','presetVersion',(coalesce(l.preset,s)->>'presetVersion')::bigint,'available',l.id is not null,'sampleAsset',case when a.id is not null then jsonb_build_object('id',a.id,'sha256',a.sha256,'durationMs',a.duration_ms,'byteLength',a.byte_length) else null end) order by s->>'slotId') into voices from jsonb_array_elements(c.settings->'slots') s left join lateral(select * from private.narration_libraries x where x.voice_slot=s->>'slotId' and private.narration_asset_available(x.sample_asset_id) and private.narration_pack_available(x.pack) order by x.published_at desc limit 1)l on true left join private.narration_assets a on a.id=l.sample_asset_id;
 return jsonb_build_object('schemaVersion',1,'environment',private.billing_environment(),'available',exists(select 1 from private.narration_libraries),'active',(c.settings->>'playbackEnabled')::boolean,'defaultVoiceSlot',c.settings->>'defaultVoiceSlot','voices',voices,'reason',case when not exists(select 1 from private.narration_libraries) then 'samples_not_published' else null end);
end$$;
create function private.get_narration_name_pack(p_voice_slot text,p_preset_version bigint,p_pack_version bigint default null,p_pack_id text default null) returns jsonb language sql stable security definer set search_path='' as $$
 select pack from private.narration_libraries where voice_slot=p_voice_slot and preset_version=p_preset_version and(p_pack_version is null or(pack->>'packVersion')::bigint=p_pack_version) and(p_pack_id is null or pack->>'packId'=p_pack_id) and private.narration_pack_available(pack) order by published_at desc limit 1
$$;
create function private.get_narration_sample(p_voice_slot text,p_preset_version bigint) returns uuid language sql stable security definer set search_path='' as $$
 select sample_asset_id from private.narration_libraries where voice_slot=p_voice_slot and preset_version=p_preset_version and private.narration_asset_available(sample_asset_id) order by published_at desc limit 1
$$;
create function private.authorize_narration_preview(p_job_id uuid,p_item_id text) returns uuid language plpgsql security definer set search_path='' as $$declare result uuid;begin
 perform private.narration_admin(false);select asset_id into result from private.narration_items where job_id=p_job_id and id=p_item_id;return result;
end$$;

create function private.verify_narration_worker_request(p_nonce uuid,p_issued_at bigint,p_signature text) returns boolean language plpgsql security definer set search_path='' as $$
declare secret text;expected bytea;supplied bytea;mismatch integer:=0;i integer;added integer;begin
 if p_nonce is null or p_issued_at is null or p_signature is null or p_signature!~'^[a-f0-9]{64}$' or p_issued_at<extract(epoch from clock_timestamp())-90 or p_issued_at>extract(epoch from clock_timestamp())+15 or not exists(select 1 from private.narration_worker_schedule where project_ref='tlwfpivafcokcjyjwgmq') then return false;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_narration_worker_hmac';if secret is null then return false;end if;
 expected:=extensions.hmac(convert_to('fabelpad-narration-worker-v1'||chr(10)||'tlwfpivafcokcjyjwgmq'||chr(10)||p_nonce::text||chr(10)||p_issued_at::text,'UTF8'),decode(secret,'hex'),'sha256');supplied:=decode(p_signature,'hex');
 for i in 0..31 loop mismatch:=mismatch|(get_byte(expected,i)#get_byte(supplied,i));end loop;if mismatch<>0 then return false;end if;
 delete from private.narration_worker_nonces where expires_at<clock_timestamp();insert into private.narration_worker_nonces values(p_nonce,to_timestamp(p_issued_at::double precision)+interval '90 seconds') on conflict do nothing;get diagnostics added=row_count;return added=1;
end$$;
create function private.invoke_narration_worker() returns bigint language plpgsql set search_path='' as $$
declare secret text;nonce uuid:=gen_random_uuid();issued bigint:=floor(extract(epoch from clock_timestamp()))::bigint;signature text;begin
 if not exists(select 1 from private.narration_worker_schedule where project_ref='tlwfpivafcokcjyjwgmq') then raise exception 'Narration scheduler not configured' using errcode='55000';end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_narration_worker_hmac';
 signature:=encode(extensions.hmac(convert_to('fabelpad-narration-worker-v1'||chr(10)||'tlwfpivafcokcjyjwgmq'||chr(10)||nonce::text||chr(10)||issued::text,'UTF8'),decode(secret,'hex'),'sha256'),'hex');
 return net.http_post(url:='https://tlwfpivafcokcjyjwgmq.supabase.co/functions/v1/voorlezen-worker',body:=jsonb_build_object('nonce',nonce,'issuedAt',issued,'signature',signature),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=45000);
end$$;
create function private.configure_narration_worker(p_project_ref text) returns jsonb language plpgsql set search_path='' as $$
declare secret text;job record;job_id bigint;bucket record;begin
 if p_project_ref is distinct from 'tlwfpivafcokcjyjwgmq' or not exists(select 1 from private.lifecycle_worker_schedule where project_ref=p_project_ref) then raise exception 'Narration staging project required' using errcode='22023';end if;
 perform private.narration_lock();
 select * into bucket from storage.buckets where id='fabelpad-narration';
 if found then
 if bucket.public or bucket.name<>'fabelpad-narration' or bucket.file_size_limit is not null and bucket.file_size_limit<16777216 or bucket.allowed_mime_types is not null and not('audio/wav'=any(bucket.allowed_mime_types)) then raise exception 'Conflicting narration bucket; preserved';end if;
 else insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fabelpad-narration','fabelpad-narration',false,16777216,array['audio/wav']);end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_narration_worker_hmac';
 if secret is null then secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');perform vault.create_secret(secret,'fabelpad_narration_worker_hmac','Fabelpad staging audio scheduler HMAC');elsif secret!~'^[a-f0-9]{64}$' then raise exception 'Invalid narration scheduler credential';end if;
 select * into job from cron.job where jobname='fabelpad-voorlezen';
 if found then
 if job.command is distinct from 'select private.invoke_narration_worker();' or job.schedule is distinct from '* * * * *' or job.database is distinct from current_database() or job.username is distinct from current_user or not job.active then raise exception 'Conflicting narration scheduler; preserved';end if;job_id:=job.jobid;
 else job_id:=cron.schedule('fabelpad-voorlezen','* * * * *','select private.invoke_narration_worker();');end if;
 insert into private.narration_worker_schedule values(true,p_project_ref,job_id) on conflict(singleton) do update set cron_job_id=excluded.cron_job_id;
 return jsonb_build_object('projectRef',p_project_ref,'cronJobName','fabelpad-voorlezen','configured',true);
end$$;

-- Explicit wrappers are the entire Data API surface. Helpers and tables stay
-- inaccessible even to service_role; the runtime uses narrow capabilities.
do $$ declare p record;args text;access_role text;begin
 for p in select x.oid,x.proname,pg_get_function_arguments(x.oid) arguments,pg_get_function_result(x.oid) result,x.proargnames from pg_proc x join pg_namespace n on n.oid=x.pronamespace where n.nspname='private' and (x.proname like '%narration%' or x.proname='valid_narration_settings') loop
 execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role',p.proname,pg_get_function_identity_arguments(p.oid));
 access_role:=case
 when p.proname=any(array['get_narration_admin_status','save_narration_settings','reserve_narration_test','save_narration_content_draft','retry_narration_job','review_narration_item','get_narration_catalogue_sources','save_narration_catalogue_plan','enqueue_narration_catalogue','publish_narration_job','authorize_narration_preview','get_narration_source_status']) then 'authenticated'
 when p.proname=any(array['get_narration_voices','get_narration_manifest','authorize_narration_asset','get_narration_name_pack','get_narration_sample']) then 'anon,authenticated'
 when p.proname=any(array['get_narration_test_context','complete_narration_test','claim_narration_job','fail_narration_job','install_narration_plan','claim_narration_item','renew_narration_lease','complete_narration_item','fail_narration_item','get_narration_asset_context','verify_narration_worker_request','register_narration_served_sources']) then 'service_role' else null end;
 if access_role is not null then
 select string_agg(format('%I',a),',') into args from unnest(p.proargnames) a;
 execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $wrapper$select private.%I(%s)$wrapper$',p.proname,p.arguments,p.result,p.proname,coalesce(args,''));
 execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',p.proname,pg_get_function_identity_arguments(p.oid));
 execute format('grant execute on function private.%I(%s) to %s',p.proname,pg_get_function_identity_arguments(p.oid),access_role);
 execute format('grant execute on function public.%I(%s) to %s',p.proname,pg_get_function_identity_arguments(p.oid),access_role);
 end if;
 end loop;
end$$;
