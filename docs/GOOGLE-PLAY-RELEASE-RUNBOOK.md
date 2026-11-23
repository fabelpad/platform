# Fabelpad — ondertekende Android-build en Google Play-releases

Actuele procedure: **23 november 2026**. Geldt uitsluitend voor repository **`fabelpad/platform`**, integratiebranch **`main`**, pakket **`nl.fabelpad.app`**, telefoon en tablet. GitHub Actions bouwt en signeert; de Google Play Android Publisher API verzorgt upload en promotie; Google beoordeelt en distribueert de app. Dit is geen Cloud Build- of permanente JSON-sleutelroute.

Het volledige scherminvulblad staat in [GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md). Feitelijke OAuth-proeven, run-ID's, GitHub-bescherming en resterende blokkades staan in de [actuele verbindingsevidence](deploy-evidence/play-cloud-connection-2026-11-23.json). Een bevestigde Cloud-configuratie of Play-uitnodiging bewijst op zichzelf geen geslaagde tokenuitwisseling, uploadbevoegdheid, release of beschikbaarheid.

## 1. Huidige status en te uploaden bestand

De gecontroleerde, ondertekende bundel is **Fabelpad 1.0.1 (2)**, gebouwd uit schone appcommit **`228d951ac0db0bac03c7a74c9d67a8c547b005fa`**. Zie het [bouw- en uploadverslag](ANDROID-PRODUCTIE-1.0.1.md).

| Onderdeel | Bevestigde toestand / vervolg |
| --- | --- |
| Downloadbare AAB | `/home/codex/fabelpad-productie-1.0.1-2026-11-23/fabelpad-1.0.1-2-production.aab`; 38.917.985 bytes; SHA-256 `6e32d9faed68febb783e9a0c2a0a2683cd418858fbc7af3e78ca539bea9de746`. |
| Canonieke lokale output | `artifacts/native/fabelpad-production.aab`, rapport `fabelpad-production.json`, R8-mapping `fabelpad-production-mapping.txt`. De downloadbare kopie heeft dezelfde bytes. |
| Signing | Eigen Fabelpad-uploadsleutel, gescheiden van Googles latere app-signingsleutel. Geen private sleutel in Git, artefacten, chat of logregels. |
| Publieke website / privacy | `https://fabelpad.nl` en `https://fabelpad.nl/privacy` zijn publiek geactiveerd en gecontroleerd; zie [live-acceptatie](PRODUCTIE-LIVE-2026-11-23.md). |
| Google Cloud | Project en beide beperkte WIF-identiteiten door de gebruiker ingericht en uitgelezen; details in §2. |
| GitHub | Beide Play-environments aangemaakt en eigen signing-/WIF-secrets geplaatst; main en releasetags beschermd; details in §3. |
| Play-apprechten | Eigenaar bevestigt appgebonden test-/productierechten. Beide echte WIF-proeven en Play-leestoegang zijn geslaagd (HTTP 200); release-schrijfrechten zijn nog niet getest. |
| Signing / publicatie | Handmatige signing zonder upload is vrijgegeven: `signingEnabled=true`. Play-publicatie blijft uit: `playEnabled=false`. De afzonderlijke verbindings- en statuscontrole kunnen geen release starten. |
| Eerste interne en productierelease | De eigenaar bevestigde een bestaande AAB-upload en nog geen productierelease. Controleer versiecode, bundelhash en trackstatus met de hieronder beschreven `status`-actie. |
| Toestelacceptatie / Store-assets | Echte telefoon-/tablet- en offline-voorleestests, externe Store-beelden en eventuele account-/testtaken afzonderlijk afronden. Een geslaagde build vervangt die niet. |

