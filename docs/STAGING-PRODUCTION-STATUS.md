# Fabelpad — status staging en production

Controledatum: **22 november 2026**. De eigenaar autoriseert inrichting van beide Fabelpad-omgevingen en beide Supabase-accounts. Deze lijst geeft uitgevoerde controles weer; ze is geen verklaring dat de publieke dienst al werkt.

## Uitgevoerd

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment + exact vier afgesproken variabelen | Gecontroleerd | Gecontroleerd |
| Supabase-account/project | **fabelpad** / `tlwfpivafcokcjyjwgmq` | **Duindorpdoet** / `aptprpkosqctwrzeetgs` |
| Twee schemawijzigingen + overeenkomende migratiehistorie | Toegepast en geverifieerd | Toegepast en geverifieerd |
| Immutable broncontent | 13 verhalen | 13 verhalen |
| RLS op vier tabellen | Aan | Aan |
| Publieke catalogus / afgeschermde tabellen | HTTP200 / HTTP401 | HTTP200 / HTTP401 |
| Supabase security advisors | 0 meldingen | 0 meldingen |
| Beheerderbootstrap voor aangewezen mailbox | Bevestigd adres vereist; trigger gereed | Bevestigd adres vereist; trigger gereed |
| Auth-gebruikers / actieve beheerders | 0 / 0 | 0 / 0 |
| Auth-mailfunctie | `auth-email` v1 deployed | `auth-email` v1 deployed |
| Ongeconfigureerde hook weigert mail | HTTP503, geen verzending | HTTP503, geen verzending |
| HTML-exports | 13 templates met TEST-label | 13 productie-templates |
| VPS-inrichting | Eigen rollen/paden, poort4188 | Eigen rollen/paden, poort4189 |
| App- en runnerdiensten | Disabled/inactive, runner ongeregistreerd | Disabled/inactive, runner ongeregistreerd |
| Kandidaat / actieve release | Geen | Geen |

De database had vooraf geen applicatietabellen of gebruikers. Migraties en content zijn toegevoegd zonder bestaande gebruikersdata te wijzigen. De oorspronkelijke platformhelper is behouden, met onnodige publieke uitvoerrechten ingetrokken.

De domeinen `fabelpad.nl` en `staging.fabelpad.nl` wijzen bij controle naar `204.168.128.28`; dat adres is ook op eth0 van de geverifieerde VPS vastgesteld. Er is geen nieuwe DNS of publieke app-/HTTPS-route geactiveerd.

## Nog te voltooien, in volgorde

| Stap | Wat klaarstaat | Wat concreet ontbreekt |
| --- | --- | --- |
| 1. Afzender/Resend | API-transport, gedeelde vormgeving, domein-/trackingcontrole in configuratietool | Afgeschermde API-key en geverifieerd Fabelpad-verzenddomein; DNS-toegang als verificatie ontbreekt |
| 2. Auth en Edge secrets | Deployed hook, veilige configuratietool, 26 HTML-bestanden | Supabase-beheertoegang per bedoelde account voor Auth/secrets; connector biedt deze API's niet |
| 3. Echte aanmelding | OTP-UI, sessiecontrole, veilige links en rolbootstrap | OTP-bezorging en login van info@dgwebservices.nl in elk project; account is nu nog niet aangemaakt |
| 4. Readinessbewijs | Exact eigen origin/project/omgeving wordt afgedwongen; zelfstandige OTP-proef vóór eerste build | Werkelijke configuratie-/bezorg-/OTP-/rolcontrole; daarna root-owned ontvangst. Gezins-/studioflow na kandidaatbouw |
| 5. Doelrunner | Twee binaries, accounts, units en beperkte sudo | Organisatiebeheer voor beperkte runnergroep; huidige API mist admin:org / geeft403 |
| 6. Main-CI en kandidaten | Zes handmatige workflows en hostadapters | Vrijgegeven main-SHA, vereiste geslaagde CI, online beperkte runner; echte doelbuild nog niet gedaan |
| 7. Publieke dienst | Eigen systemd en inactieve Caddyconfiguratie | Gezonde kandidaat, afzonderlijke activering, Caddy/TLS en publieke kernflowacceptatie |

Keys/tokens niet in chat sturen. Gebruik een afgeschermd secretpad of voer de tool uit in een eigen terminal zoals beschreven in [EMAIL-CONFIGURATIE.md](EMAIL-CONFIGURATIE.md). Deze toegangsvraag staat bij de eigenaar open; er wordt geen ontbrekende secret als ingevuld behandeld.

## Instructies en bewijs

- [Schone lokale builds en9 geslaagde browsertests](VALIDATIE-OTP-TWEE-OMGEVINGEN-2026-11-22.md): volledige normale buildroute en afzonderlijke staging-/productionconfiguratiebuilds uit commit `070a039e1de4c39fac12d79d293104a0e89c8f00` geslaagd. Dit zijn lokale builds, geen doelkandidaten of mailacceptatie.
- [Gegevensbronnen en vier GitHub-variabelen](INRICHTING.md)
- [Mailconfiguratie per account, verborgen terminalinvoer](EMAIL-CONFIGURATIE.md)
- [HTML-templates en Supabase-schermvolgorde](EMAIL-TEMPLATES.md)
- [Kandidaatbouw, activering en herstel op de VPS](DG-VPS-08-TWEE-OMGEVINGEN.md)
- [Supabase-controles](deploy-evidence/supabase-2026-11-22.json) en [hostcontroles](deploy-evidence/dg-vps-08-2026-11-22.json)

Er zijn geen echte mails verzonden, geen account als bevestigd voorgewend en geen doelkandidaat of publieke app geactiveerd. De lokale native Android-productie-app blijft een afzonderlijk product zonder cloudaccounts.
