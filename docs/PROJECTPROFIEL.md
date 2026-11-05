# Fabelpad — projectprofiel

Bijgewerkt: 5 november 2026. Opdrachtscope: **lokaal bouwen**, de broncode naar `main` van `fabelpad/platform` pushen en de repository aan deze checkout koppelen. Overige infrastructuurgegevens volgen. De ruimere staging-/publicatieopdracht in het aangeleverde document is geen opdracht om nu externe accounts aan te maken of omgevingen uit te rollen.

## Vastgesteld uit bron en lokale omgeving

| Onderdeel | Vastgesteld |
| --- | --- |
| Productnaam in bronpakket | Fabelpad; de gebruikersvraag schrijft ook Favelpad |
| Aangeleverd pakket | `Fabelpad-Codex-Prototype-2026-11-04.zip` |
| Oorspronkelijke pakketcommit | `97c3881d6bd94f41596ce77fb7a53d55936c6397` (pakketmetadata; geen lokale upstreamhistorie) |
| Lokale importcommit | `a7475c4573d3f125be337eb315c574945c64352c` |
| Repository / remote | [`fabelpad/platform`](https://github.com/fabelpad/platform) / `origin=https://github.com/fabelpad/platform.git` |
| Branch / upstream | `main` / `origin/main` |
| Werkcheckout | `/home/codex/repos/fabelpad` |
| Lokale host / gebruiker | `codex-worker-01` / `codex`; nog niet als DG-deployhost aangewezen |
| Webtoolchain | Node `24.18.0` (`.nvmrc`), pnpm `11.25.0` (`packageManager`), `pnpm-lock.yaml` |
| Webruntime | Native Next.js `16.3.4`, React/React DOM `19.2.6`; `next build` / `next start` op loopback |
| Publieke configuratie | Alleen `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Serverconfiguratie | `APP_URL`, `FABELPAD_DEPLOY_ENV`, `FABELPAD_RELEASE_SHA`, `FABELPAD_AUTH_EMAIL_ENABLED`, `FABELPAD_AUTH_GOOGLE_ENABLED` |
| Web serverkeys | Huidige webimplementatie vereist geen Supabase service-role key; gebruikerssessie en RLS/RPC begrenzen toegang |
| Broncontent | Dertien verhalen; gecontroleerd: 403 scènes, 416 eindroutes, vijftien gekoppelde assets |
| Native project | `mobile/`; eigen `package-lock.json` en Expo/React Native-toolchain, geen WebView |
| Demo Android-ID | `nl.dgwebservices.fabelpad.demo`; lokale testidentiteit, geen geregistreerde Play-identiteit |
| Native productie-ID | Expliciet verplicht via `FABELPAD_ANDROID_PACKAGE` bij productievariant; definitieve waarde ontbreekt |
| Release-identiteit | `FABELPAD_RELEASE_SHA` bevat bij een release de volledige checkout-SHA; lokale werkboomwijzigingen zijn geen gepubliceerde release |

De Android-demo is gebouwd op schone broncommit `045c863997b6c8aca57cd118b1723b2cbfb7997f`; de GitHub-koppeling wijzigt alleen documentatie en voegt de bestaande GitHub-historie samen. De uiteindelijk geteste commit, uitvoer en artefacten staan in [LOKALE-VALIDATIE.md](LOKALE-VALIDATIE.md). De importcommit is geen claim dat alle latere wijzigingen op die SHA zijn getest.

## Omgevingen en ontbrekende gegevens

| Gegeven | Lokaal | Staging | Productie |
| --- | --- | --- | --- |
| GitHub owner/repository en remote | `fabelpad/platform`; `origin` gekoppeld | Dezelfde repository | Dezelfde repository |
| GitHub environment | Niet nodig | `staging`, nog aan te maken/in te richten | `production`, nog aan te maken/in te richten |
| URL | Standaard `http://localhost:3000` (loopback) | Ontbreekt | Ontbreekt |
| Site-ID | Niet nodig | Ontbreekt | Ontbreekt |
| Deployhost / Linux-gebruiker | Geen deployhost aangewezen | Ontbreekt | Ontbreekt |
| Runnernaam / exacte labels | CI gebruikt `ubuntu-24.04` voor verificatie | Ontbreken; self-hosted doelrunner vereist | Ontbreken; self-hosted doelrunner vereist |
| Checkout / release- / shared-pad | Werkcheckout hierboven | Ontbreken | Ontbreken |
| Interne app-poort / Caddy-configuratie | Standaard 3000; definitieve lokale poort in validatie | Ontbreken | Ontbreken |
| Supabase projectref / regio | Geen project gekoppeld | Ontbreken | Ontbreken; apart project |
| Auth-/Google-callbacks | Te configureren na projectkoppeling | Exacte origins/deeplinks ontbreken | Exacte origins/deeplinks ontbreken |
| Mailgateway / worker / outbox | Bestaand DG-contract nog niet aangeleverd | URL, contract, secrets en ontvangerbeleid ontbreken | Idem, afzonderlijke configuratie |
| `dg-site-deploy` | Niet gevonden in lokale `PATH` | Versie en interface nog te verifiëren | Versie en interface nog te verifiëren |
| Health / activering / rollback | Lokale healthcontrole is geen releaseacceptatie | Contract en rollbackpad ontbreken | Contract en rollbackpad ontbreken |
| Build-lock / bewaarbeleid | Checkoutlock via `scripts/local-build.sh` | Bestaand hostbreed lock en retentie nog te bepalen | Idem |
| Versleutelde backup / herstelbewijs | Geen externe database gekoppeld | Pad, encryptie, sleutelbeheer en hersteltest ontbreken | Idem |
| Android signing / artefactbewaring | Standalone arm64 demo-APK gebouwd; debugondertekening; zie mobile/VALIDATIE.md | Testidentiteit, toestel en bewaarpad bevestigen | Package-ID, uploadkey en Play App Signing ontbreken |

Er zijn geen projectwaarden van andere aanwezige repositories overgenomen. Een `dg-site-deploy`-voorbeeld uit een ander project bevestigt de werkwijze, maar bewijst geen Fabelpad-siteconfiguratie, wrapperversie of toestemming.

## Configuratie- en releasegrenzen

`pnpm check:config` staat standaard een lokale demo zonder accounts toe. `--target=staging` en `--target=production` vereisen de canonieke app-origin, beide publieke Supabase-waarden en de volledige release-SHA. Deze controle valideert namen en vorm; ze bewijst geen login, mail, RLS, deployment of aankoop.

NEXT_PUBLIC-waarden horen bij de **build**. Staging en productie bouwen dezelfde bron-SHA afzonderlijk met eigen waarden. De uitvoer is daarmee niet noodzakelijk byte-identiek. Backendmigraties, Edge Functions en mailcontracten moeten compatibel blijven met de actieve webrelease en de huidige/vorige ondersteunde mobiele app.

De oude [overdracht](FABELPAD-CODEX-OVERDRACHT.md) beschrijft het prototype en bevat verouderde Docker-/SMTP-voorstellen. Voor het huidige werk gelden native Next.js via de bestaande DG-wrapper en Caddy, plus de bestaande gesigneerde Supabase-mailgateway/outbox. [INRICHTING.md](INRICHTING.md) beschrijft wat nog nodig is.
