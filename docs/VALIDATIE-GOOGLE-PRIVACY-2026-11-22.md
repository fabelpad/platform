# Fabelpad — Google, OTP, privacy en accountlevenscyclus

Gecontroleerd op 22 november 2026. De webrelease gebruikt de door de eigenaar bevestigde Supabase Custom SMTP via Resend. Google en e-mail zijn in beide projecten ingeschakeld; de applicatie accepteert precies zes OTP-cijfers. Er is geen Send Email Hook geactiveerd.

## Schone lokale build

Broncommit **`9e7c1db19513ff075df7aba558ef14f213de2692`**, via `git archive` naar een afzonderlijke lege werkmap, gevolgd door `pnpm install --frozen-lockfile`. Node **24.18.0**, pnpm **11.25.0**, Next **16.3.4**. `FABELPAD_DATA_MODE=local`, geen Supabasewaarden of runtimegeheimen. Dit is een echte productiebuild van de webapp met geïsoleerde testconfiguratie, geen doelkandidaat.

`bash scripts/local-build.sh` slaagt volledig: configuratie, TypeScript, alle content-/profiel-/synchronisatiechecks, PostgreSQL/RLS en CAS, 32 Auth-contractscenario’s, 26 ouder-API-scenario’s, 48 AVG-beheer-API-scenario’s, lifecycle- en echte pgcrypto/HMAC-checks, 18 workertests, 59 mailtests, 17 Python-mailconfiguratietests, 87 releasetests, 19 hostinstallatietests, native gedragscontrole en `next build`.

De optimalisatiebuild compileerde met Turbopack en maakte de nieuwe publieke juridische pagina’s, ouderaccount-/herstelpagina, AVG-beheerpagina en afgeschermde API-routes aan. Alle statische bestanden, lokale fonts en het officiële Google-icoon worden met het project geleverd. De normale build voert geen echte mailverzending, live databasemigratie of appactivering uit.

## Browser en Edge

Alle **34 browsertests slagen** op de geïsoleerd gestarte productiebuild, in 24,8 seconden. De volledige run omvat mobiele vormgeving, bestaande lees-/beheerflows, Google/OTP, registratieverklaringen, documentversiewissel, toestemming per profiel, intrekking tijdens een open verhaal, verse authenticatie, expliciet herstel, apparaatgegevens wissen bij bewezen verwijdering, juridische downloads, offline TTS, AVG-beheer en de SMTP-HTML-download.

Twee testlocators zijn aangescherpt: de sluitknop wordt aan de bedoelde ouderdialoog gebonden en selecties gebruiken hun toegankelijke comboboxnaam. Dit veranderde geen applicatiecode. De gecorrigeerde tests zijn daarna samen alle 34 opnieuw uitgevoerd. Er zijn geen echte mailboxen, accounts of externe providers gebruikt in deze browsertests.

De drie Edge-entrypoints zijn met Deno **2.9.8** gecontroleerd. De onderhoudswerker accepteert uitsluitend een projectgebonden HMAC met korte geldigheid en een atomair eenmalige nonce. Geen herbruikbare sleutel staat in de providerqueue; echte SQL-HMAC-uitkomsten zijn lokaal met Node-crypto vergeleken.

## Live Supabase en host

Beide Supabase-projecten hebben de vier nieuwe migraties met gelijkgetrokken, op exacte SQL-hashes gecontroleerde historie. `email-admin` v2 en `account-maintenance` v2 zijn actief. Een expliciete onderhoudsaanroep en daaropvolgende cronaanroepen geven in beide projecten HTTP200 met `completed:0,deferred:0`. Dit bewijst de scheduler-/authenticatieroute, geen echte verwijdering of mailbezorging. Nul gebruikers, beheerders, gezinnen en API-mailconfiguraties zijn behouden. Automatische 90-dagenwissing blijft uit.

Security advisors melden in beide projecten **0 WARN/ERROR** en 13 verklaarde INFO-meldingen voor private tabellen met bewuste directe toegangsweigering. De providerextensie `pg_net` staat in `extensions`. Het [controlebewijs](deploy-evidence/google-legal-lifecycle-2026-11-22.json) bevat doelidentiteiten, migratiehashes en de grenzen van de uitgevoerde proef.

Op dg-vps-08 zijn beide beperkte repositoryrunners online, de twaalf eigen rootadapters bijgewerkt en de eigen journaldnamespaces voorbereid. Een v2-configuratiebewijs per doel bindt de gecontroleerde publieke providerinstellingen aan het juiste project en origin. Het verklaart uitdrukkelijk dat interactieve OTP-/Google-acceptatie nog nodig is. Bestaande Caddy-, SSH-, Tailscale- en Castiq-inrichting blijft buiten de wijzigingen.

## Open punten voor publieke productie

De nieuwe app is nog niet publiek opengesteld. De bijlage vereist correcte openbare voorwaarden/privacy vóór publicatie. Daarvoor ontbreken nog bevestigde maximale back-up/provider-/VPS-termijnen, de feitelijke supportmailleverancier en verwerkers-/doorgifteafspraken. DNS laat `mx.stackmail.com` zien; een MX-record bewijst geen contract, reseller of retentiebeleid.

De afzonderlijke Resend API-koppeling moet na de echte eerste beheerderaanmelding per omgeving via Beheer → E-mail worden ingevoerd en getest. SMTP levert die API-key niet automatisch aan Vault. Interactieve OTP-/Google-login, inboxbezorging en een echte back-upherstelproef zijn niet als geslaagd aangemerkt. Er zijn geen betaalroute, abonnement, incasso of storepublicatie toegevoegd of uitgevoerd.
