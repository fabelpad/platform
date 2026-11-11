# Nog benodigde gegevens en inrichting

Bijgewerkt: 11 november 2026. De lokale demo moet zonder externe accounts of secrets bouwen. Voor het nieuwe stagingdoel op dg-nxttrack-01 staan de inmiddels vastgestelde host-, account-, runner- en padkeuzes in [DEPLOY-DG-NXTTRACK-01.md](DEPLOY-DG-NXTTRACK-01.md). Die gegevens vervangen voor dit doel de eerdere placeholders hieronder. De overige account-/providerlijst blijft van toepassing; ontbrekende waarden zijn niet als geconfigureerd beschouwd.

## Projectgegevens vóór koppelen of uitrollen

- Repository vastgesteld: [`fabelpad/platform`](https://github.com/fabelpad/platform), gekoppeld als `origin`, met integratiebranch `main`. Geef nog de juiste beheerders-/runnerrechten en bevestig de verantwoordelijke organisatie.
- Geef per omgeving de HTTPS-URL, site-ID, deployhost, Linux-gebruiker, checkout-/release-/shared-paden, interne loopbackpoort en Caddy-inrichting.
- Geef de self-hosted runnernamen en exacte labels, GitHub environments `staging` en `production`, bestaand build-lock, bewaarbeleid en configuratieversie.
- Lever het actuele `dg-site-deploy`-runbook: geïnstalleerde versie, configuratieallowlists, Next.js-startwijze, activatie-, health- en rollbackcontract. Het ontbrekende wrappercontract wordt niet in deze repository nagebootst.
- Geef backupdoel, versleutelings-/sleutelbeheer, bewaartermijn en herstelprocedure voor de database vóór een eerste migratie.
- Bevestig supportadres, bedrijfs-/verantwoordelijke organisatie, privacycontact, bewaartermijnen, accountverwijderingsbeleid en de definitieve website-/storeteksten.
- Beslis later over prijzen, pakketten, foundersvoorwaarden, profielgrenzen en Play-product-ID's. Het voorgestelde gratis model is nog geen definitief commercieel besluit.

## Accounts en externe voorzieningen

| Voorziening | Nodig voor | Wanneer |
| --- | --- | --- |
| GitHub-repository `fabelpad/platform` | Gekoppeld; environments en self-hosted doelrunners nog in te richten | Bronpush beschikbaar; vóór staging runner-/environmentinrichting afronden |
| Supabase-account/organisatie met **apart staging- en productieproject** | PostgreSQL, Auth, RLS en gecontroleerde opslag; projectref en regio vastleggen | Vóór echte accounts/gezinsdata |
| Google Cloud-project met OAuth-configuratie | Web- en Android-Google-login, consentconfiguratie, exacte callbacks en signingcertificaten | Vóór Google-login aanzetten |
| Resend-account, geverifieerd afzenderdomein en DNS-toegang | Verzending via de bestaande DG-mailgateway; providerwebhooks en aflevergebeurtenissen | Vóór OTP/applicatiemail aanzetten |
| Bestaande DG-mailgateway/outbox en beheerder | Ondertekende Supabase Auth-mail, applicatiemail, worker, retries en reconciliatie | Contract eerst vaststellen |
| DNS-/VPS-beheer en backupopslag | Domeinen, TLS/Caddy, native releases en herstel | Vóór staginguitrol |
| Gewoon Android-testtoestel en eventueel emulator | APK-installatie, offline herstart, terugknop, audio, toegankelijkheid en prestaties | Vóór native acceptatie |
| Google Play Console-organisatie/account | Interne/gesloten test, Play App Signing, appverificatie en latere publicatie | Na definitieve productie-package-ID |
| Play Developer API-serviceaccount met gerichte apprechten | Automatische testdistributie, aankoopvalidatie en billingmeldingen | Alleen wanneer die koppelingen worden ingericht |
| Expo-account | Eventueel team-/distributiebeheer | Geen vereiste voor de afgesproken lokale Expo/Gradle-build |

## Variabelen die de huidige webcode daadwerkelijk gebruikt

Plaats lokale waarden in `.env.local` op basis van `.env.example`. Voor **fabelpad-nxttrack-staging** staan build- en runtimewaarden uitsluitend in de gescheiden root-owned hostbestanden uit het doelrunbook; de GitHub environment regelt de activatiegoedkeuring. Er worden geen runtimegeheimen via GitHub naar de build gestuurd. Productie krijgt later een afzonderlijk contract. De voorbeeldbestanden bevatten uitsluitend lege waarden.

| Naam | Klasse en plek | Verplicht / betekenis |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Publiek, **buildtijd**, browser | Met de publishable key beide invullen voor echte backend; per omgeving de juiste projectorigin |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publiek, **buildtijd**, browser | Een `sb_publishable_`-key; nooit secret/service-role of oude JWT-key. Toegang wordt afgedwongen met RLS |
| `APP_URL` | Serverconfiguratie, geen secret | Canonieke origin voor veilige callbacks en mutaties; lokaal `http://localhost:3000`, extern HTTPS |
| `FABELPAD_DEPLOY_ENV` | Build/runtime-metadata, geen secret | `local` (standaard), `staging` of `production` |
| `FABELPAD_RELEASE_SHA` | Build/runtime-metadata, geen secret | Buiten lokaal verplicht; volledige uitgecheckte SHA van 40 hextekens |
| `FABELPAD_AUTH_EMAIL_ENABLED` | Serverconfiguratie, geen secret | Standaard `false`; pas `true` na werkende Supabase OTP en DG-mailgateway |
| `FABELPAD_AUTH_GOOGLE_ENABLED` | Serverconfiguratie, geen secret | Standaard `false`; pas `true` na provider-/callbackverificatie |
| `PORT` | Next.js-serverconfiguratie, geen secret | Lokale alternatieve poort; definitieve deploypoort volgt uit projectprofiel |
| `FABELPAD_BUILD_LOCK` | Lokale bouwconfiguratie, geen secret | Optioneel bestaand hostbreed lockpad; standaard uitsluitend checkoutlock in tijdelijke map |

Gebruik `pnpm check:config` lokaal en `node scripts/config-check.mjs --target=staging` voor een strikte naam-/vormcontrole. Ongemelde `NEXT_PUBLIC_`-namen worden afgewezen. Waarden worden niet gelogd.

De huidige Next.js-runtime heeft **geen** Supabase service-role key, Resend API-key of databasewachtwoord nodig. Gebruikerssessies en RLS/RPC bepalen de rechten. Beheermachtiging wordt door een vertrouwde databasebeheerder aan een bestaand Auth-user-ID toegekend; de eerste gebruiker of user-editable metadata krijgt die rol niet automatisch.

## Serversecrets voor Supabase, gateway en workers

Deze secrets horen straks bij Supabase/providerconfiguratie of een gecontroleerde worker, buiten de browser- en native bundels. De exacte namen zijn nog **niet vastgesteld** zolang het actuele DG-mailcontract ontbreekt; plaats daarvoor nog geen zelfverzonnen envnamen in de app.

| Gegeven | Bestemming / ontbrekend contract |
| --- | --- |
| Google OAuth client-ID en clientsecret | Supabase Google-provider; webcallback, Android-client-ID's en certificaatvingerafdrukken per omgeving |
| Supabase Auth-mailhook/gateway signingsecret | Exact gateway-URL, headers, ondertekening, payloadschema en contractversie uit het DG-runbook |
| Apart applicatiemail-/outbox-signingsecret | Duurzame outbox, workeridentiteit, idempotency en reconciliatiebeleid; gescheiden van Auth-mail |
| Resend API-key | Alleen de bestaande gateway-/worker-runtime; geverifieerde afzender, gescheiden ontvangerbeleid |
| Providerwebhook signingsecret | Beveiligde webhookontvanger, eventcontract, late events en historische providercontracten |
| Eventuele privileged Supabase-workerkey | Alleen wanneer de vastgestelde Edge-/workerimplementatie deze nodig heeft; nooit webclient/native |

Nog nodig: toegestane afzender, gecontroleerde testontvangers, welke processen Auth-mail versus applicatiemail versturen, outboxtabellen, workerplanning, retrylimieten, onzekere uitkomsten en afleverstatussen. Provideracceptatie, mailserveraflevering en ontvangst in de mailbox worden afzonderlijk getest. Er wordt geen alternatieve SMTP-/mailgateway ingevoerd.

## Deploysecrets en GitHub environments

Voor het nieuwe doel is de exact gekozen activatie-environment **fabelpad-nxttrack-staging**; de oudere generieke naam staging is daarvoor geen instructie. Productie blijft afzonderlijk en oningericht. Publieke buildconfiguratie, serverconfiguratie en deploymentbevoegdheid krijgen gescheiden allowlists. Runnerlabels, host, site-ID, paden, poorten, SHA en configuratieversie zijn **variabelen**, geen geheimen.

Voor de deploy-/databasebeheerlaag kunnen Supabase CLI-toegang, een databaseverbinding, backupencryptie-/hersteltoegang en beperkte runnerbevoegdheden nodig zijn. Hun exacte secretnamen en scopes volgen uit het echte DG-releasecontract. Een self-hosted runner is geen reden om nu een breed SSH/PAT-secret te verzinnen. Deploycredentials worden niet aan `next build` of de app-runtime doorgegeven. Maak vóór schemawijzigingen de voorgeschreven versleutelde backup met herstelbewijs.

## Android-configuratie en signing

| Naam / gegeven | Plek | Timing |
| --- | --- | --- |
| `FABELPAD_VARIANT` | Expo-buildomgeving; standaard demo, `production` expliciet | Bij iedere build vastleggen |
| `FABELPAD_ANDROID_PACKAGE` | Niet-geheime definitieve productie-ID | Vóór eerste Play-registratie; productiebuild weigert ontbrekende ID |
| `FABELPAD_ANDROID_VERSION_CODE` | Niet-geheim positief geheel getal | Voor iedere Play-update verhogen |
| Demo-ID/deeplink | `nl.dgwebservices.fabelpad.demo` / `fabelpaddemo` | Lokaal; definitieve staging-ID en callbacks nog bevestigen |
| Productie-deeplink / callbacks | Expo/Supabase/Google-configuratie | Vóór echte native login |
| Publieke native backendconfiguratie | Exacte namen pas bij aansluiting vastleggen | Geen serverkeys; huidige demo is niet met Supabase verbonden |
| Upload-keystore, alias en wachtwoorden | Beveiligd bestand/secretstore op bevoegde buildhost | Vóór ondertekende productie-AAB; ontbreekt |
| Play App Signing-certificaat versus upload-/debugcertificaat | Play Console en Google OAuth Android-clients | Alle werkelijk gebruikte SHA-vingerafdrukken registreren |
| Play API-serviceaccount | Secretstore voor beperkte backend-/distributietaak | Alleen bij geconfigureerde automatische testdistributie/billing |
| Product-ID's, abonnementen en testaccounts | Play Console + serverrechtenlaag | Vóór echte Billing-integratie en sandboxacceptatie |

Een lokale debug-APK is geen ondertekende productiekandidaat; Metro is geen APK. Een staging-AAB met stagingbackend mag niet naar productie. Dezelfde geteste productie-AAB kan later intern getest en vervolgens vrijgegeven worden. Een gehoste Expo-builddienst is niet vereist. Controleer de actuele officiële Android-/Play-toolchaineisen opnieuw vóór native productiebuild en indiening; oude documentwaarden zijn geen nieuw verificatiebewijs.

## Volgorde na de lokale oplevering

1. Vul projectprofiel en repository-/runner-/wrappergegevens in; richt GitHub environments in.
2. Maak/koppel Supabase staging en productie, pas migraties met backup/herstelbewijs toe en test RLS met twee ouders plus gemanipuleerde kind-ID's.
3. Configureer callbacks, Google en de bestaande DG-mailgateway/outbox; zet providers pas na werkende tests aan.
4. Deploy exact de groen geteste SHA via het geverifieerde DG-pad naar staging; controleer runtime-SHA en echte gezin-/beheerflows.
5. Installeer de lokaal gebouwde native demo-APK en voer toestelacceptatie uit. Sluit daarna de nog ontbrekende native cloudlaag aan en bouw een aparte staging-APK met geverifieerde backendconfiguratie.
6. Leg productie-ID/signing/commerciële en privacygegevens vast; maak pas daarna een productie-AAB en eventuele Play-testdistributie. Productie-uitrol en openbare publicatie vallen buiten deze lokale opdracht.
