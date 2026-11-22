-- Additive JSON contracts for reading levels and a child's most recent completed route.
-- No existing family, consent, release, or profile row is rewritten.
-- The lifecycle wrapper still guards all family writes and editorial publication.
create or replace function private.valid_family_snapshot_with_profiles(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare child jsonb; ids text[] := '{}'; entry record; field record; item jsonb; k text;
  worlds constant text[] := array['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars'];
begin
  if jsonb_typeof(p) <> 'object' or p->'schemaVersion' <> '1'::jsonb or not (p ?& array['schemaVersion','family','data']) or (select count(*) from jsonb_object_keys(p)) <> 3 then return false; end if;
  if jsonb_typeof(p->'family') <> 'object' or p#>'{family,version}' <> '1'::jsonb or not ((p->'family') ?& array['version','children','activeId']) or (select count(*) from jsonb_object_keys(p->'family')) <> 3 then return false; end if;
  if jsonb_typeof(p#>'{family,children}') <> 'array' or jsonb_array_length(p#>'{family,children}') not between 1 and 5 or jsonb_typeof(p->'data') <> 'object' then return false; end if;
  for child in select * from jsonb_array_elements(p#>'{family,children}') loop
    if jsonb_typeof(child) <> 'object' or not (child ?& array['id','name','avatar']) or (select count(*) from jsonb_object_keys(child)) <> 3 then return false; end if;
    k := child->>'id';
    if jsonb_typeof(child->'id') <> 'string' or k !~ '^[a-zA-Z0-9_-]{1,80}$' or k = any(ids) or k in ('__proto__','prototype','constructor') then return false; end if;
    if not private.valid_snapshot_text(child->'name',20) or (jsonb_typeof(child->'avatar') is distinct from 'number' or child->>'avatar' !~ '^[0-3]$') then return false; end if;
    ids := array_append(ids, k);
  end loop;
  if jsonb_typeof(p#>'{family,activeId}') is distinct from 'string' or not (p#>>'{family,activeId}' = any(ids)) then return false; end if;
  for entry in select * from jsonb_each(p->'data') loop
    if not (entry.key = any(ids)) or jsonb_typeof(entry.value) <> 'object' then return false; end if;
    for field in select * from jsonb_each(entry.value) loop
      if field.key in ('favorites','started') then
        if jsonb_typeof(field.value) <> 'array' or jsonb_array_length(field.value) > 13 then return false; end if;
        if exists (select 1 from jsonb_array_elements(field.value) v where jsonb_typeof(v) <> 'string' or not (v#>>'{}' = any(worlds))) then return false; end if;
        if (select count(distinct v) from jsonb_array_elements(field.value) v) <> jsonb_array_length(field.value) then return false; end if;
      elsif left(field.key,6) = 'story-' and substring(field.key from 7) = any(worlds) then
        if jsonb_typeof(field.value) <> 'object' or not (field.value ?& array['picks','updatedAt']) then return false; end if;
        if exists (select 1 from jsonb_object_keys(field.value) key where key not in ('picks','updatedAt','storyId','contentVersion','revision','lastCompletedPicks','lastCompletedContentVersion')) then return false; end if;
        if jsonb_typeof(field.value->'picks') <> 'array' or jsonb_array_length(field.value->'picks') > 5 then return false; end if;
        if exists (select 1 from jsonb_array_elements(field.value->'picks') v where v not in ('0'::jsonb,'1'::jsonb)) then return false; end if;
        if jsonb_typeof(field.value->'updatedAt') is distinct from 'number' or field.value->>'updatedAt' !~ '^[0-9]+$' or (field.value->>'updatedAt')::numeric > 9007199254740991 then return false; end if;
        if field.value ? 'storyId' and (jsonb_typeof(field.value->'storyId') is distinct from 'string' or field.value->>'storyId' is distinct from substring(field.key from 7)) then return false; end if;
        if field.value ? 'contentVersion' and (jsonb_typeof(field.value->'contentVersion') is distinct from 'string' or field.value->>'contentVersion' !~ '^[a-f0-9]{16,64}$') then return false; end if;
        if field.value ? 'revision' and (jsonb_typeof(field.value->'revision') is distinct from 'number' or field.value->>'revision' !~ '^[0-9]+$' or (field.value->>'revision')::numeric > 9007199254740991) then return false; end if;
        if field.value ? 'lastCompletedPicks' then
          if jsonb_typeof(field.value->'lastCompletedPicks') is distinct from 'array' or jsonb_array_length(field.value->'lastCompletedPicks') <> 5 then return false; end if;
          if exists(select 1 from jsonb_array_elements(field.value->'lastCompletedPicks') v where v not in ('0'::jsonb,'1'::jsonb)) then return false; end if;
        end if;
        if field.value ? 'lastCompletedContentVersion' and (not (field.value ? 'lastCompletedPicks') or jsonb_typeof(field.value->'lastCompletedContentVersion') is distinct from 'string' or field.value->>'lastCompletedContentVersion' !~ '^[a-f0-9]{16,64}$') then return false; end if;
      elsif field.key = 'prefs' then
        if jsonb_typeof(field.value) <> 'object' or jsonb_typeof(field.value->'muted') is distinct from 'boolean' or jsonb_typeof(field.value->'calm') is distinct from 'boolean' then return false; end if;
        if exists (select 1 from jsonb_object_keys(field.value) key where key not in ('muted','calm','textSize','readingLevel')) then return false; end if;
        if field.value ? 'textSize' and (jsonb_typeof(field.value->'textSize') is distinct from 'string' or field.value->>'textSize' not in ('normal','large')) then return false; end if;
        if field.value ? 'readingLevel' and (jsonb_typeof(field.value->'readingLevel') is distinct from 'string' or field.value->>'readingLevel' not in ('under6','6to8','9plus')) then return false; end if;
      elsif field.key = 'completed' then
        if jsonb_typeof(field.value) <> 'object' then return false; end if;
        if exists (select 1 from jsonb_each(field.value) e where not (e.key = any(worlds)) or jsonb_typeof(e.value) is distinct from 'object' or not (e.value ?& array['ending','date']) or (select count(*) from jsonb_object_keys(e.value)) <> 2 or not private.valid_snapshot_text(e.value->'ending',160) or not private.valid_snapshot_date(e.value->'date')) then return false; end if;
      elsif field.key = 'memory' then
        if not private.valid_family_memory(field.value) then return false; end if;
      else return false;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_family_snapshot_with_profiles(jsonb) from public, anon, authenticated, service_role;


-- Optional three-level bundles retain the exact canonical route keys and rewards.
-- This helper has no write privileges and is not exposed through the Data API.
create function private.valid_content_release_reading_levels(p jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare band text; variant jsonb; scene record; ending record; choice jsonb; choice_index integer;
begin
  if not (p ? 'readingLevels') then return true; end if;
  if jsonb_typeof(p->'readingLevels') is distinct from 'object'
    or not ((p->'readingLevels') ?& array['under6','6to8','9plus'])
    or (select count(*) from jsonb_object_keys(p->'readingLevels')) <> 3
    or jsonb_typeof(p->'scenes') is distinct from 'object'
    or jsonb_typeof(p->'endings') is distinct from 'object' then return false; end if;
  if p#>'{readingLevels,9plus,scenes}' is distinct from p->'scenes'
    or p#>'{readingLevels,9plus,endings}' is distinct from p->'endings' then return false; end if;
  foreach band in array array['under6','6to8','9plus'] loop
    variant := p->'readingLevels'->band;
    if jsonb_typeof(variant) is distinct from 'object' or not (variant ?& array['scenes','endings'])
      or (select count(*) from jsonb_object_keys(variant)) <> 2
      or jsonb_typeof(variant->'scenes') is distinct from 'object'
      or jsonb_typeof(variant->'endings') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(variant->'scenes')) <> 31
      or (select count(*) from jsonb_object_keys(variant->'endings')) <> 32 then return false; end if;
    for scene in select * from jsonb_each(variant->'scenes') loop
      if scene.key !~ '^[01]{0,4}$' or not ((p->'scenes') ? scene.key)
        or jsonb_typeof(scene.value) is distinct from 'object' or not (scene.value ?& array['title','text','choices'])
        or (select count(*) from jsonb_object_keys(scene.value)) <> 3
        or not private.valid_snapshot_text(scene.value->'title',200)
        or not private.valid_snapshot_text(scene.value->'text',20000)
        or jsonb_typeof(scene.value->'choices') is distinct from 'array'
        or jsonb_array_length(scene.value->'choices') <> 2 then return false; end if;
      for choice_index in 0..1 loop
        choice := scene.value->'choices'->choice_index;
        if jsonb_typeof(choice) is distinct from 'object' or not (choice ?& array['label','hint','icon'])
          or (select count(*) from jsonb_object_keys(choice)) <> 3
          or not private.valid_snapshot_text(choice->'label',220)
          or not private.valid_snapshot_text(choice->'hint',1000,true)
          or jsonb_typeof(choice->'icon') is distinct from 'string'
          or choice->>'icon' not in ('heart','sparkles','music','moon','leaf','compass')
          or choice->'icon' is distinct from p->'scenes'->scene.key->'choices'->choice_index->'icon' then return false; end if;
      end loop;
    end loop;
    for ending in select * from jsonb_each(variant->'endings') loop
      if ending.key !~ '^[01]{5}$' or not ((p->'endings') ? ending.key)
        or jsonb_typeof(ending.value) is distinct from 'object' or not (ending.value ?& array['title','text','keepsake'])
        or (select count(*) from jsonb_object_keys(ending.value)) <> 3
        or not private.valid_snapshot_text(ending.value->'title',200)
        or not private.valid_snapshot_text(ending.value->'text',20000)
        or not private.valid_snapshot_text(ending.value->'keepsake',200)
        or ending.value->'title' is distinct from p->'endings'->ending.key->'title'
        or ending.value->'keepsake' is distinct from p->'endings'->ending.key->'keepsake' then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_content_release_reading_levels(jsonb) from public, anon, authenticated, service_role;

create or replace function private.publish_content_release_before_lifecycle(p_story_id text,p_base_revision bigint,p_payload jsonb) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare owner_id uuid := auth.uid(); current_row public.content_drafts; release_row public.content_releases; version text; scene record; ending record;
begin
  if owner_id is null or not exists(select 1 from public.content_admins where user_id=owner_id) then raise exception 'Administrator required' using errcode = '42501'; end if;
  select * into current_row from public.content_drafts where story_id=p_story_id for update;
  if not found or p_base_revision is null or current_row.revision <> p_base_revision then return jsonb_build_object('saved',false,'revision',coalesce(current_row.revision,0)); end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_payload->'parts' is distinct from '5'::jsonb or p_payload->>'nameToken' is distinct from '__FABELPAD_CHILD__' or jsonb_typeof(p_payload->'scenes') <> 'object' or jsonb_typeof(p_payload->'endings') <> 'object' or p_payload->'metadata' is distinct from current_row.draft->'metadata' or (select count(*) from jsonb_object_keys(p_payload->'scenes')) <> 31 or (select count(*) from jsonb_object_keys(p_payload->'endings')) <> 32 or octet_length(p_payload::text) > 2097152 then raise exception 'Invalid release' using errcode = '22023'; end if;
  if not private.valid_content_release_reading_levels(p_payload) then raise exception 'Invalid reading levels' using errcode = '22023'; end if;
  for scene in select * from jsonb_each(p_payload->'scenes') loop
    if scene.key !~ '^[01]{0,4}$' or jsonb_typeof(scene.value) <> 'object' or coalesce(length(btrim(scene.value->>'title')),0) = 0 or coalesce(length(btrim(scene.value->>'text')),0) = 0 or jsonb_typeof(scene.value->'choices') <> 'array' or jsonb_array_length(scene.value->'choices') <> 2 then raise exception 'Invalid scene' using errcode = '22023'; end if;
  end loop;
  for ending in select * from jsonb_each(p_payload->'endings') loop
    if ending.key !~ '^[01]{5}$' or jsonb_typeof(ending.value) <> 'object' or coalesce(length(btrim(ending.value->>'title')),0) = 0 or coalesce(length(btrim(ending.value->>'text')),0) = 0 or coalesce(length(btrim(ending.value->>'keepsake')),0) = 0 then raise exception 'Invalid ending' using errcode = '22023'; end if;
  end loop;
  version := substring(encode(sha256(convert_to(private.canonical_content_json(p_payload),'UTF8')),'hex') from 1 for 16);
  insert into public.content_releases(story_id,content_version,payload,published_by) values(p_story_id,version,p_payload,owner_id) on conflict(story_id,content_version) do nothing;
  select * into release_row from public.content_releases where story_id=p_story_id and content_version=version;
  return jsonb_build_object('saved',true,'release',to_jsonb(release_row));
end;
$$;
revoke all on function private.publish_content_release_before_lifecycle(text,bigint,jsonb) from public, anon, authenticated, service_role;
