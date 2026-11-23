# Hosted baseline en migratievolgorde betalingen

Vastgelegd op 23 november 2026 om 12:40:23 UTC, uitsluitend via read-only Supabase-MCP-aanroepen. Er zijn geen hosted migraties, configuratiemutaties, providerbetalingen of Edge-deployments uitgevoerd.

De volledige aggregaten staan in [de baseline-JSON](BETALINGEN-HOSTED-BASELINE-20261123.json). De tellingen zijn exacte SQL-counts; MCP-tabelschattingen zijn niet als bewijs gebruikt. De hashes zijn SHA-256 van gesorteerde rijhashes; geen namen, e-mailadressen, UUID's, geboortedata, gezinssnapshots, tokens of secrets worden geëxporteerd.

| Omgeving | Vastgepind project | Status | Bestaande migraties | Gezinnen / profielen / ouderacceptaties / profieltoestemmingen |
| --- | --- | --- | --- | --- |
| Staging | `tlwfpivafcokcjyjwgmq` | ACTIVE_HEALTHY, PostgreSQL 17.12 | 14 | 1 / 1 / 1 / 1 |
| Productie | `aptprpkosqctwrzeetgs` | ACTIVE_HEALTHY, PostgreSQL 17.12 | 14 | 0 / 0 / 0 / 0 |

Alle veertien opgeslagen migratie-SQL-hashes zijn bytegelijk aan de lokale bestanden en aan elkaar tussen staging en productie. De laatste bestaande versie is `20261123003259_child_birth_date_privacy_information`. Beide projecten hebben 26 releases voor 13 verhalen, twee versies per verhaal; de inhouds-/versiehash zonder publicatie-identiteit en tijd is op beide projecten `077ecc76d7091efffece21cbf8caad9461715ca300bf7ec1595ef9ebf3e255fe`. De vier historische juridische documenten hebben eveneens dezelfde aggregaathash.

## Uit te voeren door de deployer na geslaagde CI

1. Pin elke afzonderlijke aanroep op projectref én de bedoelde MCP-verbinding: staging `link_6b02f3ceefa481919796c872809fe1c0`, productie `link_6ae013e4bce081918aeddc1ab3db2a9d`. Controleer de projectref in `private.lifecycle_worker_schedule` en voer onderstaande baseline-SELECT direct vóór de wijziging opnieuw uit. Die verse opname vangt legitieme gebruikersactiviteit sinds 12:40 op.
2. Bouw en verifieer eerst de nieuwe webrelease en Edge-bundels. Plan de schema-/webomschakeling als één kort gecoördineerd venster. Voer eerst staging uit en controleer daar inhoud, heracceptatie en bestaande profielvoortgang voordat productie volgt.
3. Pas de drie bronmigraties exact en in volgorde toe: `20261123115349_billing_entitlements_campaigns_coupons_provider_queue`, `20261123121009_billing_legal_documents_v20261123_1`, `20261123123231_billing_play_sandbox_readiness_proof`. De verwachte bestandshashes staan in de JSON. Gebruik een werkwijze die de bronversies in de migratiehistorie bewaart. MCP `apply_migration` heeft zelf geen expliciete version-parameter; veronderstel daarom niet dat alleen de name-parameter automatisch de lokale bestandsversie registreert. Controleer de historie voordat later een CLI-push wordt gebruikt.
4. Herhaal onmiddellijk de baseline-SELECT en voer de post-migratiequery uit, vóór smoke-tests die zelf acceptaties of gezinsactiviteit schrijven. Historische documenten, volledige gezinssnapshots, ouderacceptaties en profieltoestemmingen moeten dezelfde hashes/tellingen hebben. Er mogen precies twee nieuwe juridische documentversies zijn; oude acceptaties worden niet herschreven. Bestaande lifecyclevelden blijven behouden. Alleen aantoonbare gebruikers-/workeractiviteit mag een afwijking verklaren.
5. Controleer `private.billing_environment()` en de publieke offer-DTO: juiste omgeving, alle vier `configured=false` en `effective=false`, nul Founders-toekenningen, nul betaalcontracten en nul providercredentials. Geen verkooppoort inschakelen als onderdeel van deployment.
6. Deploy de nieuwe `billing` Edge Function en de bijgewerkte `account-maintenance` worker met de vastgelegde code/configuratie; verwissel geen projectgebonden worker-/callbackconfiguratie. Schakel daarna direct de gecontroleerde webrelease om. De bestaande worker-schedule blijft projectgebonden. Controleer logs en security advisors opnieuw, plus anonieme catalogus, volledige inhoud bij hoofdpoort uit, verse voorwaardenacceptatie en behoud van het bestaande stagingprofiel.
7. Verifieer de migratiehistorie en leg de na-hashes en release-/Edge-identiteiten naast deze baseline vast. Een echte Mollie-/Play-proef en een bewuste verkooppoortwijziging zijn afzonderlijke stappen.

## Compatibiliteit tijdens de omschakeling

De basis-migratie verwijdert `releases_public_read` en trekt directe anonieme `content_releases`-SELECT in. De oude servercode leest juist rechtstreeks die tabel voor een nieuwste opgeslagen verhaalversie; die route kan tussen migratie en webomschakeling een fout geven. De nieuwe server leest de geautoriseerde `get_billing_content_release`-RPC. Exacte oudere bundelversies blijven historisch publiek; deze migratie claimt geen retroactieve geheimhouding van reeds uitgeleverde tekst. Nieuwe premiumverhalen blijven wel servermatig beschermd.

