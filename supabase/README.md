# Lokale backendvoorbereiding

De migratie bouwt het databasecontract voor Supabase. Er is geen project aangemaakt, gekoppeld of gewijzigd. Er wordt geen Docker-stack geïntroduceerd. De webapp blijft zonder configuratie als lokale demo bruikbaar.

## Configuratie

- `NEXT_PUBLIC_SUPABASE_URL`: publieke project-URL van de betreffende omgeving.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: alleen een `sb_publishable_` key. Een serversecret wordt geweigerd.
- `APP_URL`: de exacte eigen origin voor callbacks en mutatiecontrole; HTTPS buiten localhost.
- `FABELPAD_AUTH_EMAIL_ENABLED=true`: pas instellen na inrichting en acceptatie van de bestaande DG mailgateway.
- `FABELPAD_AUTH_GOOGLE_ENABLED=true`: pas instellen na configuratie van de Google-provider en callbacks.

De webserver gebruikt geen service-role/secret key. De server verifieert de cookie bij Supabase Auth met `getUser()`. De database krijgt de betreffende ouderidentiteit en begrenst die met RLS. Cookies zijn HttpOnly, SameSite=Lax en Secure op HTTPS. De route handlers vernieuwen cookies; de huidige app voert geen sessieautorisatie uit in Server Components. Een toekomstige SSR-authenticatielaag moet de cookievernieuwing volgens het actuele Next.js/Supabase proxycontract verzorgen.

OTP's worden uitsluitend door Supabase gegenereerd en geverifieerd. Het Auth-template moet een code met `{{ .Token }}` leveren; de standaard magic-linktekst past niet bij het invoerscherm. Google redirect via Supabase: `https://<werkelijke-projectref>.supabase.co/auth/v1/callback`; appcallback: `<APP_URL>/auth/callback`, opgenomen in de Supabase allowlist. Projectref, callback-origin en Google-credentials blijven nog in te vullen.

## Tabellen en rechten

`family_documents` bewaart het bestaande schemaVersion=1 snapshot per ouder. Kind-ID's zijn alleen binnen dat gezin betekenisvol. Alleen de eigen ouder kan het document lezen. De schrijf-RPC accepteert geen ouder-ID en voert een atomaire revisievergelijking uit. Rechtstreeks schrijven is niet toegestaan. De Next.js-grens hergebruikt de volledige domeinvalidatie; de database controleert bovendien de profiel- en recordstructuur, herinneringsvelden, eigendom, revisies en maximale grootte. Ook directe RPC-verzoeken met ongeldige nullvelden of beschadigde herinneringen worden geweigerd. Oude `{picks,updatedAt}` records en nieuwe records met `storyId`, `contentVersion` en `revision` blijven geldig.

`content_admins` wordt uitsluitend door vertrouwde SQL beheerd. Een bevoegde beheerder moet een bestaand `auth.users.id` expliciet toevoegen; niemand krijgt automatisch rechten, ook de eerste registratie niet. User-editable metadata speelt geen rol in autorisatie. `content_drafts` zijn alleen zichtbaar voor toegewezen beheerders. Schrijven heeft revisiecontrole. `content_releases` bevatten de volledige 31 scènes en 32 eindes per verhaal. Lezers mogen uitsluitend releases lezen; wijzigen en verwijderen wordt ook door een trigger geblokkeerd. Publicaties zijn idempotent op de hash van canoniek JSON en oude publicaties blijven behouden.

De invoker-RPC `get_content_catalog` kiest in de database één laatste release per verhaal en levert alleen metadata. Bewaarde releases kunnen daardoor geen andere verhalen buiten de Data API-rijlimiet duwen. Verwijdering van een contentauteur maakt de auteurverwijzingen leeg en bewaart concepten en releases.

De private `SECURITY DEFINER`-functies zijn beperkt tot deze handelingen, hebben een lege search_path, controleren `auth.uid()` en expliciete beheerrechten, en staan buiten het blootgestelde API-schema. Publieke RPC-wrappers draaien als invoker. Anonieme sign-ins mogen geen gezin opslaan.

Er is nog geen beleidskeuze voor betaalde profielgrenzen of servergestuurde abonnementstoegang geïmplementeerd. Het bestaande maximum van vijf profielen is het compatibiliteitscontract van het prototype, geen betaalpakket. De content-API levert in deze lokale fase de volledige publieke catalogus. Productiebetalingen mogen hier niet op worden aangesloten voordat entitlementcontrole is gebouwd.

