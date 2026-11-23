# Canonicalisatie van MCP-migratiehistorie — voorbereid, niet uitgevoerd

Op 23 november 2026 read-only gecontroleerd op staging `tlwfpivafcokcjyjwgmq` en productie `aptprpkosqctwrzeetgs`. Beide projecten hadden nog veertien bestaande migraties. Deze voorbereiding heeft geen DDL of metadata-DML uitgevoerd.

## Vastgestelde tabelstructuur

`supabase_migrations.schema_migrations` bevat `version text NOT NULL` als primary key; daarnaast nullable `statements text[]`, `name text`, `created_by text`, `idempotency_key text` en `rollback text[]`. Er is een unieke constraint op `idempotency_key` en er zijn geen usertriggers. De migratienaam is **niet uniek**. Daarom is alleen `WHERE name=...` onvoldoende.

Er zijn op beide projecten ook geen inkomende foreign keys naar deze registratie. RLS is op deze platformtabel niet ingeschakeld of geforceerd.

Alle veertien bestaande records hebben exact één statement, waarin het volledige originele SQL-bestand inclusief witruimte/newlines is opgeslagen. De baselinevergelijking was:

```sql
encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex')
```

Deze hashes matchten alle veertien lokale bestands-SHA-256's byte-exact. Het template hieronder specificeert UTF-8 ook expliciet met `convert_to(...,'UTF8')`. Het normaliseert geen comments, witruimte, regeleinden of trailing newline. Als de nieuwe MCP-call statements anders splitst of de SQL wijzigt, is de uitkomst een weigering; pas de hash niet op basis van een gok aan.

## Geen garantie op versieparsing uit name