Upload de **AAB**, niet de APK, JSON, PEM of ZIP, onder **Testen en releasen → Testen → Intern testen → Nieuwe release maken**. Controleer eerst dat versiecode **2** nog niet door een andere bundel is gebruikt. Kies bij de eerste Play App Signing-inrichting dat **Google de app-signingsleutel genereert en beheert**. De AAB is al met de uploadsleutel ondertekend; daarvoor is geen PEPK-export nodig. Het openbare `fabelpad-upload-certificate.pem` is alleen voor een expliciet gevraagd uploadcertificaat of een sleutelreset. [Android signing, gecontroleerd 23-11-2026](https://developer.android.com/studio/publish/app-signing)

Het SHA-256-vingerafdruk van het openbare **uploadcertificaat** is:

```text
35:98:B0:E2:D3:D6:D7:D5:12:71:10:97:03:52:73:3E:79:E3:F1:22:F1:BB:60:16:17:04:AF:2E:42:18:87:DE
```

Bewaar de eigen uploadkeystore en het wachtwoord in de bestaande gescheiden afgeschermde opslag en behoud de gecontroleerde herstelkopie. Deel ze niet als uploadbestand. Noteer na de eerste upload Googles echte app-signingcertificaat onder **App-integriteit → App-ondertekening**; dit is een ander certificaat. Gebruik nooit sleutels van DartFlow of een ander project.

## 2. Bestaande Google Cloud-inrichting behouden

De gebruiker heeft op **23-11-2026 10:33:14 UTC** de uitvoer van hervatscript v2 aangeleverd. Die bevestigt readback van onderstaande resources en meldt `serviceAccountKeysCreated=false`. Voer oude `gcloud ... create`-blokken niet opnieuw uit en maak geen tweede project of permanente JSON-sleutel.

| Vastgelegd gegeven | Waarde |
| --- | --- |
| Project-ID / nummer | `fabelpad` / `471984799009` |
| Repository / immutable ID | `fabelpad/platform` / `1446419952` |
| Eigenaar-ID | `352706055` |
| Intern serviceaccount | `fabelpad-play-internal@fabelpad.iam.gserviceaccount.com` |
| Interne provider | `projects/471984799009/locations/global/workloadIdentityPools/fabelpad-play-internal/providers/github` |
| Productieserviceaccount | `fabelpad-play-production@fabelpad.iam.gserviceaccount.com` |
| Productieprovider | `projects/471984799009/locations/global/workloadIdentityPools/fabelpad-play-production/providers/github` |

De GitHub OIDC-subjecten bevatten de immutable eigenaar-/repository-ID's en het eigen environment:

```text
repo:fabelpad@352706055/platform@1446419952:environment:fabelpad-play-internal
repo:fabelpad@352706055/platform@1446419952:environment:fabelpad-play-production
```

De interne identiteit hoort uitsluitend bij `.github/workflows/fabelpad-android-ci.yml`, een **push op main** en environment `fabelpad-play-internal`. De productie-identiteit hoort bij `.github/workflows/fabelpad-play-production.yml`, een beschermde `fabelpad-v*`-tagpush of een toegestane handmatige main-actie, en environment `fabelpad-play-production`. Andere repositories, forks, PR's, workflows en environments krijgen hiermee geen deploytoegang.

De serviceaccounts horen uitsluitend appgebonden Play-rechten voor **Fabelpad — `nl.fabelpad.app`** te hebben: intern lezen en testreleases, productie lezen en productiereleases. De eigenaar heeft dit bevestigd. Geef geen projectbrede Owner-/Editorrol, financiële rechten of accountbeheer als oplossing voor een mislukte proef. Een alleen-lezen proef kan niet alle schrijfrechten aantonen.

De API vereist geen nieuwe koppeling van het gehele Play-ontwikkelaarsaccount aan een Cloud-project. De bestaande API/serviceaccount-inrichting is het uitgangspunt. [Publisher API-inrichting](https://developers.google.com/android-publisher/getting_started), [GitHub WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), gecontroleerd 23-11-2026.

## 3. GitHub-environments, secrets en publieke configuratie

De twee nieuwe release-environments zijn gescheiden van de bestaande webomgevingen `staging` en `production`.

| Environment | Geplaatste secret-namen |
| --- | --- |
| `fabelpad-play-internal` | `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`, `PLAY_WIF_PROVIDER`, `PLAY_SERVICE_ACCOUNT` |
| `fabelpad-play-production` | `PLAY_WIF_PROVIDER`, `PLAY_SERVICE_ACCOUNT` |

De WIF-provider- en serviceaccountnamen zijn openbare configuratie, maar staan volgens deze projectafspraak als environmentsecrets. De productiejob krijgt geen uploadkeystore. Waarden worden niet in documentatie of logs vastgelegd. Het bestaan van namen kan veilig worden gecontroleerd met:

```bash
gh secret list --repo fabelpad/platform --env fabelpad-play-internal
gh secret list --repo fabelpad/platform --env fabelpad-play-production
```

Er komen **geen extra GitHub-variabelen** voor Android/Play. De vier overeengekomen webvariabelen blijven in zowel `staging` als `production`: `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`.

Niet-geheime Android/Play-instellingen staan ter review in [`scripts/play/config.json`](../scripts/play/config.json):

```json
{
  "schemaVersion": 1,
  "signingEnabled": true,
  "playEnabled": false,
  "connectionCheckEnabled": true,
  "versionCodeBase": 1000,
  "internalTracks": [],
  "productionTracks": [],
  "rolloutFraction": 1
}
```

`versionCodeBase=1000` is voorlopig en niet als vrije reeks bevestigd. De werkelijke CI-code wordt `versionCodeBase + GITHUB_RUN_NUMBER`; deze moet hoger zijn dan alle gebruikte codes en maximaal 2.100.000.000. De lege tracks mogen niet door aannames worden gevuld: bevestig de interne ID (`internal` of `qa`) en `production` via Play. De validator weigert publicatie zonder expliciete signingvrijgave en beide geldige tracks.

Controleer lokaal zonder Google-toegang:

```bash
python3 -B -m unittest discover -s scripts/play -p 'test_*.py'
FABELPAD_CONFIG_OUTPUT="$(mktemp)"
python3 -B scripts/play/read_config.py --config scripts/play/config.json \
  --github-output "$FABELPAD_CONFIG_OUTPUT"
cat "$FABELPAD_CONFIG_OUTPUT"
rm -f -- "$FABELPAD_CONFIG_OUTPUT"
```

De output bevat alleen publieke instellingen. Main vereist een PR en de geslaagde GitHub Actions-controles `verify` en `Native Android-controles`, met de actuele mainstand getest en zonder bypass. Forcepush en verwijderen zijn geblokkeerd. Alleen repositorybeheerders kunnen nieuwe `fabelpad-v*`-tags maken; verplaatsen/verwijderen is voor iedereen geblokkeerd. De drie rulesets zijn uitgelezen en staan in de evidence. De productiejob weigert ook zelf een onbeschermde releasetag.

## 4. Alleen de verbinding controleren

De onafhankelijke `connection`-jobs maken geen Play-edit, uploaden geen bundel, wijzigen geen tracks en activeren niets. Ze controleren de exacte repository/workflowcontext en de werkelijk uitgegeven kortlevende tokenidentiteit, scopes en vervaltijd. Alleen voor deze proef zijn de scopes `androidpublisher` en `userinfo.email` nodig. De enige Play-aanvraag is `GET reviews.list?maxResults=1`; de antwoordinhoud wordt niet gelezen of opgeslagen.

**Intern:** de proef draait bij de eerstvolgende gecontroleerde main-push zolang `connectionCheckEnabled=true`; een PR of handmatige signingrun kan deze interne WIF-route niet gebruiken. Inspecteer de betreffende run van **Fabelpad Android CI**, job **Controleer interne Google Play-verbinding zonder wijzigingen**, en artefact `fabelpad-play-internal-connection`.

**Productie:** voer uitsluitend de nieuwe handmatige alleen-lezen actie uit:

```bash
gh workflow run fabelpad-play-production.yml \
  --repo fabelpad/platform --ref main -f action=verify
gh run list --repo fabelpad/platform \
  --workflow fabelpad-play-production.yml --branch main --limit 5
```

Gebruik de werkelijke run-ID om status en openbaar bewijs op te halen:

```bash
gh run view WERKELIJKE_RUN_ID --repo fabelpad/platform
gh run download WERKELIJKE_RUN_ID --repo fabelpad/platform \
  --name fabelpad-play-production-connection --dir /tmp/fabelpad-play-production-connection
```

Een rapport met `oidcExchangeVerified=true` bevestigt de tokenuitwisseling. `playReadAccessVerified=true` bevestigt alleen-lezen toegang. HTTP 403/404 blijft expliciet een open Play-appregistratie-/rechtentaak, ook wanneer de workflow slaagt doordat de Cloud-identiteit wel klopt. `playReleasePermissionsVerified=false` en `playPublicationPerformed=false` blijven bij deze proef correct. Werkelijk geslaagd op commit `6d4ac925086026d7f05d81385afcffe1d4237949`: [interne proef 45159353606](https://github.com/fabelpad/platform/actions/runs/45159353606) en [productieproef 45159365178](https://github.com/fabelpad/platform/actions/runs/45159365178). Beide geven HTTP 200 voor Play-leestoegang. Google retourneert naast de twee URI-scopes de equivalente alias `email`; uitsluitend die redundante alias wordt genormaliseerd. Overige extra scopes blijven geweigerd.

Zet na de eenmalige verificatie `connectionCheckEnabled=false` via een gereviewde configuratiecommit als herhaalde diagnostiek niet nodig is. Signing en publicatie veranderen daardoor niet.

### Werkelijke tracks en geüploade bundels controleren

Gebruik de afzonderlijke statusactie om de reeds geüploade AAB te controleren:

```bash
gh workflow run fabelpad-play-production.yml \
  --repo fabelpad/platform --ref main -f action=status
```

Deze actie gebruikt dezelfde beperkte productie-identiteit en OAuth-scope `androidpublisher`. Ze maakt een tijdelijke Play-edit, leest tracks en bundels en verwijdert de edit zonder validatie of commit. Daarna leest ze per track de [release-lifecycle](https://developers.google.com/android-publisher/api-ref/rest/v3/applications.tracks.releases/list), die concept, beoordeling en publicatie onderscheidt. Bij HTTP 403/404 blijft die lifecycle expliciet onbekend. Uploaden, trackwijzigingen en publicatie zijn uitgesloten; een mislukte verwijdering laat de job falen. Het artefact `fabelpad-play-production-status` bevat alleen release-identificatie en bundelhashes, zonder tokens of reviews. Een geslaagde statusjob alleen bewijst geen Store-goedkeuring; gebruik de gerapporteerde lifecycle. Een toesteltest blijft afzonderlijk.

Vergelijk de bij versiecode **2** gerapporteerde `sha256` met **`6e32d9faed68febb783e9a0c2a0a2683cd418858fbc7af3e78ca539bea9de746`**. Bij gelijkheid is de upload exact de aangeleverde ondertekende 1.0.1-bundel uit appcommit `228d951`. Een nieuwe signingbuild of herupload is voor die controle niet nodig. Gebruik de gevonden trackstatus voor de vervolgstap; een bestaande draft mag niet door de automatische releasehelper worden vervangen.

## 5. Eerste interne en productierelease in Play Console

Deze handelingen zijn nog niet als uitgevoerd bevestigd. Een Cloud-koppeling vult Store- of beleidsformulieren niet in.

1. Open het bestaande DG Webservices-account in [Play Console](https://play.google.com/console/). Controleer accounttype, aanmaakdatum, identiteits-/contactstatus, Android-ontwikkelaarsverificatie, pakketregistratie en toepasselijke handelaarsstatus volgens het [invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md).
2. Gebruik de bestaande app **Fabelpad**, of maak haar eenmaal aan als **App**, **Gratis**, standaardtaal **Nederlands (Nederland)**, support **support@fabelpad.nl**. De eerste upload moet pakket **nl.fabelpad.app** tonen. Stop bij een andere pakketnaam.
3. Vul Store-vermelding, landen, doelgroep/IARC, App-content en Gegevensveiligheid in met het actuele invulblad. Upload de extern gemaakte appicoon-, functieafbeelding- en echte telefoon-/8-inch-/10-inchbeelden in de passende Console-velden. Controleer de publieke privacy-URL en alle ouderlinks ook op het echte toestel.
4. Maak een interne testrelease met de bestaande **1.0.1 (2)**-AAB als code 2 nog vrij is. Gebruik de bijgeleverde releaseopmerkingen. Rond Play App Signing af met door Google beheerde app-signingsleutel, controleer alle waarschuwingen en volg de aangeboden Console-stappen voor de interne release.
5. Laat de eigenaar testers en opt-in-link beheren. Installeer via Play en test met synthetische profielen: geldige/ongeldige geboortedatum, automatisch niveau, ouderoverride, profielwissel, routehervatten, alle hoofdstukken/keuzes/aandenken, offline voorlezen, ontbrekende offline stem, lokale verwijdering en ouderlinks. Leg echte toestel- en pre-launch-resultaten vast.
6. Controleer productietoegang. Voor persoonlijke accounts van na **13-11-2023** gelden minimaal **12 gesloten testers die 14 dagen onafgebroken zijn aangemeld**, gevolgd door een productieaanvraag. Een interne test vervangt dit niet. Voor dit account zijn toepasselijkheid en echte teststatus nog te bevestigen. [Google Help, gecontroleerd 23-11-2026](https://support.google.com/googleplay/android-developer/answer/14151465?hl=nl)
7. Maak de **eerste productierelease** in de Console uit exact de geteste bundel. Controleer landen, Store-preview, alle beleids-/accounttaken en stuur de werkelijke wijzigingen ter beoordeling. Een concept of API-status is geen openbare beschikbaarheid. Controleer de release na publicatie in de Store en op toestel.

Onze releasehelper heeft bewust een **eerste-productieblokkade**: `plan_production` vereist een bestaande `completed`-release op de productietrack. Hij maakt de eerste productierelease niet via de API en omzeilt geen Console-testgate of beleidsformulier. Een signing-only build en een interne upload zijn op zichzelf ook geen toestemming voor productie.

Als goedgekeurde latere updates vanzelf beschikbaar moeten worden, controleer onder **Publicatieoverzicht → Status van beheerd publiceren** dat beheerd publiceren uit staat, zodra die instelling beschikbaar is. De eerste publicatie heeft eigen beschikbare stappen. Google kan steeds beoordeling of aanvullende actie verlangen. [Publicatiemoment, gecontroleerd 23-11-2026](https://support.google.com/googleplay/android-developer/answer/9859654?hl=nl)

## 6. Alleen een nieuwe gesigneerde AAB bouwen

Handmatige signing is vrijgegeven. Deze stap bouwt een nieuwe ondertekende AAB en uploadt niets. Controleer de actuele versiecodes met `action=status`, houd `playEnabled=false` en gebruik de vastgelegde versiecodebasis. Start vanaf de gecontroleerde mainstand:

```bash
gh workflow run fabelpad-android-ci.yml \
  --repo fabelpad/platform --ref main -f signed_bundle=true
gh run list --repo fabelpad/platform \
  --workflow fabelpad-android-ci.yml --branch main --limit 5
```

De originele project-CI moet op exact die main-SHA slagen. De job bouwt met de bestaande uploadsleutel, controleert de exacte bron, versie, bundelbytes, handtekening en 16 KB-voorwaarden en bewaart `fabelpad-signed-aab` met AAB, rapport en R8-mapping. Bij herstart van dezelfde run wordt precies hetzelfde artefact hersteld, ook de mapping; er wordt geen andere bundel onder dezelfde code gebouwd.

```bash
gh run view WERKELIJKE_RUN_ID --repo fabelpad/platform
gh run download WERKELIJKE_RUN_ID --repo fabelpad/platform \
  --name fabelpad-signed-aab --dir /tmp/fabelpad-signed-aab
```

Een handmatige signing-only run maakt bewust geen `fabelpad-play-receipt` en kan niet door een productietag worden gepromoveerd.

## 7. Automatische interne updates vrijgeven

Voer dit pas uit nadat beide identiteiten zijn gecontroleerd, Play-apprechten werken, de echte tracks en vrije versiecodereeks zijn bevestigd, de eerste productie gezond is en branch-/tagbescherming aantoonbaar past. Bevestig ook dat iedere geslaagde wijziging aan native buildinputs op main een interne testrelease mag opleveren.

Zet in een gereviewde configuratiecommit `signingEnabled=true`, `playEnabled=true`, de echte `internalTracks` en `productionTracks`, de geverifieerde `versionCodeBase` en gewenste `rolloutFraction`. Bijvoorbeeld alleen als `internal` daadwerkelijk is vastgesteld:

```json
{
  "schemaVersion": 1,
  "signingEnabled": true,
  "playEnabled": true,
  "connectionCheckEnabled": false,
  "versionCodeBase": 1000,
  "internalTracks": ["internal"],
  "productionTracks": ["production"],
  "rolloutFraction": 1
}
```

**Neem de getoonde 1000 uitsluitend over als de codeberekening aantoonbaar vrij is.** Dit is een voorbeeld voor latere vrijgave, niet de huidige toestand. Gebruik geen `gh variable set` voor deze poorten.

De commit die `playEnabled=true` op main zet, wijzigt zelf een native buildinput en kan dus de eerste automatische interne upload starten. Maak die integratie pas als de vrijgave bedoeld is. De workflow detecteert behalve `mobile/` ook gedeelde verhaal-/leesniveau-/geboortedatum-/personalisatiebroncode, afbeeldingen, export-/test-/buildscripts, locks, releaseconfiguratie en workflows. Alleen documentatie veroorzaakt geen automatische upload.

Na geslaagde originele project-CI en native controles bouwt de job de exacte SHA, signeert en uploadt dezelfde AAB intern. Vóór upload controleert de helper de ingebedde R8-mapping tegen het buildrapport en het losse bestand. Google importeert de mapping uit de AAB; er is geen los dubbel uploadverzoek nodig. Daarna bewaart `fabelpad-play-receipt` de commit, package, versiecode, versienaam, AAB-SHA256, track en run-ID. Een bestaand bewijs is vereist voor productiepromotie.

Integreer via een pull request. Push de reviewbranch, maak de PR en wacht op de twee verplichte controles. Alleen een merge van de gecontroleerde inhoud is toegestaan; geen directe main-push of adminbypass. Bijvoorbeeld vanuit de voorbereide releasebranch:

```bash
git push -u origin HEAD
gh pr create --repo fabelpad/platform --base main \
  --title "Fabelpad: gecontroleerde Android-update" --body-file /tmp/fabelpad-release-pr.txt
gh pr checks WERKELIJK_PR_NUMMER --repo fabelpad/platform --watch
gh pr merge WERKELIJK_PR_NUMMER --repo fabelpad/platform --merge \
  --match-head-commit VOLLEDIGE_GECONTROLEERDE_PR_HEAD_SHA
```

Schrijf vooraf een concrete PR-beschrijving in het genoemde tijdelijke bestand. Noteer na merge de **resulterende main-SHA**. Wacht ook op de oorspronkelijke main-push-CI en interne upload voordat een tag wordt gemaakt; PR-CI vervangt dat releasebewijs niet.

```bash
gh run list --repo fabelpad/platform \
  --workflow fabelpad-android-ci.yml --branch main --limit 5
gh run watch WERKELIJKE_INTERNE_RUN_ID --repo fabelpad/platform --exit-status
gh run download WERKELIJKE_INTERNE_RUN_ID --repo fabelpad/platform \
  --name fabelpad-play-receipt --dir /tmp/fabelpad-play-receipt
```

## 8. Een volgende versie naar productie promoveren

1. Laat de appwijziging testen en integreren. Verhoog `mobile/package.json` en lockmetadata naar een nieuwe semantische versie, bijvoorbeeld **1.0.2**, en werk `scripts/play/release-notes.json` bij met maximaal **500 Unicode-tekens per taal**.
2. Laat de originele main-pushruns van `verify.yml` en `fabelpad-android-ci.yml` op precies die SHA slagen. Ontbrekende, lopende, overgeslagen, geannuleerde of mislukte controles worden geweigerd.
3. Controleer de interne Play-release en `fabelpad-play-receipt`; installeer die werkelijke versie via intern testen en leg acceptatie vast. Signing-only bewijs voldoet niet.
4. Maak uitsluitend na de bedoelde productievrijgave de beschermde tag op die volledige geteste SHA. Vul de twee waarden bewust in:

```bash
cd /home/codex/repos/fabelpad
set -euo pipefail
FABELPAD_TESTED_SHA='VUL-DE-VOLLEDIGE-40-TEKENS-SHA-IN'
FABELPAD_VERSION='1.0.2'
[[ "$FABELPAD_TESTED_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$FABELPAD_VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]
git fetch origin main --tags
git merge-base --is-ancestor "$FABELPAD_TESTED_SHA" origin/main
FABELPAD_SOURCE_VERSION="$(git show "$FABELPAD_TESTED_SHA:mobile/package.json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')"
test "$FABELPAD_SOURCE_VERSION" = "$FABELPAD_VERSION"
git tag -a "fabelpad-v$FABELPAD_VERSION" "$FABELPAD_TESTED_SHA" -m "Fabelpad $FABELPAD_VERSION"
git push origin "refs/tags/fabelpad-v$FABELPAD_VERSION"
```

De tagpush is de productietrigger. De productiejob controleert repository, beschermde tag, main-afstamming, gecommitte versie, originele succesvolle CI-runs en het interne bewijs. Hij vergelijkt de bundelhash met Play en promoveert precies de reeds intern geaccepteerde versiecode; er wordt niets opnieuw gebouwd of ondertekend.

Controleer **Actions → Fabelpad Google Play productie**, daarna **Play Console → Publicatieoverzicht** en de productietrack. Met `rolloutFraction=1` en zonder publicatiehold kan een goedgekeurde update naar 100%; Google bepaalt review en beschikbaarheid. Bevestig vervolgens op toestel de echte update, profiel-/voortgangsbehoud en kernflows.

AAB, rapport, mapping en intern releasebewijs worden **90 dagen** als Actions-artefact bewaard. Na het vervallen van het vereiste bewijs stopt tagpromotie. Bouw dan een nieuwe gecontroleerde kandidaat met hogere versiecode en test die intern. Een versiecode hoort bij blijvend dezelfde bundelbytes.

## 9. Gefaseerde uitrol en herstel

Een latere update kan vóór de tag met bijvoorbeeld `rolloutFraction=0.1` in JSON op 10% worden gestart. Voor de eerste publicatie volg je §5. Bestaande uitrol voltooien of stoppen vereist de exacte werkelijke versiecode:

```bash
gh workflow run fabelpad-play-production.yml \
  --repo fabelpad/platform --ref main \
  -f action=complete -f version_code=WERKELIJKE_NUMERIEKE_VERSIECODE
```

```bash
gh workflow run fabelpad-play-production.yml \
  --repo fabelpad/platform --ref main \
  -f action=halt -f version_code=WERKELIJKE_NUMERIEKE_VERSIECODE
```

De workflow weigert ontbrekende/ongeldige codes, een andere branch of een niet-passende bestaande uitrol. `verify` wijzigt niets en vereist geen versiecode. Stoppen verwijdert geen update van toestellen die hem al hebben. Na volledige uitrol herstel je met een nieuwe gerepareerde versie en hogere code, met behoud van lokale profielen/voortgang en dezelfde uploadsleutel.

Interne uploads en productieacties gebruiken dezelfde concurrencygroep `fabelpad-play-release` met `queue: max`; er lopen geen gelijktijdige release-edits vanuit deze workflows. Handmatige Console-wijzigingen moeten ook worden afgestemd. [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

## 10. Open stappen vóór zelfstandige vervolgreleases

| Stap | Wat staat klaar / wat nog vaststellen |
| --- | --- |
| GitHub-OIDC en bescherming | Cloud-readback, GitHub-environments/secrets, beide echte WIF-/Play-leesproeven en branch-/tagregels bevestigd; zie actuele evidence. |
| Play-appregistratie en effectieve rechten | Eigenaar bevestigt beide appgebonden uitnodigingen; bewijs van echte app/API-toegang en een eerste upload afzonderlijk bewaren. Een readonly reviewcheck bewijst geen releaserecht. |
| Eerste interne / productie | Nog niet bevestigd; Console-status, eerste gezonde `completed`-productierelease en echte gebruikte codes controleren. |
| Account / testgate / landen | Accountgebonden taken en gekozen landen volgens het invulblad afronden; geen fictieve testers of wachttijd. |
| Store-assets / toestellen | Externe beelden, echte toestelacceptatie en Play-installatie/update vastleggen. |
| Tracks / codereeks / uitrol | Exacte interne track, productietrack, vrije versiecodebasis en gewenste uitrolfractie bevestigen. |
| Vrijgave | Signing/publicatie blijven uit totdat bovenstaande past. Wijzig JSON via review; main-configintegratie kan intern uploaden, beschermde tag kan productie promoveren. |

Daarna kan een concrete opdracht zijn: **“Publiceer Fabelpad 1.0.2: voer de controles uit, bouw en publiceer intern, test de kandidaat en promoveer de vrijgegeven SHA naar productie.”** Nieuwe Google-beleidstaken blijven afzonderlijke taken; een voorbereide pipeline bewijst geen Google-goedkeuring.
