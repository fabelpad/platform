-- Operational provisioning after the tested additive migration and Edge deploy.
-- Run only through the connected fabelpad staging project as database owner.
-- No provider key or audio generation is installed by this script.
begin;
do $$
begin
  if not exists(select 1 from private.lifecycle_worker_schedule where project_ref='tlwfpivafcokcjyjwgmq') then
    raise exception 'Expected the existing Fabelpad staging project';
  end if;
  if exists(select 1 from storage.buckets where id='fabelpad-narration') then
    if not exists(select 1 from storage.buckets where id='fabelpad-narration' and name='fabelpad-narration' and not public and file_size_limit=16777216 and allowed_mime_types=array['audio/wav']::text[]) then
      raise exception 'Conflicting narration bucket preserved';
    end if;
  else
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('fabelpad-narration','fabelpad-narration',false,16777216,array['audio/wav']);
  end if;
end$$;
select private.configure_narration_worker('tlwfpivafcokcjyjwgmq');
notify pgrst, 'reload schema';
commit;
