-- Supabase Data API sessions enforce pg-safeupdate. Its UPDATE-without-WHERE
-- guard raises SQLSTATE 21000 even on our constrained singleton table. Keep
-- the guard enabled and explicitly address that singleton in each runtime
-- heartbeat/revision update. Private claims and their public envelopes,
-- signatures, ownership, grants, leases and budget semantics are retained.

create or replace function private.narration_bump() returns void language sql volatile set search_path='' as $$update private.narration_control set revision=revision+1,tested_revision=case when tested_revision=revision then revision+1 else null end,updated_at=clock_timestamp() where singleton$$;

create or replace function private.claim_narration_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.narration_control;j private.narration_jobs;begin
 perform private.narration_lock();select * into strict c from private.narration_control;
 update private.narration_control set last_tick_at=clock_timestamp() where singleton;
 -- Planning has no provider cost and proceeds without a key. Legacy snapshots
 -- cannot be guessed by a worker and remain explicitly blocked.
 select * into j from private.narration_jobs where plan is null and source_kind<>'draft-uncompiled' and state in ('waiting','planning','queued') and available_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) order by created_at for update skip locked limit 1;
 if j.id is null then return 'null'::jsonb;end if;
 update private.narration_jobs set state='planning',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',attempt=attempt+1 where id=j.id returning * into j;
 return jsonb_build_object('id',j.id,'leaseId',j.lease_id,'storyId',j.story_id,'contentVersion',j.content_version,'sourceKind',j.source_kind,'sourceFingerprint',j.source_fingerprint,'source',j.source,'configurationRevision',j.configuration_revision,'settings',j.settings);
end$$;

create or replace function private.claim_narration_item() returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.narration_control;i private.narration_items;j private.narration_jobs;reserved integer;tokens integer;spent bigint;key text;begin
 perform private.narration_lock();select * into strict c from private.narration_control for update;
 update private.narration_control set last_tick_at=clock_timestamp() where singleton;
 if c.secret_id is null or c.tested_revision is distinct from c.revision or c.last_test_result<>'passed' or not(c.settings->>'generationEnabled')::boolean then
 update private.narration_jobs set reason=case when c.secret_id is null then 'key_required' when c.tested_revision is distinct from c.revision then 'provider_test_required' else 'generation_paused' end where state in ('waiting','queued','working');return 'null'::jsonb;end if;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.secret_id;if key is null then return 'null'::jsonb;end if;
 -- A lost connection has unknown spend. Keep its reservation and bound retries.
 update private.narration_budget b set unknown=true from private.narration_items x where x.job_id=b.job_id and x.id=b.item_id and x.attempt=b.attempt and x.state='working' and x.lease_until<clock_timestamp() and b.actual_cents is null;
 update private.narration_items set uncertain_attempts=uncertain_attempts+1,state=case when uncertain_attempts>=1 or attempt>=3 then 'failed' else 'pending' end,reason='provider_outcome_unknown',lease_id=null,lease_until=null where state='working' and lease_until<clock_timestamp();
 if (select count(*) from private.narration_items where state='working' and lease_until>=clock_timestamp())>=(c.settings->>'maxParallel')::integer then return 'null'::jsonb;end if;
 select x.* into i from private.narration_items x join private.narration_jobs y on y.id=x.job_id where x.state='pending' and x.attempt<3 and x.uncertain_attempts<2 and x.available_at<=clock_timestamp() and y.state in ('queued','working','waiting') and private.narration_semantic(y.settings)=private.narration_semantic(c.settings) and not exists(select 1 from private.narration_items other where other.fingerprint=x.fingerprint and other.state='working' and other.lease_until>=clock_timestamp()) order by y.created_at,x.id for update of x skip locked limit 1;
 if i.id is null then return 'null'::jsonb;end if;select * into strict j from private.narration_jobs where id=i.job_id;
 tokens:=least(16384,greatest(256,char_length(i.specification->>'text')*6));
 -- Conservative upper bound: 80 USD / million output tokens plus input.
 -- The actual provider usage is reconciled independently after completion.
 reserved:=greatest(1,ceil(tokens*0.008+(char_length(i.specification->>'text')+char_length(i.specification#>>'{preset,instructions}')+2000)*0.0004)::integer);
 select coalesce(sum(coalesce(actual_cents,reserved_cents)),0)+(select coalesce(sum(coalesce(actual_cents,reserved_cents)),0) from private.narration_tests) into spent from private.narration_budget;
 if spent+reserved>(c.settings->>'budgetCents')::bigint then update private.narration_jobs set reason='budget_limit' where id=j.id;return 'null'::jsonb;end if;
 update private.narration_items set state='working',attempt=attempt+1,lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '150 seconds',reason=null where job_id=i.job_id and id=i.id returning * into i;
 insert into private.narration_budget(job_id,item_id,attempt,lease_id,reserved_cents) values(i.job_id,i.id,i.attempt,i.lease_id,reserved);
 update private.narration_jobs set state='working',reason=null where id=j.id;
 return jsonb_build_object('jobId',j.id,'itemId',i.id,'leaseId',i.lease_id,'attempt',i.attempt,'item',i.specification,'apiKey',key,'maxOutputTokens',tokens,'reservedCents',reserved,'configurationRevision',c.revision);
end$$;

notify pgrst, 'reload schema';
