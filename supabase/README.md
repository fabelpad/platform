# Fabelpad — Supabase, beheerrechten en mail

Gecontroleerd op **22 november 2026**. Deze inrichting betreft uitsluitend onderstaande twee Fabelpad-projecten. Beide waren nieuw/leeg: nul applicatietabellen, nul migraties en nul Auth-gebruikers.

| Omgeving | Workspace-account | Project / regio | Site URL |
| --- | --- | --- | --- |
| staging | **fabelpad** | `tlwfpivafcokcjyjwgmq` / eu-west-1 | `https://staging.fabelpad.nl` |
| production | **Duindorpdoet** | `aptprpkosqctwrzeetgs` / eu-west-1 | `https://fabelpad.nl` |

De vier publieke GitHub-variabelen staan per bestaande environment; zie [INRICHTING.md](../docs/INRICHTING.md). De webserver heeft geen service-role key nodig.

## Toegepaste migraties

1. `20261104095714_family_content_contract.sql`: eigen gezinsdocumenten, CAS-revisies, expliciete beheerders, afgeschermde contentconcepten en onveranderlijke verhaalreleases.
2. `20261122140451_verified_bootstrap_admin.sql`: bevestigde eigenaar-mailbox als eerste beheerder en beperkte uitvoerrechten van de platformhelper.