## Reële inrichting en gegevensbehoud

Volg het projectrunbook, de bestaande DG build-lock en versleutelde backup met herstelbewijs voordat migraties naar een echte omgeving gaan. Inspecteer eerst bestaande schema's, grants en migratiegeschiedenis. Deze additieve migratie importeert en verwijdert geen D1-data. Een eventuele bestaande D1-omgeving vraagt een expliciete, gevalideerde export/import en mapping van oude ouderidentiteiten naar Supabase-UUID's; koppel geen gezinnen op basis van een door de client gekozen ID.

Supabase CLI 3.0.0 is gecontroleerd; het migratiebestand is met `supabase migration new family_content_contract` aangemaakt. Gebruik de vastgelegde CLI-versie en ontdek de actuele target-/dry-runopties met `--help`. Er is geen remote target in deze checkout opgeslagen.

Archiveer ook de originele bronrelease vóór latere wijzigingen in verhaalbronnen:

```bash
node scripts/supabase-export-content.mjs --output /tmp/fabelpad-broncontent.sql
```

Dit genereert alleen reviewbare SQL, weigert een bestaand bestand te overschrijven en voert niets uit. Pas de SQL na migratie via het gecontroleerde databasepad toe; opnieuw uitvoeren overschrijft geen release. Zet alle bronreleaseversies die bestaande avonturen gebruiken duurzaam in `content_releases`. De browser bewaart ook de gekozen volledige release lokaal. Bij een ontbrekende expliciete versie retourneert de API een fout en vervangt geen avontuur stilzwijgend.

Accountinzage loopt via het eigen family-endpoint. Geautomatiseerde accountverwijdering is nog niet aangesloten: verwijdering en sessierevocatie moeten samen met de bestaande DG account-/auditprocedure worden ingericht. Het verwijderen van een Supabase-user maakt bestaande JWT's niet automatisch onmiddellijk ongeldig. Maak geen verborgen beheerdersbypass voor reviewers.

## Mailgateway en opslag

Het actuele DG gateway-/outboxrunbook ontbreekt. Gateway-URL, handtekeningalgoritme, signed headers/body, signingsecret-namen, toegestane afzender/ontvangers, durable-outboxschema, worker, idempotentie/reconciliatie en providerwebhooks zijn daarom expliciet niet geïmplementeerd. Er is geen alternatieve SMTP-opzet toegevoegd en er zijn geen testmails verzonden. Email-login blijft standaard uit. Resendcredentials horen uitsluitend in die bestaande gateway/worker, niet in de app of browserbundle.

De bestaande illustraties blijven lokale, meegebouwde assets. Supabase Storage-buckets, uploadregels, MIME-/groottecontrole en eventuele signed URLs worden pas ingericht met het echte project en mediabeleid. Geen publieke uploadbucket of fictieve Edge Functions is aangemaakt.

## Verificatie

```bash
node scripts/supabase-db-check.mjs
node scripts/supabase-contract-check.mjs
```

De eerste voert de echte migratie uit in lokale PostgreSQL WASM (PGlite), met beperkte Auth-stubs. Hij test twee ouders met dezelfde kind-ID, RLS zonder ownerfilter, verboden directe writes/zelfpromotie, CAS en replay, expliciete adminrechten, conceptisolatie en onveranderlijke/idempotente releases. Alle dertien releases krijgen exact dezelfde canonieke bytes/hash in PostgreSQL en JavaScript. Extra regressies controleren corrupte directe RPC-verzoeken, echte gegenereerde herinneringen, de UTF-16 naamlimiet, een catalogus met meer dan duizend bewaarde releases en auteurverwijdering zonder releaseverlies. De wachtrij test twee gelijktijdig ingediende writes, maar PGlite bewijst geen echte multi-connection-lockcontention.

De tweede test configuratie zonder secrets, weigering van een serverkey als publieke key, retourpaden, origin-/bodygrenzen, browser/servercontentgelijkheid en oude/nieuwe snapshotrecords. Hosted Supabase Auth, OTP-bezorging, OAuth/cookies in een echte providerflow, hosted RLS/advisors, Storage, Edge Functions en DG gateway/outbox zijn niet getest.

Actuele primaire referenties gecontroleerd op 4 november 2026: [SSR-client/cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [OTP/template](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog). De aangekondigde uitschakeling van verouderde TLS 1.2-ciphers op 10 november raakt de moderne Node/Supabase-client niet als aangepaste oude TLS-configuratie wordt vermeden.
