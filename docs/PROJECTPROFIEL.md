# Fabelpad — projectprofiel

Bijgewerkt: **22 november 2026**. De eigenaar autoriseert inrichting van **beide Fabelpad-omgevingen en beide bijbehorende Supabase-projecten**. Andere projecten op de VPS of in verbonden accounts vallen buiten die toestemming.

| Onderdeel | Vastgesteld / bron |
| --- | --- |
| Product | Fabelpad; webplatform en afzonderlijke lokale native Android-app |
| Repository / integratiebranch | [fabelpad/platform](https://github.com/fabelpad/platform), `main`; Git-remote en bestaande CI |
| Werkbranch | `codex/legal-google-release-20261122`; voortzetting via bestaande PR 3, inclusief de VPS-voorbereiding |
| Werkcheckout | `/home/codex/repos/fabelpad` |
| Toolchain | Node `24.18.0`, pnpm `11.25.0`, `pnpm-lock.yaml`; Next `16.3.4`, React `19.2.6` |
| Installatie / build / start | `pnpm install --frozen-lockfile` / `pnpm build` / `pnpm start --port <poort>`; loopbackbinding |
| Buildoutput | `.next/server`, `.next/static`, `public`, packagebestanden en `node_modules`; geen standalone-uitvoer |
| Verplichte doel-CI | `verify.yml` / `verify` én `fabelpad-android-ci.yml` / `Native Android-controles`, succesvolle main-push op dezelfde SHA |
| Broncontent | 13 onveranderlijke verhalen, 403 scènes, 416 eindroutes; gedeelde contenthashes met native |
| Doelhost | `dg-vps-08`, machine-id `05db94b99eca4c3d815f6585ef8ed517`; geverifieerde SSH-hostsleutel |

## Twee omgevingen

De accountnamen komen van de eigenaar. Projectnamen/refs en GitHub-variabelen zijn via de verbonden bronnen gecontroleerd.

| | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Weborigin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Supabase-workspaceverbinding | account **fabelpad** | account **Duindorpdoet** |
| Supabase-project | `fabelpad-staging` | `fabelpad-production` |
| Projectref | `tlwfpivafcokcjyjwgmq` | `aptprpkosqctwrzeetgs` |
| Regio | `eu-west-1` | `eu-west-1` |
| VPS-doelidentiteit | `fabelpad-vps08-staging` | `fabelpad-vps08-production` |
| Loopbackpoort | `4188` | `4189` |

Beide GitHub environments bestaan met exact de vier afgesproken variabelen. De datamodus is in beide `supabase`. Publieke keys worden niet in documentatie gekopieerd. Elke omgeving gebruikt het eigen project.

## Authenticatie en mail

De webapp gebruikt Supabase e-mail-OTP van zes cijfers en Google-login voor ouderaccounts. Beide providers zijn in beide projecten ingeschakeld. De eerste beheerder is **info@dgwebservices.nl**, uitsluitend nadat Supabase het bezit van dat adres heeft bevestigd en de ouderonboarding is afgerond. Beheerrechten komen uit de database, nooit uit clientmetadata of een lokaal demoaccount.

De bevestigde Auth-mailroute is **Supabase Auth → Custom SMTP → Resend**. Deze release behoudt die configuratie en activeert geen Send Email Hook. Auth- en applicatieserviceberichten hebben `lib/email/` als gedeelde opmaakbron. De 13 Auth-templates per omgeving moeten bij SMTP in Supabase Authentication → Email Templates staan; wijzigingen kunnen vanuit de template-editor als HTML worden overgenomen. De afzonderlijke applicatieservicemails gebruiken de Resend API met hun eigen Vault-koppeling.

**Beheer → E-mail** beheert de Resend API-key in de eigen Supabase Vault, afzender, antwoordadressen en gezamenlijke voettekst. **Beheer → E-mailtemplates** bevat alle 17 templates met bewerkbaar onderwerp, kop en introductie. Iedere opslag vereist een geaccepteerde test naar de bevestigde beheerder. Vault wordt leidend voor de applicatieservicemails; Supabase SMTP blijft afzonderlijk geconfigureerd. Zie [EMAIL-BEHEER.md](EMAIL-BEHEER.md).

Zie [inrichting](INRICHTING.md), [templates](EMAIL-TEMPLATES.md), [mailconfiguratie](EMAIL-CONFIGURATIE.md) en [actuele acceptatie](STAGING-PRODUCTION-STATUS.md). Een functie zonder secrets bewijst geen werkende OTP of mailbezorging.

## Release en native

Zes handmatige workflows bouwen, activeren of herstellen elk één doel. Kandidaatbouw activeert niets en voert geen migraties uit. De route controleert exacte main-SHA, CI, eigen runner en omgeving; OTP vereist een eigen root-owned readinessontvangst. Zie [hostrunbook](DG-VPS-08-TWEE-OMGEVINGEN.md).

Android `nl.fabelpad.app` blijft een gratis lokale leesapp zonder accounts, synchronisatie, advertenties of abonnementen. Versie `1.0.0` / code `1` is afzonderlijk gesigneerd uit commit `8dcb98c4287dc78421b092ee395ace05f492baaa`. Deze webwijzigingen voegen geen native cloudlogin toe. Zie [Play-runbook](GOOGLE-PLAY-RELEASE-RUNBOOK.md) en [bouwbewijs](ANDROID-PRODUCTIE-VALIDATIE.md).

Documenten van 20 november over uitsluitend staging, ontbrekende projectrefs en nog niet geautoriseerde migraties beschrijven de eerdere opdracht. Voor deze twee doelen geldt de vervolgautorisatie en mapping van 22 november.