Beide migraties zijn via de verbonden Supabase-beheertool toegepast en daarna gecontroleerd. Die tool gaf uitvoertijdstempels; na vergelijking van de **volledige SQL-SHA256** is uitsluitend de migratieversie-administratie gelijkgetrokken met de bestandsnamen. SQL, naam en inhoud zijn behouden. Beide projecthistories matchen nu de twee bestanden. Gebruik geen tweede ongecontroleerde `db push` om deze migraties opnieuw uit te voeren. [Officieel migratiecontract](https://supabase.com/docs/guides/deployment/database-migrations).

De tweede migratie is met de officiële, checksum-gecontroleerde **Supabase CLI 3.2.0** en `supabase migration new verified_bootstrap_admin` aangemaakt. Versie 3 heeft andere standaardtargetkeuzes; controleer de actuele help en selecteer een hosted project expliciet. CLI-installatie is geen runtimevoorwaarde.

## Databasecontract

- `family_documents`: ouder-UUID als eigenaar, RLS SELECT op eigen rij. Alleen gevalideerde CAS-RPC schrijft een volledig document. Andere gezinnen en anonieme sessies krijgen geen toegang.
- `content_admins`: alleen eigen rol lezen; geen client-write. Beheerrechten komen uit deze tabel.
- `content_drafts`: alleen beheerder, met revisiecontrole en gevalideerde RPC.
- `content_releases`: publiek leesbaar, versiehash en immutable trigger. Publicatie bewaart eerdere verhaalversies; accountverwijdering verwijdert geen publieke verhaalrelease.
- Privileged functies staan in `private`, met lege search_path, expliciete grants en servercontroles. Public wrappers zijn invokerfuncties.

Alle vier tabellen hebben RLS. Publieke REST-controles geven 13 catalogusverhalen en HTTP401 voor anonieme toegang tot gezinnen, beheerderrollen en concepten. Security advisors geven na hardening **nul meldingen** in beide projecten.

De 13 bestaande bronverhalen zijn per project geïmporteerd als immutable releases, met dezelfde hashes als web/native. De export is idempotent: bestaande story/version-rijen blijven behouden. Nieuwe content uit de studio gaat via de bestaande validatie/publicatieroute. De export kan opnieuw ter beoordeling worden gemaakt met:

```bash
node scripts/supabase-export-content.mjs --output /ABSOLUUT/NIEUW/PAD/content.sql
```

Dit commando schrijft alleen een bestand; het voert geen SQL of mail uit. Splits grote imports in begrensde statements, omdat de beheer-API een querylimiet heeft.

## Eerste beheerder

**info@dgwebservices.nl** is de expliciete bootstrapmailbox. De trigger vertrouwt uitsluitend `auth.users.email`, `email_confirmed_at` en `is_anonymous`. Na daadwerkelijke adresbevestiging ontstaat automatisch een `content_admins`-rij met `grant_source=bootstrap_email`.

Een onbevestigde gebruiker, anonieme sessie of gemanipuleerde user_metadata krijgt geen rol. Verlies van het bevestigde adres trekt uitsluitend die automatische rol in. Afzonderlijk handmatig toegekende beheerders blijven behouden. Het verwijderen van de Auth-gebruiker verwijdert diens gezinsdocument en rol via bestaande foreign keys.

Er zijn nog **nul Auth-gebruikers**. Er is geen fictieve gebruiker aangemaakt en geen mailbox als bevestigd gemarkeerd zonder bewijs van bezit. De eerste geslaagde OTP-aanmelding van het aangewezen adres maakt het account en de beheerrol aan. Geef geen OTP in chat/logs. Controleer daarna servermatig `getUser`, de eigen rol en de studio.

## E-mail-OTP via Resend API

`auth-email` is in beide projecten voorbereid. `verify_jwt=false` is bewust: Auth verstuurt vóór een gebruikerssessie. De handler vereist een geldige **Standard Webhooks HMAC-SHA256-handtekening**, tijdvenster, begrensde body en juiste Site URL. Niet-ondertekende verzoeken kunnen niet mailen. Zolang de bootstrapinstellingen ontbreken, retourneert POST een generieke HTTP503. Na eerste beheeropslag leest de hook de configuratie via het service-only RPC uit Vault; databasefouten vallen niet terug op een oude bootstrapkey.

[functions.auth-email] staat in `config.toml`; imports verwijzen naar de gedeelde `lib/email/`-bron. Dezelfde renderer levert 26 plakklare HTML-bestanden en alle ondersteunde applicatieserviceberichten. Er wordt geen advertentie- of trackingmail toegevoegd.

Volg [mailconfiguratie](../docs/EMAIL-CONFIGURATIE.md) en [templatehandleiding](../docs/EMAIL-TEMPLATES.md). De workspaceconnector kan geen Auth-instellingen of Edge secrets instellen. Daarvoor is de bedoelde Management PAT plus Resend-key via een afgeschermde bron of de verborgen terminaltool nodig. Geen beheerkeys in GitHub-variabelen.

## Resend en templates in Beheer

Migratie `20261122150754_admin_email_settings.sql` voegt twee afgeschermde RLS-tabellen in `private` toe. De Resend-key wordt uitsluitend via Supabase Vault versleuteld bewaard. `get_email_settings()` geeft alleen aan bevestigde huidige beheerders de niet-geheime instellingen terug. Ontsleutelde configuratie, testreservering en atomair opslaan zijn service-only RPC's voor de Edge-runtime; het browser-JWT en de Next-server krijgen deze rechten niet.

De `email-admin` Edge Function doet zelf verplicht `getUser` plus databasebeheercontrole; `verify_jwt=false` vervangt die controle niet. Beide Edge-entrypoints controleren de vaste omgeving/project/origin-combinatie voordat zij private configuratie lezen. Opslag vereist een geaccepteerde test naar uitsluitend de ingelogde beheerder, actuele revisie en een eenmalig testbewijs met vervaltijd. Zie [EMAIL-BEHEER.md](../docs/EMAIL-BEHEER.md) voor `/studio/email` en `/studio/email/templates` met alle 17 templates. Deze inrichting maakt geen fictieve beheerder aan en activeert geen toekomstige servicemails zonder echte gebeurtenis.

## Verificatie en herstel

`pnpm check:backend` draait echte PostgreSQL/RLS/RPC-logica in PGlite met beperkte Auth-stubs, plus 25 scenario's met de geïnstalleerde Supabase Auth/SSR-SDK en een synthetische provider. `pnpm check:email` controleert exports, handtekeningen, ontvangers, timeout/idempotentie en de configuratietool. Dit vervangt geen echte mailbox/OTP-aanmelding.

De live controles en migratiehashes staan in [supabase-2026-11-22.json](../docs/deploy-evidence/supabase-2026-11-22.json). Een volgende migratie bij gebruikersdata vereist projectcontrole, passende versleutelde backup, hersteltest en voor-/achterwaartse compatibiliteit. Approllback draait geen database/Auth/Edge/provider terug. De nu toegevoegde schema's worden niet automatisch gedropt bij appfalen; behoud data en onderzoek de eigen wijziging.
