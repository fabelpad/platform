# Validatie betalingen en abonnementen

Gecontroleerd op 23 november 2026 in de lokale ontwikkelcheckout. De nieuwe migratie is gemaakt met `supabase migration new`; deze validatie past geen migratie toe op staging of productie en start geen externe betaling of Play-release.

## Reproduceerbare controles

| Commando | Vastgesteld resultaat |
| --- | --- |
| `pnpm check:billing` | **135 tests + 67 migratiescenariogroepen + juridische versie-upgrade geslaagd**, inclusief aanvullende production Play-readinessproeven. |
| `node scripts/billing/database-check.mjs` | **67 scenariogroepen geslaagd** op de definitieve SQL, met bestaande gezinsdata vóór de upgrade en een verse installatie. |
| `node scripts/billing/concurrency-check.mjs` | **Geslaagd met echte PostgreSQL 17**, onafhankelijke gelijktijdige databasesessies, bestaande lokale containerimage. |
| `node --test scripts/billing/domain.test.mjs` | **5 domeingroepen geslaagd** voor instellingen, kalenderlooptijden en kortingsberekeningen. |

De volledige lokale browsertest slaagt: **86 van 86 scenario’s**. Deze controle omvat schoolcodes met beide bedragbases, volledige cadeaucodes zonder automatische incasso, de betaalontvangstpagina, openbare herroeping en versleutelde offlineopslag per gezin en intrekking tegenover vertraagde schrijfacties in andere browsertabbladen. De native regressies dekken ook volledig wissen en late Auth-refresh-/cache-/voortgangsantwoorden. De Next.js-productiebuild, beide TypeScript-projecten en de bestaande backend-, e-mail-, inhouds-, profiel-, native- en deploymentcontroles slagen. De gekoppelde Metro/Hermes-export en Kotlin-modulecompilatie slagen; volledige AAB- en toestelacceptatie zijn afzonderlijk bewijs.

De standaard GitHub-controle voert `scripts/local-build.sh` uit, inclusief `pnpm check:billing`. De PostgreSQL-concurrencycontrole is apart reproduceerbaar met Docker en veroorzaakt geen hosted mutaties.

## Bewijs van gelijktijdigheid

De echte PostgreSQL-proef gaf letterlijk:

```text
Real PostgreSQL concurrency passed: 49 committed awards, concurrent places50/51 + duplicate onboarding => exactly50, deletion never restocks, concurrent admin CAS has one winner.
```

De test commit eerst 49 verschillende onboardingtoekenningen. Daarna concurreren twee nieuwe ouders en een herhaald onboardingverzoek in onafhankelijke transacties om de laatste plek. Het eindresultaat is exact 50 verschillende toekenningen. Het verwijderen van een toegewezen ouder geeft geen plek terug. Twee gelijktijdige beheermutaties met dezelfde verwachte revisie leveren exact één succesvolle wijziging op. Hiervoor worden de echte transactielocks en PostgreSQL-revisiecontrole gebruikt; een in-memory JavaScript-lock wordt niet als bewijs opgevoerd.

De test maakt alleen zijn eigen tijdelijke container `fabelpad-billing-locks-<pid>` zonder gepubliceerde poorten en met netwerk `none`. Die container is na afloop verwijderd; bestaande containers zijn niet gewijzigd.

## Gedekte regressies

De migratiechecks controleren directe databasegrants en de ACL van interne helpers, inclusief de hernoemde mailhelper; echte adminrollen en recente authenticatie; CAS; blijvende gezinsdata en profielvoortgang; stabiele gratis verhaalkeuze en twee previews; geen betaalmandaat bij volledige cadeaukorting; quote/prijs/voorwaardenconsent; per-code-limieten en holds; configureerbare maand-/periodebedragen en proportionele jaarpercentages; couponpauze; crossprovider-aankoopreserveringen; exacte Play-product-, token- en gezinsbinding; duurzame acknowledgement; private premiumpublicatie en alleen eerste-hoofdstuk-projectie; en providerwerk met alle verkooppoorten uit.

Financiële regressies dekken geverifieerde betaling, opnieuw bezorgde meldingen, oude credentials voor bestaande verplichtingen, oudere terugbetalingen naast nieuwere betaalde rechten, uitschakelen en herinschakelen tijdens een open checkout, terugbetaling na een eerdere webhook, afzonderlijke refundintents en gezamenlijk gereserveerd terugbetaalbudget, pending-refundpolling en chargeback-herstel naar een eerder betaald toestandsbeeld. Een late abonnementsaanmaak na een stop veroorzaakt opnieuw een duurzame annuleringsverplichting.

Openbare herroeping wordt getest zonder ingelogd account: alleen de geverifieerde kopersemail en serverbetalingsreferentie kunnen een opaque verificatietoken laten bezorgen; oude/verkeerde tokens werken niet, opnieuw aanvragen na verlopen verificatie roteert de nonce met behoud van de oorspronkelijke aanvraagdatum, bevestigen is idempotent en raw Vaultsecret/mailpayloads worden begrensd opgeruimd. Betaal- en refundbewijs blijft bestaan.

## Grenzen van dit bewijs

PGlite voert de daadwerkelijke applicatiemigraties uit. De fixture vervangt platformonderdelen die lokaal ontbreken, waaronder Vault-encryptie, cron en netwerkhooks. Deze tests bewijzen geen echte Vault-encryptie of externe betaalverwerking.

Er is voor dit bewijs geen Mollie-testbetaling uitgevoerd, geen nieuwe Play-aankoop gedaan, geen RTDN vanaf Google ontvangen, geen hosted migratie uitgevoerd en geen productiepoort geopend. De provider- en gatewaytests gebruiken deterministische synthetische API-antwoorden. Echte providerverbinding, callback/webhook, terugkerend mandaat, licentietest en RTDN moeten daarna via de afzonderlijke beheerproeven en deploymentprocedure worden bevestigd. De applicatie houdt onbewezen providerpoorten dicht.

Geteste SQL-bron: `supabase/migrations/20261123115349_billing_entitlements_campaigns_coupons_provider_queue.sql`.
SHA-256: `ab5a86867e737741cd3d679e9bd6d9b7cef6c340a33432a81452494da37a9c22`.


Aanvullende migratie: `20261123123231_billing_play_sandbox_readiness_proof.sql`.
SHA-256: `9efde7e9be163e74c1441c6f16c37e3dd50f4d530cbbdf71e7248ff0f512ca47`.
De zeven aanvullende Play-databasechecks bewijzen authenticatie/grants, actuele beheerderbinding, product/bedrag/ownercontrole, afwijzing van echte livebetalingen op het sandboxbewijs-pad, idempotentie, ontbrekende RTDN-readiness en het uitblijven van commerciële/entitlement-records. Een prijswijziging maakt een nieuwe onbewezen credential-kandidaat en bewaart de oude sleutel voor bestaande verplichtingen. Directe gedeeltelijke Play-coupons worden geweigerd; een volledige cadeaucode van drie maanden blijft ook bij jaarselectie kosteloos en zonder betaalmandaat.