De juridische migratie vereist de nieuwe voorwaardenversie `2026-11-23.1` zonder oude acceptaties te veranderen. Oudere webcode stuurt nog de oude versie en kan de nieuwe bevestiging niet afhandelen. Het staginggezin heeft daarom na de omschakeling een echte heracceptatie nodig; gezinsdata en voortgang blijven behouden. Een rollback naar de oude webserver nadat de nieuwe contentrechten en juridische runtime actief zijn, is geen volledige compatibele rollback.

Bestaande advisor-baseline: beide projecten melden INFO voor vijftien opzettelijk afgesloten private RLS-tabellen zonder policies. Staging heeft daarnaast een reeds bestaande waarschuwing voor gelekte-wachtwoordbescherming; productie niet. De nieuwe private billingtabellen kunnen extra RLS-without-policy-INFO opleveren, maar mogen geen API-tabelprivileges krijgen. Zie de [RLS-linteruitleg](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) en [wachtwoordinstelling](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Herhaalbare baseline-SELECT

Deze query leest alleen data en retourneert uitsluitend aantallen, geaggregeerde hashes en publieke documentversies.

```sql
with fingerprint as (
select 'family_documents' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from public.family_documents t) hashes
union all
select 'family_snapshots' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(jsonb_build_object('parentId',parent_id,'snapshot',snapshot)::text,'sha256'),'hex') as row_hash from public.family_documents t) hashes
union all
select 'account_lifecycle' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from private.account_lifecycle t) hashes
union all
select 'lifecycle_immutable_acceptance' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(jsonb_build_object('parentId',parent_id,'createdAt',created_at,'legacy',legacy_account,'acceptedAt',accepted_at,'termsVersion',terms_version,'privacyVersion',privacy_version,'parentDeclaration',parent_declaration,'signupChannel',signup_channel)::text,'sha256'),'hex') as row_hash from private.account_lifecycle t) hashes
union all
select 'parent_acceptances' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from private.parent_acceptances t) hashes
union all
select 'child_profile_consents' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from private.child_profile_consents t) hashes
union all
select 'legal_documents_historical' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from private.legal_document_versions t where version<>'2026-11-23.1') hashes
union all
select 'content_releases' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from public.content_releases t) hashes
union all
select 'content_drafts' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from public.content_drafts t) hashes
union all
select 'content_admins' as dataset,count(*)::bigint as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from(select encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') as row_hash from public.content_admins t) hashes
) select jsonb_build_object('capturedAt',clock_timestamp(),'projectRef',(select project_ref from private.lifecycle_worker_schedule where singleton),'postgresVersion',current_setting('server_version'),'familyCount',(select count(*) from public.family_documents),'childProfiles',(select coalesce(sum(jsonb_array_length(snapshot#>'{family,children}')),0) from public.family_documents),'authUsers',(select count(*) from auth.users),'datasets',(select jsonb_object_agg(dataset,jsonb_build_object('rows',rows,'sha256',sha256)) from fingerprint),'legalVersions',(select jsonb_agg(jsonb_build_object('kind',kind,'version',version,'sha256',sha256) order by kind,version) from private.legal_document_versions),'content',jsonb_build_object('releases',(select count(*) from public.content_releases),'storyIds',(select count(distinct story_id) from public.content_releases),'versionsPerStory',(select jsonb_object_agg(story_id,n) from(select story_id,count(*) n from public.content_releases group by story_id) versions)),'billingTablesPresent',to_regclass('private.billing_control') is not null) as baseline;
```

## Post-migratie-SELECT

Verwacht onder meer: juiste omgeving, alle offerpoorten uit, API-tabelprivileges 0, publieke billing-definers 0, ongeldige gezinssnapshots 0, toekenningen/contracten/credentials 0, juridische documenten 6 en oude contentreleases 26.

```sql
select jsonb_build_object(
 'environment',private.billing_environment(),
 'offer',public.get_billing_public_offer(),
 'billingTablesWithApiPrivileges',(select count(*) from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='private' and t.relkind='r' and t.relname like 'billing_%' and (has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role',t.oid,'SELECT,INSERT,UPDATE,DELETE'))),
 'publicBillingDefiners',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%billing%' and p.prosecdef),
 'invalidFamilySnapshots',(select count(*) from public.family_documents where private.valid_family_snapshot(snapshot) is distinct from true),
 'foundersAwarded',(select awarded from private.billing_control),
 'foundersAwards',(select count(*) from private.billing_founders_awards),
 'paidContracts',(select count(*) from private.billing_subscriptions),
 'credentials',(select count(*) from private.billing_credentials),
 'legalDocumentCount',(select count(*) from private.legal_document_versions),
 'legacyContentRows',(select count(*) from public.content_releases),
 'anonDirectContentSelect',has_table_privilege('anon','public.content_releases','SELECT'),
 'historicalConsentRows',(select count(*) from private.child_profile_consents)
) as post_migration_checks;
```

De volledige lifecyclehash bevat ook activiteitstijden en kan door normaal gebruik wijzigen. De aparte `lifecycle_immutable_acceptance`-hash maakt historische acceptatie/identiteit vergelijkbaar zonder zulke vluchtige velden. Een afwijkende hash is aanleiding voor onderzoek; data wordt hiervoor nooit teruggezet of overschreven.