De huidige [officiële MCP-tooldefinitie](https://github.com/supabase/mcp/blob/main/packages/mcp-server-supabase/src/tools/database-operation-tools.ts) heeft uitsluitend `project_id,name,query`. De [officiële platformimplementatie](https://github.com/supabase/mcp/blob/main/packages/mcp-server-supabase/src/platform/api-platform.ts) stuurt `name` en `query` rechtstreeks door naar de Management API, zonder prefixparser of version-veld. Dit bewijst geen prefixinterpretatie door de achterliggende API. Gebruik daarom als name de gewone snake_case-naam zonder versienummer en vertrouw nooit op automatische parsing van `name='20261123115349_billing_...'`. Observeer de werkelijke serverversion na elke apply-call.

## Eerst metadata opvragen

Deze SELECT toont uitsluitend versie/naam/counts/hashes en booleans; nooit migratie-SQL, created_by of idempotency keys. Controleer dat precies één nieuw record de exacte gewone naam, verwachte queryhash en één statement heeft. Neem de source_version letterlijk uit dit resultaat over; gebruik geen max(version)-heuristiek.

```sql
select version,name,cardinality(statements) as statement_count,
 encode(extensions.digest(convert_to(coalesce(array_to_string(statements,E'\n'),''),'UTF8'),'sha256'),'hex') as query_sha256,
 encode(extensions.digest(convert_to((to_jsonb(m)-'version')::text,'UTF8'),'sha256'),'hex') as preserved_fields_sha256,
 created_by is not null as created_by_present,
 idempotency_key is not null as idempotency_key_present,
 coalesce(cardinality(rollback),0) as rollback_statement_count
from supabase_migrations.schema_migrations m
where name in ('billing_entitlements_campaigns_coupons_provider_queue','billing_legal_documents_v20261123_1','billing_play_sandbox_readiness_proof')
 or version in ('20261123115349','20261123121009','20261123123231')
order by version;
```

## Begrensd transactioneel DML-template

**Alleen voorbereid. Niet uitgevoerd.** Vul source_version en projectref in; kies exact één van de drie toegestane targetversies. Projectref én MCP-link blijven buiten de query ook expliciet gepind. Gebruik staging `link_6b02f3ceefa481919796c872809fe1c0` of productie `link_6ae013e4bce081918aeddc1ab3db2a9d`.

Het template doet hoogstens één `UPDATE` van alleen de primary-key-kolom `version`. Het doet geen INSERT, DELETE, DDL, statementwijziging of samenvoeging van historie. Alle overige kolommen blijven identiek; `preserved_fields_sha256` maakt dat controleerbaar. De lock raakt uitsluitend de kleine migratieregistratie en houdt de controles op duplicaten/afwezigheid stabiel. Lockwacht maximaal twee seconden, statement maximaal vijf seconden.

Bij ontbrekende of afwijkende bron, verkeerde projectref, dubbele naam/hash of reeds bestaande target wordt nul rijen aangepast en een expliciete refused-status teruggegeven. Een al correct gecanonicaliseerde unieke rij is een herkenbare no-op. Een onverwachte concurrente versieconflict valt bovendien op de primary key en rolt de transactie terug.

```sql
begin;
set local lock_timeout='2s';
set local statement_timeout='5s';
-- This registry-only lock excludes concurrent INSERT/UPDATE/DELETE while checking
-- absence and ambiguity; it does not lock application or family tables.
lock table supabase_migrations.schema_migrations in share row exclusive mode;

with allowed(target_version,expected_name,expected_sha256) as (values
 ('20261123115349','billing_entitlements_campaigns_coupons_provider_queue','ab5a86867e737741cd3d679e9bd6d9b7cef6c340a33432a81452494da37a9c22'),
 ('20261123121009','billing_legal_documents_v20261123_1','b722f5b5f2ccb6e5e40f4dba0a8dfeaf05d4657985cbad5c545916584fd9b566'),
 ('20261123123231','billing_play_sandbox_readiness_proof','9efde7e9be163e74c1441c6f16c37e3dd50f4d530cbbdf71e7248ff0f512ca47')
), input(source_version,target_version,expected_project_ref) as (values
 -- Fill SOURCE only from the immediately preceding read-only metadata probe.
 ('REPLACE_WITH_OBSERVED_SERVER_VERSION','20261123115349','REPLACE_WITH_PROJECT_REF')
), spec as (
 select i.*,a.expected_name,a.expected_sha256
 from input i left join allowed a using(target_version)
), checked as (
 select s.*,
  s.expected_project_ref in ('tlwfpivafcokcjyjwgmq','aptprpkosqctwrzeetgs')
   and s.expected_project_ref=(select project_ref from private.lifecycle_worker_schedule where singleton) as project_matches,
  (select count(*) from supabase_migrations.schema_migrations m where m.version=s.source_version and m.name=s.expected_name and cardinality(m.statements)=1 and encode(extensions.digest(convert_to(array_to_string(m.statements,E'\n'),'UTF8'),'sha256'),'hex')=s.expected_sha256) as exact_sources,
  (select count(*) from supabase_migrations.schema_migrations m where m.name=s.expected_name) as matching_names,
  (select count(*) from supabase_migrations.schema_migrations m where encode(extensions.digest(convert_to(coalesce(array_to_string(m.statements,E'\n'),''),'UTF8'),'sha256'),'hex')=s.expected_sha256) as matching_hashes,
  (select count(*) from supabase_migrations.schema_migrations m where m.version=s.target_version) as existing_targets
 from spec s
), changed as (
 update supabase_migrations.schema_migrations m
 set version=c.target_version
 from checked c
 where c.expected_name is not null and c.project_matches
  and c.source_version ~ '^[0-9]{14}$' and c.source_version>'20261123003259'
  and c.source_version<>c.target_version
  and c.exact_sources=1 and c.matching_names=1 and c.matching_hashes=1 and c.existing_targets=0
  and m.version=c.source_version and m.name=c.expected_name
  and cardinality(m.statements)=1
  and encode(extensions.digest(convert_to(array_to_string(m.statements,E'\n'),'UTF8'),'sha256'),'hex')=c.expected_sha256
 returning m.version,m.name,cardinality(m.statements) as statement_count,
  encode(extensions.digest(convert_to(array_to_string(m.statements,E'\n'),'UTF8'),'sha256'),'hex') as query_sha256,
  encode(extensions.digest(convert_to((to_jsonb(m)-'version')::text,'UTF8'),'sha256'),'hex') as preserved_fields_sha256
)
select case
 when c.expected_name is null then 'refused_unapproved_target'
 when c.project_matches is distinct from true then 'refused_wrong_project'
 when c.source_version=c.target_version and c.exact_sources=1 and c.matching_names=1 and c.matching_hashes=1 then 'already_canonical_noop'
 when c.existing_targets<>0 then 'refused_target_exists'
 when c.source_version !~ '^[0-9]{14}$' or c.source_version<='20261123003259' then 'refused_source_version'
 when c.exact_sources<>1 then 'refused_source_not_exact'
 when c.matching_names<>1 or c.matching_hashes<>1 then 'refused_ambiguous'
 when (select count(*) from changed)=1 then 'canonicalized'
 else 'refused_no_update'
 end as status,
 c.source_version,c.target_version,c.exact_sources,c.matching_names,c.matching_hashes,c.existing_targets,
 (select count(*) from changed) as updated_rows,
 coalesce((select jsonb_agg(to_jsonb(changed)) from changed),'[]'::jsonb) as changed_rows
from checked c;

commit;
```

## Verplichte nacontrole

Voer de metadata-SELECT opnieuw uit in een aparte call. Sommige SQL-API's tonen bij een multi-statementtransactie alleen het laatste commandresultaat; een leeg COMMIT-resultaat bewijst dus geen succesvolle canonicalisatie.

Ga uitsluitend verder als de lokale targetversion exact één record heeft met dezelfde naam, statement_count=1, query_sha256 en preserved_fields_sha256 als vóór de hernoeming. Bij een echte hernoeming is de eerdere serverversion afwezig. Het totaal aantal historieregels blijft gelijk aan direct na apply. Alle oudere veertien records blijven bytegelijk. Bij een weigering of ambiguïteit wordt niets verwijderd, overschreven of opnieuw toegepast; onderzoek eerst de exacte metadata.

