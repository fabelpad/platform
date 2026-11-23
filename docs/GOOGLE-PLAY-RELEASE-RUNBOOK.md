> **Publieke productie, 23 november 2026:** https://fabelpad.nl en https://fabelpad.nl/privacy zijn inmiddels actief met geldig HTTPS en zonder login gecontroleerd. Zie [live-acceptatie](PRODUCTIE-LIVE-2026-11-23.md) en het [actuele invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md). De eerdere hostingblokkades hieronder zijn historisch.

> **Actuele bundel, 23 november 2026:** Fabelpad **1.0.1 (2)** is ondertekend en gecontroleerd. Gebruik het [actuele bouw-/uploadverslag](ANDROID-PRODUCTIE-1.0.1.md) en de bijbehorende bestanden. De versie-, hash- en bereikbaarheidsgegevens hieronder beschrijven de eerdere voorbereiding van 18 november.

# Fabelpad — productie-AAB, Play App Signing en automatische updates

Gecontroleerd op **18 november 2026**. Deze procedure hoort uitsluitend bij **Fabelpad**, repository **`fabelpad/platform`**, Android-pakket **`nl.fabelpad.app`**, integratiebranch **`main`** en telefoon/tablet. De eerste productieversie is **1.0.0**, lokaal met **versionCode 1**. Het volledige scherminvulblad staat in [GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md).

**Status:** de productieroute en eigen uploadsigning zijn voorbereid. De feitelijke builduitslag en checksum staan bij de geleverde AAB in `artifacts/native/fabelpad-production.json`. Een lokale build is geen Play-upload of Google-goedkeuring. In deze opdracht zijn geen Play-formulieren ingediend, Cloud-identiteiten aangemaakt of automatische Play-publicaties geactiveerd.

**Geleverd:** productie-AAB 1.0.0 (1), `nl.fabelpad.app`, 37.005.584 bytes, SHA-256 `ffc22ec85449074a667a243dc132dfa46e9a484c756dc57c859433ba68ba6e1c`. Gebouwd en statisch geverifieerd op schone commit `8dcb98c4287dc78421b092ee395ace05f492baaa`. Zie [het bouwverslag](ANDROID-PRODUCTIE-VALIDATIE.md). Latere documentatie- en CI-bootstrapcorrecties veranderen dit bestand niet.

Vóór de eerste indiening moeten de openbare privacyverklaring, uitgeversgegevens, Store-beelden, doelgroep/landen en accountgebonden Play-taken zijn afgerond. `https://fabelpad.nl/privacy` gaf tijdens de voorbereiding **HTTP 401 / StackProtect**. De lokale privacypagina is voorbereid; de openbare hosting werkt nog niet voor bezoekers zonder inlog. De echte websitehostingtoegang ontbreekt. Plaats de voorbereide pagina daar pas na invulling van de ontbrekende juridische en hostinggegevens. Een VPS-naam bewijst geen domeinrouting.

## 1. Welk bestand upload je voor ondertekening?

Upload **`artifacts/native/fabelpad-production.aab`** bij de eerste interne release. Deze bundel is al ondertekend met de eigen **uploadsleutel**. Kies in Play App Signing dat **Google een app-signingsleutel genereert en beheert**. Google gebruikt daarna zijn app-signingsleutel voor de APK's die gebruikers krijgen. Voor deze nieuwe app is bij die keuze geen PEPK-export nodig. [Android Developers: signing voor een nieuwe app](https://developer.android.com/studio/publish/app-signing#sign-apk)

| Bestand / sleutel | Wat ermee doen |
| --- | --- |
| `artifacts/native/fabelpad-production.aab` | Dit is het te uploaden releasebestand. Controleer de bijbehorende JSON en gebruik uitsluitend een geslaagde, gesigneerde productiebuild. |
| `artifacts/native/fabelpad-production.json` | Openbaar buildbewijs met bron-SHA, versie, pakket, hash en controles; bewaren bij de release. Niet uploaden als appbundle. |
| `artifacts/native/fabelpad-upload-certificate.pem` | Openbaar uploadcertificaat. Alleen uploaden als Play specifiek om registratie of reset van een **uploadcertificaat** vraagt. Dit vervangt de AAB niet. |
| `/home/codex/.local/share/fabelpad-signing/fabelpad-upload.p12` | Private uploadkeystore. Buiten Git en distributieartefacten houden; veilig herstellen en voor volgende builds hergebruiken. |
| `/home/codex/.config/dg-webservices/fabelpad-signing/upload-store-password` | Afgeschermde wachtwoordbron. Apart van de keystore bewaren. Niet in chat, logregels of Play-velden plakken. |
| PEPK-bestand | N.v.t. voor de gekozen Google-keygeneratie. Alleen een andere, bewust gekozen eigen app-signingsleutelroute gebruikt een versleutelde sleuteloverdracht volgens het specifieke Console-scherm. |

De eigen uploadsleutel is PKCS12, RSA-3072, alias **`fabelpad-upload`**. Het publieke uploadcertificaat heeft SHA-256:

```text
35:98:B0:E2:D3:D6:D7:D5:12:71:10:97:03:52:73:3E:79:E3:F1:22:F1:BB:60:16:17:04:AF:2E:42:18:87:DE
```

Dit is het **uploadcertificaat**, niet het latere Play-appsigningcertificaat. De app gebruikt momenteel geen HTTPS App Links of externe login; een verzonnen App Links- of OAuth-certificaat is daarom niet nodig. Noteer na de eerste upload wel het echte Play-appsigningcertificaat onder **App-integriteit → App-ondertekening**; zoek op die schermnaam als het menu afwijkt. [Uploadcertificaat en sleutelreset](https://developer.android.com/studio/publish/app-signing#generate-key)

`scripts/native-signing-init.py` heeft de eigen sleutel al aangemaakt. De helper verifieert bij herhaling de bestaande sleutel en maakt het openbare PEM opnieuw; hij roteert geen bestaande sleutel. De eigen herstelkopie op **dg-nxttrack-01** is op 18 november gecontroleerd: keystore **`/var/backups/dg-webservices/fabelpad/android-signing/fabelpad-upload-2026-11-18.p12`**, wachtwoord apart onder **`/etc/dg-webservices/secrets/fabelpad-signing/upload-store-password`**. Beide bestanden zijn uitsluitend voor root leesbaar (modus 600). De backup is met het beschermde wachtwoord geopend en het publieke certificaat komt overeen. De eigenaar kan deze via de bestaande beheerverbinding in eigen gescheiden herstelopslag opnemen. Gebruik nooit DartFlow-sleutels voor Fabelpad.

## 2. Controleer de productiebuild en vervang later de launcher

De eerste release is een **gratis, volledig lokale verhalenapp**: geen online accounts, advertenties, betalingen, abonnementen, cloudprofielen of analytics. Lokale kindprofielen zijn geen online account. De Android-app bevat de verhalen en gebruikt uitsluitend een beschikbare apparaatstem waarvoor geen netwerkverbinding nodig is. Ontbreekt een geschikte offline stem, dan blijft lezen mogelijk. Het scherminvulblad beschrijft de bijbehorende gegevensverklaring; website- en supportverwerking staan daarvan afzonderlijk beschreven.

De huidige launcher is op de bestaande Fabelpad-huisstijl gebaseerd. Je laat het definitieve app-icoon, de functieafbeelding en telefoon-/8-inch-/10-inchbeelden extern maken. Store-beelden veranderen de AAB niet. Een **launcher-icoon in de app** zit wel in de AAB en vereist opnieuw bouwen. Zodra een versionCode in Play is geüpload, hoort die code blijvend bij dezelfde bundel; gebruik voor een andere bundel een hogere code.

Voor een nieuwe lokale, gesigneerde build vanuit de gecontroleerde checkout:

```bash
cd /home/codex/repos/fabelpad
export JAVA_HOME=/home/codex/.local/share/fieldgrid-android/jdk-21
export ANDROID_HOME=/home/codex/.local/share/fabelpad-android/sdk
export FABELPAD_ANDROID_PACKAGE=nl.fabelpad.app
export FABELPAD_ANDROID_VERSION_NAME=1.0.0
export FABELPAD_ANDROID_VERSION_CODE=1
export FABELPAD_PRIVACY_URL=https://fabelpad.nl/privacy
export FABELPAD_SUPPORT_URL=mailto:support@fabelpad.nl
# Optioneel: pad van het definitieve launcherbestand, relatief aan mobile/.
# Zonder override gebruikt app.config.ts mobile/assets/brand/launcher.png.
# export FABELPAD_ANDROID_ICON=./assets/brand/launcher.png
pnpm install --frozen-lockfile
npm ci --prefix mobile --no-audit --no-fund
bash scripts/native-build-production.sh
sha256sum artifacts/native/fabelpad-production.aab
```

Gebruik code 1 hierboven uitsluitend zolang die code nog niet met een andere bundel in Play is gebruikt. De helper leest de bestaande, afgeschermde signingbronnen; wachtwoorden hoeven niet in argumenten of bestanden binnen Git. Hij voert TypeScript-, runtime- en native releasecontroles uit, bouwt beide 64-bit-ABI's en valideert de feitelijke AAB, signing en 16 KB-uitlijning. Gradle gebruikt JDK 21 en waar vereist de JDK 17-toolchain. Op een andere machine moeten die toolchains en de SDK/NDK-versies uit de gelockte React Native-versie beschikbaar zijn; zet zo nodig `JAVA_TOOLCHAIN_17` op het JDK 17-pad.

Dit is alleen een compilecontrole en **geen uploadbaar releasebestand**:

```bash
FABELPAD_ANDROID_VERSION_CODE=1 \
  bash scripts/native-build-production.sh --unsigned-check
```

Die opdracht maakt `fabelpad-production-unsigned.aab` en de bijbehorende JSON. De gesigneerde route levert `fabelpad-production.aab`. Verwar die bestanden niet.

Controleer de echte AAB-JSON op `packageId`, `versionName`, `versionCode`, `signed`, `sha256`, `source.gitSha` en `source.workingTreeDirty`. Laat een definitieve release vanuit een schone, vastgelegde commit bouwen en registreer de SHA. De lokale validatie zegt expliciet of installatie en runtime op apparaten werkelijk zijn getest. Voer nog echte tests uit op telefoon, 8-inch- en 10-inchtablet: eerste start, alle verhaalroutes, profielen wisselen, favorieten, rustige stand, grote tekst, lokale verwijdering, offline voorlezen, ontbrekende Nederlandse stem en de links onder Ouders. Een succesvolle compilatie vervangt die tests niet.

## 3. Maak de Play-app en de eerste interne release

Voor acceptatie en echte Store-captures staat ook `artifacts/native/fabelpad-production.apk` klaar. Dat is dezelfde productie-app, met de eigen uploadsleutel gesigneerd. Installeer met `adb install -r artifacts/native/fabelpad-production.apk` of open de APK op het toestel. Test met verzonnen profielen. De APK die Google Play later levert gebruikt Googles app-signingcertificaat; overstappen vanaf deze sideload kan verwijderen en opnieuw installeren vereisen, waarbij de lokale testvoortgang verdwijnt. Test reguliere updates daarom via een Play-testtrack. Upload de **AAB** in Play Console.

Dit zijn handelingen voor de eigenaar in de Console; ze zijn hier nog niet uitgevoerd.

1. Open [Play Console](https://play.google.com/console/) onder het bedoelde uitgeversaccount. Controleer accounttype, identiteit/contactverificatie, Android-ontwikkelaarsverificatie, pakketregistratie en eventuele handelaarsverklaring. Accounttype en aanmaakdatum zijn nog niet bevestigd. Neem wettelijke uitgeversgegevens letterlijk uit het eigen account; leid die niet af uit DG Webservices, een domein of gratis distributie.
2. Kies **Alle apps → App maken**. Appnaam **Fabelpad**, standaardtaal **Nederlands (Nederland)**, **App**, **Gratis**. Neem supportadres **support@fabelpad.nl** over waar gevraagd. Beoordeel zelf de getoonde programmabeleids-/export-/signingverklaringen. Bij de eerste AAB moet pakket **nl.fabelpad.app** verschijnen. Stop bij een afwijking.
3. Rond de Store-vermelding en App-content af met het [productie-invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md). Upload de extern gemaakte beelden wanneer die er zijn. Het gewone kleine-tabletveld kan **7-inch** heten; gebruik daar de geverifieerde echte 8-inchcaptures wanneer Console die afmetingen accepteert en benoem ze eerlijk. Voeg geen fictieve TV-/Wear-/Auto-assets toe.
4. Maak `https://fabelpad.nl/privacy` publiek bereikbaar zonder StackProtect/login en vul de ontbrekende uitgever-/hosting-/privacyfeiten in. Open die URL daarna via een privévenster en vanuit de Android-app. Bewaar geen onjuiste verklaring om het Dashboard alvast groen te maken.
5. Open **Testen en releasen → Testen → Intern testen → Nieuwe release maken**. Zoek **Intern testen** als je Console een andere menustructuur toont.
6. Onder **App-ondertekening**: accepteer de signingvoorwaarden pas na beoordeling en behoud de optie waarbij **Google de app-signingsleutel genereert**. Kies niet de route om een eigen private app-signingsleutel te exporteren.
7. Upload **`fabelpad-production.aab`**. Controleer op het uploadscherm pakket **nl.fabelpad.app**, versie **1.0.0**, code **1** voor de eerste lokale bundel. Als je de signing-only CI-bundel gebruikt, staat daar de hogere `1000 + workflowrunnummer`-code; gebruik dan die werkelijke code in alle volgende stappen.
8. Interne releasenaam: **Fabelpad 1.0.0 (1)**, aangepast aan de werkelijk geüploade code. Neem de Nederlandstalige releaseopmerkingen uit `scripts/play/release-notes.json`; het scherminvulblad bevat ook een kopieerblok. Los blokkerende manifest-, SDK-, signing- of apparaatwaarschuwingen eerst op.
9. Kies **Volgende** / **Release controleren**, beoordeel alle fouten en waarschuwingen en gebruik daarna uitsluitend de door Console aangeboden knop voor de interne testrelease. Dit kan een beoordeling vragen. De exacte slotknop hangt af van app-/accountstatus; een ontbrekend screenshotscherm wordt in het invulblad als te bevestigen gemarkeerd.
10. Voeg zelf de bedoelde interne testers toe en deel de opt-in-link buiten deze geautomatiseerde route. Installeer via Play met een testaccount. Controleer de versionCode op toestel én in Console, voer het testplan uit en beoordeel het pre-launch report en Android Vitals.

Een eerste handmatige upload registreert de appbundle bij het pakket. De Publisher API beheert daarna releases van die app; deze pipeline maakt geen nieuwe Console-app, Store-vermelding, beleidsverklaringen, landen of testerlijsten aan. [Nieuwe app en release voorbereiden](https://support.google.com/googleplay/android-developer/answer/9859348?hl=nl)

## 4. Rond de eerste productiepublicatie handmatig af

1. Controleer of **Productie** beschikbaar is. Voor een persoonlijk ontwikkelaarsaccount dat na **13 november 2023** is gemaakt, geldt een gesloten test met minimaal **12 testers, minstens 14 dagen onafgebroken aangemeld**, gevolgd door een aanvraag voor productietoegang. De eerste mogelijke aanvraagdatum volgt uit de echte aanmeldingen; een interne test telt hiervoor niet. Voor dit account ontbreken de aanmaakdatum en testgegevens nog. [Actuele testvereisten, gecontroleerd 18 november 2026](https://support.google.com/googleplay/android-developer/answer/14151465?hl=nl)
2. Selecteer de daadwerkelijk gekozen landen onder de productietrack. Die productkeuze is nog niet bevestigd. De app is gratis; verander dit niet in betaald om later abonnementen toe te kunnen voegen. Deze release bevat geen Play Billing.
3. Open **Productie → Nieuwe release maken**. Kies de exact geteste AAB uit de appbundlebibliotheek; bouw hiervoor geen andere bundel met dezelfde code.
4. Controleer Store-teksten, beelden, privacy, Data safety-preview, doelgroep/IARC, advertenties **Nee**, app-toegang en alle taken onder **App-content** en **Beleidsstatus**. Neem de concrete keuzes uit het productie-invulblad over.
5. Controleer de release, los blokkades op en stuur de wijzigingen via de aangeboden Console-knop ter beoordeling. Een opgeslagen concept is nog niet ingediend. Een API-commit of reviewgoedkeuring bewijst evenmin dat de app al beschikbaar is.
6. De eerste productierelease ondersteunt geen gewone gefaseerde update-uitrol. Controleer de beschikbare publicatieknoppen in **Publicatieoverzicht**. Beschikbaarheid van beheerd publiceren bij de eerste publicatie moet in deze app worden bevestigd. Gebruik bij latere automatische updates geen handmatige publicatiehold als goedgekeurde updates vanzelf beschikbaar moeten worden.
7. Controleer na beschikbaarheid installatie vanuit de openbare Store in de gekozen landen en opnieuw de belangrijkste gebruikersflow.

Pas na de eerste gezonde productierelease wordt de automatische productiepromotie uit stap 8 aangezet. Het releaseprogramma weigert bewust een eerste productiepublicatie via de API.

## 5. Maak een eigen Google Cloud-project en twee WIF-identiteiten

De automatisering draait in **GitHub Actions** en gebruikt de **Google Play Android Publisher API** in Google Cloud. Google Play blijft verantwoordelijk voor review en distributie. Dezelfde hoofdopzet is voorbereid voor DartFlow; daar stonden API-autopublicatie en Cloud-authenticatie bij de controle nog uit. Fabelpad krijgt eigen resources, sleutels en apprechten.

Gebruik **Workload Identity Federation via twee serviceaccounts**. Daardoor krijgt een job een kortlevend OAuth-token en is geen permanente Google JSON-sleutel nodig. Een koppeling van het Play-ontwikkelaarsaccount aan een Cloud-project is volgens de actuele API-documentatie niet meer vereist. [Publisher API instellen](https://developers.google.com/android-publisher/getting_started), [Google Cloud WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [auth-actie](https://github.com/google-github-actions/auth)

Voer de volgende eenmalige handelingen alleen uit voor het nieuwe, bedoelde Fabelpad-project:

1. Open [Google Cloud Console](https://console.cloud.google.com/) met het beheeraccount van de eigenaar. Kies **Project selecteren → Nieuw project**, naam **Fabelpad Play** en de juiste organisatie/locatie. Kies een beschikbare eigen project-ID en noteer die. De project-ID is nog onbekend; onderstaande opdracht stopt zolang de invulwaarde niet is vervangen.
2. Gebruik Google Cloud Shell of een vertrouwd beheerwerkstation met actuele `gcloud` en `gh`. Meld aan met `gcloud auth login` en `gh auth login` wanneer die sessies nog ontbreken. Controleer dat `gh` toegang heeft tot de private repository. Plaats geen toegangstokens in opdrachten of documentatie.
3. Het beheeraccount moet binnen dit nieuwe project services, serviceaccounts en WIF-pools mogen beheren. Bij een rechtenfout laat de Cloud-beheerder de betreffende beperkte beheermachtiging verlenen. Geef de release-serviceaccounts geen projectbrede Owner-/Editorrol.
4. Voer onderstaand blok uit. Het maakt uitsluitend de twee nieuwe Fabelpad-identiteiten en hun onderlinge bindingen. Bij een al bestaande naam stopt `create`; controleer dan eerst de bestaande configuratie en voer niet blind een vervangende wijziging uit.

```bash
set -euo pipefail
FABELPAD_GCP_PROJECT='VUL-HIER-JE-EIGEN-GOOGLE-CLOUD-PROJECT-ID-IN'
[[ "$FABELPAD_GCP_PROJECT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || {
  echo 'Vul eerst de echte eigen Google Cloud-project-ID in.' >&2
  exit 1
}
FABELPAD_GITHUB_REPO='fabelpad/platform'
FABELPAD_REPO_ID="$(gh api "repos/$FABELPAD_GITHUB_REPO" --jq '.id')"
FABELPAD_OWNER_ID="$(gh api "repos/$FABELPAD_GITHUB_REPO" --jq '.owner.id')"
test "$FABELPAD_REPO_ID" = 1446419952
test "$FABELPAD_OWNER_ID" = 352706055
FABELPAD_GCP_NUMBER="$(gcloud projects describe "$FABELPAD_GCP_PROJECT" --format='value(projectNumber)')"
[[ "$FABELPAD_GCP_NUMBER" =~ ^[0-9]+$ ]]

gcloud services enable \
  androidpublisher.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com cloudresourcemanager.googleapis.com \
  --project="$FABELPAD_GCP_PROJECT"

for fabelpad_stage in internal production; do
  fabelpad_sa="fabelpad-play-$fabelpad_stage"
  fabelpad_pool="fabelpad-play-$fabelpad_stage"
  fabelpad_env="fabelpad-play-$fabelpad_stage"
  if [[ "$fabelpad_stage" == internal ]]; then
    fabelpad_workflow='fabelpad-android-ci.yml'
    fabelpad_ref="assertion.ref == 'refs/heads/main' && assertion.event_name == 'push'"
  else
    fabelpad_workflow='fabelpad-play-production.yml'
    fabelpad_ref="((assertion.ref.startsWith('refs/tags/fabelpad-v') && assertion.event_name == 'push') || (assertion.ref == 'refs/heads/main' && assertion.event_name == 'workflow_dispatch'))"
  fi

  gcloud iam service-accounts create "$fabelpad_sa" \
    --project="$FABELPAD_GCP_PROJECT" \
    --display-name="Fabelpad Play $fabelpad_stage"

  gcloud iam workload-identity-pools create "$fabelpad_pool" \
    --project="$FABELPAD_GCP_PROJECT" --location=global \
    --display-name="Fabelpad Play $fabelpad_stage"

  gcloud iam workload-identity-pools providers create-oidc github \
    --project="$FABELPAD_GCP_PROJECT" --location=global \
    --workload-identity-pool="$fabelpad_pool" \
    --issuer-uri='https://token.actions.githubusercontent.com' \
    --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.event_name=assertion.event_name,attribute.workflow_ref=assertion.workflow_ref' \
    --attribute-condition="assertion.repository_id == '$FABELPAD_REPO_ID' && assertion.repository_owner_id == '$FABELPAD_OWNER_ID' && assertion.sub == 'repo:$FABELPAD_GITHUB_REPO:environment:$fabelpad_env' && assertion.workflow_ref == ('$FABELPAD_GITHUB_REPO/.github/workflows/$fabelpad_workflow@' + assertion.ref) && $fabelpad_ref"

  fabelpad_email="$fabelpad_sa@$FABELPAD_GCP_PROJECT.iam.gserviceaccount.com"
  gcloud iam service-accounts add-iam-policy-binding "$fabelpad_email" \
    --project="$FABELPAD_GCP_PROJECT" \
    --role='roles/iam.workloadIdentityUser' \
    --member="principalSet://iam.googleapis.com/projects/$FABELPAD_GCP_NUMBER/locations/global/workloadIdentityPools/$fabelpad_pool/attribute.repository_id/$FABELPAD_REPO_ID"

  printf '%s\n' "$fabelpad_env" "$fabelpad_email" \
    "projects/$FABELPAD_GCP_NUMBER/locations/global/workloadIdentityPools/$fabelpad_pool/providers/github"
done
```

De geverifieerde numerieke GitHub-ID's op de controledatum zijn repository **1446419952** en eigenaar **352706055**. De voorwaarden vertrouwen op die ID's en tevens het exacte workflowpad, event, ref en environment. Bij een repositoryoverdracht of aangepaste GitHub OIDC-subjecttemplate moet de beheerder de identiteit opnieuw controleren. De twee afzonderlijke pools voorkomen dat de interne identiteit via dezelfde pool de productierol kan aannemen. Google adviseert numerieke IDs tegen hergebruik van namen. [WIF-claimvoorwaarden](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines#github-actions)

Bewaar de zes afgedrukte niet-geheime waarden. WIF/IAM-wijzigingen kunnen enkele minuten nodig hebben om door te werken. Deze inrichting gebruikt geen serviceaccount-JSON en geen domeinbrede delegatie; voeg daarvoor geen extra sleutels of Token Creator-rollen toe.

## 6. Geef beide serviceaccounts alleen Fabelpad-apprechten in Play

Doe dit na de eerste handmatige AAB-upload en appregistratie:

1. Play Console → **Gebruikers en rechten → Nieuwe gebruikers uitnodigen**.
2. E-mailadres: `fabelpad-play-internal@<jouw-project-ID>.iam.gserviceaccount.com`, exact de waarde uit stap 5. Kies **App-rechten → App toevoegen → Fabelpad**. Laat accountbrede rechten uit.
3. Vink voor dit interne account uitsluitend **App-gegevens bekijken (alleen-lezen)** en **Apps vrijgeven aan testtracks** aan. Laat productie, betalingen, bestellingen, beleidsverklaringen, Store-beheer en testerlijsten beheren uit. Rond af met **Gebruiker uitnodigen**.
4. Herhaal voor `fabelpad-play-production@<jouw-project-ID>.iam.gserviceaccount.com`. Selecteer uitsluitend **Fabelpad**, **App-gegevens bekijken (alleen-lezen)** en **Releasen naar productie, apparaten uitsluiten en app-ondertekening van Play gebruiken**. Het gecombineerde productierecht heeft die volledige Google-labeltekst; de pipeline gebruikt daarvan uitsluitend releasepromotie/-beheer. Geef geen beheerder- of accountbrede rechten.
5. Controleer de appselectie en actieve apprechten. Zoek bij afwijkende vertaling op de bovenstaande rechtnaam; de exacte labels komen uit de Nederlandstalige Help op de controledatum. [Play Console-rechten](https://support.google.com/googleplay/android-developer/answer/9844686?hl=nl)

Er zijn geen financiële API-rechten nodig: deze release verkoopt niets. De productie-identiteit hoeft geen nieuwe AAB te signeren of uploaden; zij promoveert de bestaande interne versie.

## 7. Richt GitHub-environments, bescherming en signingsecrets in

Deze instellingen zijn voorbereid in bestanden maar nog niet op GitHub aangebracht. De workflows moeten eerst via de bestaande reviewroute in **main** staan. Een lokale reviewbranch kan niet als productieroute worden gebruikt.

### Omgevingen en bescherming

1. Open [fabelpad/platform](https://github.com/fabelpad/platform) → **Settings → Environments → New environment**.
2. Naam **fabelpad-play-internal**. Onder **Deployment branches and tags** kies je **Selected branches and tags**, met uitsluitend de **branch main**.
3. Maak **fabelpad-play-production**. Sta uitsluitend **branch main** en **tags fabelpad-v*** toe. `main` is nodig voor een expliciete `complete`-/`halt`-workflow, de tags voor een nieuwe productiepromotie. Maak branch- en tagregels van het juiste type.
4. Voor review vóór productie kun je een vereiste reviewer instellen waar het abonnement dat ondersteunt. Als je automatische promotie na een door jou gemaakte beschermde releasetag wilt, voeg geen onverwachte handmatige environmenthold toe. De eigenaar bepaalt dit beschermingsbeleid expliciet.
5. Open **Settings → Rules → Rulesets → New ruleset → New tag ruleset**. Naam **Fabelpad Play releasetags**, status **Active**, tagpatroon **fabelpad-v***. Beperk aanmaken tot de aangewezen releasebeheerders via de passende bypassselectie en blokkeer aanpassen/verwijderen. Controleer met een echte bevoegde releasemanager dat de gewenste tag kan worden gemaakt. De pipeline vereist `github.ref_protected=true`; een alleen beschreven of niet-actieve regel voldoet niet.
6. Bescherm `main` via de bestaande PR-werkwijze en de geslaagde controles. Na de eerste workflowrun heten de relevante jobs **verify** uit de bestaande projectworkflow en **Native Android-controles** uit Fabelpad Android CI. De releasepoort controleert bovendien de originele succesvolle **main-pushrun** van beide workflowbestanden op de volledige SHA én de voltooide geslaagde verplichte job. Ontbrekende, overgeslagen, lopende, geannuleerde of mislukte verplichte jobs worden geweigerd; een groene PR-run volstaat niet. De optionele signingjob mag bij uitgeschakelde automatisering overgeslagen zijn; voor productiepromotie blijft het echte interne uploadbewijs verplicht.

Als deze private repository met het aanwezige GitHub-abonnement geen bruikbare tagbescherming of environmentbeperking ondersteunt, blijft de automatische productieroute geblokkeerd. De gesigneerde AAB kan dan via de Console-route worden uitgebracht; zet de beveiligingscontrole niet uit. [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

### Variabelen en secrets

Voeg de repositoryvariabelen toe onder **Settings → Secrets and variables → Actions → Variables → New repository variable**. Omgevingsvariabelen en -secrets staan bij de betreffende environment.

| Naam | Opslag | Exact invullen / bron |
| --- | --- | --- |
| `PLAY_PACKAGE_NAME` | Repository variable | `nl.fabelpad.app` |
| `FABELPAD_PRIVACY_URL` | Repository variable | `https://fabelpad.nl/privacy`; pas als publiek werkend gebruiken voor indiening. |
| `FABELPAD_SUPPORT_URL` | Repository variable | `mailto:support@fabelpad.nl` |
| `FABELPAD_ANDROID_ICON` | Optionele repository variable | Relatief pad vanuit `mobile/` naar het **gecommitte** definitieve launcherbestand, bijvoorbeeld `./assets/brand/launcher.png`. Leeg gebruikt het huidige bestand op dat pad. Geen lokaal extern bestandspad dat de runner niet heeft. |
| `FABELPAD_VERSION_CODE_BASE` | Repository variable | `1000`, zolang alle reeds gebruikte codes daaronder liggen. De vaste native workflow gebruikt vervolgens `1000 + github.run_number`. Bij een ander reeds gebruikt maximum eerst een hogere, gecontroleerde offset kiezen. |
| `FABELPAD_SIGNING_ENABLED` | Repository variable | Eerst `false`; na registratie van de eigen signingsecrets `true` voor signing-only builds. |
| `FABELPAD_PLAY_ENABLED` | Repository variable | Eerst `false`. Pas na alle onderstaande eenmalige stappen en de eerste gezonde productiepublicatie op `true` zetten. |
| `PLAY_INTERNAL_TRACKS` | Repository variable | Eén werkelijk geverifieerde interne track-ID, bijvoorbeeld `internal` of `qa` zoals de API die voor deze app retourneert. Niet beide als ze dezelfde track bedoelen. |
| `PLAY_PRODUCTION_TRACKS` | Repository variable | `production`, na verificatie van deze werkelijke API-track. |
| `PLAY_ROLLOUT_FRACTION` | Optionele repository variable | `1` voor 100% na review; voor latere gefaseerde updates bijvoorbeeld `0.1` voor 10%. N.v.t. voor de eerste handmatige productiepublicatie. |
| `PLAY_WIF_PROVIDER` | Variable in **fabelpad-play-internal** | Volledige providerresource van de **interne** WIF-pool uit stap 5. |
| `PLAY_SERVICE_ACCOUNT` | Variable in **fabelpad-play-internal** | E-mailadres van het **interne** serviceaccount uit stap 5. |
| `PLAY_WIF_PROVIDER` | Variable in **fabelpad-play-production** | Volledige providerresource van de **productie**-pool uit stap 5. |
| `PLAY_SERVICE_ACCOUNT` | Variable in **fabelpad-play-production** | E-mailadres van het **productie**-serviceaccount uit stap 5. |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Secret in **fabelpad-play-internal** | Base64 van de eigen Fabelpad-uploadkeystore, via stdin registreren. |
| `ANDROID_UPLOAD_STORE_PASSWORD` | Secret in **fabelpad-play-internal** | Inhoud van de eigen afgeschermde wachtwoordbron, via stdin. |
| `ANDROID_UPLOAD_KEY_ALIAS` | Secret in **fabelpad-play-internal** | `fabelpad-upload` |
| `ANDROID_UPLOAD_KEY_PASSWORD` | Secret in **fabelpad-play-internal** | Voor deze PKCS12 dezelfde eigen wachtwoordbron als het storepassword. |
| `PLAY_ACCESS_TOKEN` | Geen instelling voor de eigenaar | Alleen tijdelijk uit WIF tijdens een job; nooit als permanente secret vastleggen. |

Er is geen `PLAY_SERVICE_ACCOUNT_JSON` nodig in deze geïmplementeerde WIF-route. De productieomgeving krijgt geen keystore of signingwachtwoorden. Er zijn geen Supabase-/backendsecrets nodig voor deze lokale Android-release. Native `FABELPAD_*`-URL's en launcherkeuze worden in de build opgenomen; wijzigen daarvan vereist een nieuwe AAB.

Registreer de vier signingsecrets vanaf het bestaande beheerwerkstation, zonder de waarden naar het scherm te printen. Dit blok **schrijft GitHub-secrets** en hoort bij de door de eigenaar uit te voeren inrichting:

```bash
set -euo pipefail
set +x
FABELPAD_REPO='fabelpad/platform'
FABELPAD_KEYSTORE='/home/codex/.local/share/fabelpad-signing/fabelpad-upload.p12'
FABELPAD_PASSWORD_FILE='/home/codex/.config/dg-webservices/fabelpad-signing/upload-store-password'
test -r "$FABELPAD_KEYSTORE"
test -r "$FABELPAD_PASSWORD_FILE"

base64 < "$FABELPAD_KEYSTORE" | tr -d '\n' | \
  gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 --repo "$FABELPAD_REPO" --env fabelpad-play-internal
gh secret set ANDROID_UPLOAD_STORE_PASSWORD --repo "$FABELPAD_REPO" --env fabelpad-play-internal < "$FABELPAD_PASSWORD_FILE"
printf '%s' 'fabelpad-upload' | \
  gh secret set ANDROID_UPLOAD_KEY_ALIAS --repo "$FABELPAD_REPO" --env fabelpad-play-internal
gh secret set ANDROID_UPLOAD_KEY_PASSWORD --repo "$FABELPAD_REPO" --env fabelpad-play-internal < "$FABELPAD_PASSWORD_FILE"
gh secret list --repo "$FABELPAD_REPO" --env fabelpad-play-internal
```

De laatste opdracht toont namen, geen secretwaarden. Als alternatief staat de gecontroleerde helper klaar; voer één van beide routes uit:

```bash
cd /home/codex/repos/fabelpad
python3 -B scripts/native-signing-to-github.py --apply
```

Die helper controleert dat het eigen environment bestaat en geeft de vier waarden via stdin door aan `gh`. Hij doet geen Play-upload.

### Test eerst alleen signing

1. Houd **FABELPAD_PLAY_ENABLED=false**.
2. Zet **FABELPAD_SIGNING_ENABLED=true**.
3. **Actions → Fabelpad Android CI → Run workflow → branch main → signed_bundle aangevinkt → Run workflow**. Of:

```bash
gh workflow run fabelpad-android-ci.yml \
  --repo fabelpad/platform --ref main -f signed_bundle=true
```

4. Open de run en controleer de volledige commit-SHA en alle relevante jobs. De job voor signing wacht op de originele geslaagde project-CI op die SHA. Download artefact **fabelpad-signed-aab**. Het bevat AAB en JSON; de job heeft niets naar Play geüpload.
5. De versiecode is **1000 + het runnummer van deze vaste workflow**, bijvoorbeeld 1007 bij runnummer 7. Een rerun van dezelfde run houdt dezelfde code en herstelt de eerdere AAB. Gebruik altijd de werkelijke code uit JSON/Console, niet dit voorbeeld.

## 8. Verifieer de track-ID's en activeer automatische interne uploads

Cloud-/Play-toegang is pas bewezen na een geslaagde aanroep voor dit pakket. De `list-tracks`-functie van het voorbereide programma maakt een tijdelijke Play-edit, leest tracks en verwijdert die edit zonder releasecommit. Dit is een diagnostische API-handeling; voer haar als beheerder pas uit nadat de account- en apprechten uit stap 6 zijn verleend.

Voor deze eerste controle gebruik je op het vertrouwde beheerwerkstation de interne serviceaccountidentiteit. De GitHub WIF-route heeft de volgende tijdelijke beheerdermachtiging niet nodig:

1. Google Cloud → **IAM en beheer → Serviceaccounts → fabelpad-play-internal → Machtigingen → Toegang verlenen**. Kies je eigen geverifieerde Google-beheeraccount als principal en uitsluitend de rol **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`) **op dit ene serviceaccount**. Sla op en geef de wijziging enkele minuten om door te werken. Als de beheerder die beperkte machtiging al aantoonbaar heeft, voeg je geen dubbele binding toe.
2. Voer vanaf de Fabelpad-checkout het volgende blok uit. Gebruik de echte project-ID uit stap 5. De twee tokens blijven in het geheugen van het Python-proces; er wordt geen JSON-key aangemaakt en er staat geen token in argumenten, bestanden of uitvoer.

```bash
cd /home/codex/repos/fabelpad
export FABELPAD_GCP_PROJECT='VUL-HIER-JE-ECHTE-GOOGLE-CLOUD-PROJECT-ID-IN'
python3 -B - <<'PY'
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

try:
    project = os.environ['FABELPAD_GCP_PROJECT']
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,28}[a-z0-9]', project):
        raise ValueError('Eerst de echte project-ID invullen.')
    service_account = f'fabelpad-play-internal@{project}.iam.gserviceaccount.com'
    source = subprocess.run(['gcloud', 'auth', 'print-access-token'],
                            check=True, capture_output=True, text=True).stdout.strip()
    resource = urllib.parse.quote(service_account, safe='')
    request = urllib.request.Request(
        f'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{resource}:generateAccessToken',
        data=json.dumps({'scope': ['https://www.googleapis.com/auth/androidpublisher'],
                         'lifetime': '600s'}).encode(),
        headers={'Authorization': f'Bearer {source}', 'Content-Type': 'application/json'},
        method='POST')
    with urllib.request.urlopen(request, timeout=60) as response:
        temporary = json.load(response)['accessToken']
    environment = dict(os.environ, PLAY_ACCESS_TOKEN=temporary)
    result = subprocess.run([sys.executable, '-B', 'scripts/play/release.py', 'list-tracks',
                             '--package', 'nl.fabelpad.app'], env=environment, check=False)
    sys.exit(result.returncode)
except Exception:
    print('Trackcontrole gestopt. Controleer project-ID, beheeraanmelding, tijdelijke Token Creator-toegang en Play-apprechten. Geen token getoond.', file=sys.stderr)
    sys.exit(1)
PY
```

3. Neem de exact geretourneerde interne track en `production` over in **PLAY_INTERNAL_TRACKS** en **PLAY_PRODUCTION_TRACKS**. De huidige code accepteert `internal` of `qa` als afzonderlijke interne telefoon/tablettrack; TV is buiten scope. Zie je een andere interne ID, laat het programma daarvoor eerst controleren in plaats van een naam te raden.
4. Verwijder daarna uitsluitend de tijdelijke Token Creator-binding die je bij punt 1 zelf voor deze controle hebt toegevoegd. Laat eerder bestaande beheertoegang en de WIF-bindingen staan. [IAM-token genereren](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken), [serviceaccount-impersonatie](https://docs.cloud.google.com/iam/docs/service-account-impersonation)

Een geslaagde lokale controle bewijst de apprechten van dit interne serviceaccount; de eerste echte main-push verifieert bovendien de GitHub-WIF-route. Maak voor diagnostiek geen permanente Google JSON-key. Voor alleen handmatig Console-uploaden is deze API-controle niet nodig.

Wanneer de eerste productiepublicatie gezond is, alle checks en apprechten werken, de track-ID's kloppen, tagbescherming actief is en je automatische uploads vanaf iedere main-push wilt:

```bash
gh variable set FABELPAD_SIGNING_ENABLED --repo fabelpad/platform --body true
gh variable set FABELPAD_PLAY_ENABLED --repo fabelpad/platform --body true
```

Deze twee opdrachten veranderen remote instellingen en worden hier alleen als latere uitvoeropdracht gegeven. Daarna kan een geslaagde push op main een **interne testrelease** publiceren. Dit is nog geen automatische productiepromotie: daarvoor maak je zelf de beschermde releasetag uit stap 9.

De native workflow controleert en bouwt op elke main-push, ook bij een wijziging buiten de Android-map. Dat is het huidige expliciete contract. Wanneer je alleen appwijzigingen wilt laten uploaden, moet de route eerst worden aangepast met een controle van alle werkelijke Android-buildinputs; sla gedeelde content of configuratie daarbij niet over.

## 9. Een volgende productie-update uitbrengen

1. Laat Codex de gevraagde appwijziging implementeren en testen via de gebruikelijke PR-route. Verhoog de gecommitte versie in **mobile/package.json** en de bijbehorende lockmetadata naar bijvoorbeeld **1.0.1**. Werk `scripts/play/release-notes.json` bij met de echte wijzigingen, maximaal **500 Unicode-tekens per taal**. Het programma controleert lege tekst, duplicaten, taalcode en limiet.
2. Merge de gecontroleerde PR naar **main**. De originele main-pushruns van **Lokale bouw en contentcontrole** en **Fabelpad Android CI** moeten op precies die commit slagen. De interne job signeert en uploadt dezelfde productie-AAB naar de ingestelde interne track.
3. Controleer in de Actions-run én Play Console de echte versionCode, installeer via intern testen en test de gebruikersflow. Een geslaagde API-upload is geen bewijs van installatie of beschikbaarheid.
4. Controleer dat artefact **fabelpad-play-receipt** bestaat. Het bevat volledige SHA, pakket, versionName, versionCode, AAB-SHA256, interne track-ID's en run-ID. Signing-only handmatige runs maken bewust geen intern Play-releasebewijs.
5. Maak de beschermde productietag op exact de intern geteste main-SHA. Vervang de twee invulwaarden; gebruik geen branchnaam of afgekorte SHA:

```bash
cd /home/codex/repos/fabelpad
set -euo pipefail
FABELPAD_TESTED_SHA='VUL-DE-VOLLEDIGE-INTERN-GETESTE-40-TEKENS-SHA-IN'
FABELPAD_VERSION='1.0.1'
[[ "$FABELPAD_TESTED_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$FABELPAD_VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]
git fetch origin main --tags
git merge-base --is-ancestor "$FABELPAD_TESTED_SHA" origin/main
FABELPAD_SOURCE_VERSION="$(git show "$FABELPAD_TESTED_SHA:mobile/package.json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')"
test "$FABELPAD_SOURCE_VERSION" = "$FABELPAD_VERSION"
git tag -a "fabelpad-v$FABELPAD_VERSION" "$FABELPAD_TESTED_SHA" -m "Fabelpad $FABELPAD_VERSION"
git push origin "refs/tags/fabelpad-v$FABELPAD_VERSION"
```

6. **Actions → Fabelpad Google Play productie** controleert de beschermde tag, branchherkomst, bronversie, beide originele geslaagde main-CI-runs en het interne releasebewijs. De workflow vergelijkt het Play-bundelhash met het bewijs en promoveert precies de reeds intern geteste versionCode. Hij bouwt niets opnieuw.
7. Controleer de jobuitkomst en vervolgens **Play Console → Publicatieoverzicht**, de productietrack en eventuele review-/beleidsacties. Met `PLAY_ROLLOUT_FRACTION=1` en zonder publicatiehold kan de goedgekeurde update naar 100%. Google bepaalt de review en feitelijke beschikbaarheid. Een gebruiker krijgt een geïnstalleerde update volgens de eigen Play Store-/apparaatinstellingen.
8. Controleer na beschikbaarheid de openbare Store, installatie/update op een echt toestel, versiecode, behoud van lokale profielen en voortgang, voorlezen, crash-/ANR-gegevens en de belangrijkste gebruikersflow.

De artefacten **fabelpad-signed-aab** en **fabelpad-play-receipt** worden **90 dagen** bewaard. Een productietag na verval van het vereiste bewijs stopt. Promoveer binnen die termijn of laat een nieuwe, gecontroleerde kandidaat met hogere code bouwen en intern testen. Een handmatige signing-only run maakt geen bewijs van een interne Play-upload en is dus geen tagpromotiekandidaat.

## 10. Gefaseerde uitrol voltooien, stoppen en herstellen

Voor een **latere update** kun je vóór het maken van de productietag `PLAY_ROLLOUT_FRACTION=0.1` instellen voor 10%. Die fractie blijft ingesteld totdat je de repositoryvariabele wijzigt. De eerste productiepublicatie volgt stap 4.

Een bestaande gefaseerde uitrol volledig beschikbaar maken:

```bash
gh workflow run fabelpad-play-production.yml \
  --repo fabelpad/platform --ref main \
  -f action=complete -f version_code=VUL-DE-ECHTE-ACTIEVE-VERSIECODE-IN
```

Een bestaande gefaseerde uitrol stoppen:

```bash
gh workflow run fabelpad-play-production.yml \
  --repo fabelpad/platform --ref main \
  -f action=halt -f version_code=VUL-DE-ECHTE-ACTIEVE-VERSIECODE-IN
```

Vervang de invulwaarde door uitsluitend de echte numerieke code, bijvoorbeeld de code uit het actieve rolloutscherm. Beide acties vereisen `main`, de eigen productieomgeving en de exacte actieve versie. Stoppen verwijdert de update niet van toestellen die hem al hebben. Een probleem na volledige uitrol vraagt een nieuwe gerepareerde AAB met **hogere versionCode**; de pipeline biedt geen downgrade naar een oude code. Beoordeel eventuele aanvullende herstelopties in de actuele Play Console afzonderlijk.

Om verdere automatische API-uploads/promoties te blokkeren, zet je als beheerder de vlag terug:

```bash
gh variable set FABELPAD_PLAY_ENABLED --repo fabelpad/platform --body false
```

Dit verandert geen al gecommitte Play-release en stopt geen lopende Google-review of reeds gestarte job. Controleer die status apart in Actions en Console; gebruik voor een actieve gefaseerde uitrol de passende `halt`-actie zolang de route nog beschikbaar is.

## 11. Gedrag bij retries, reviewconflicten en fouten

| Situatie | Exacte vervolgstap |
| --- | --- |
| Vereiste CI ontbreekt, is overgeslagen, loopt of faalt | Geen tagpromotie. Laat de originele main-pushrun van beide vereiste workflows op dezelfde volledige SHA werkelijk slagen. Een PR-run, handmatige run of andere SHA vervangt die niet. |
| Signing-only build slaagt, geen intern releasebewijs | Dit is een AAB voor handmatige upload. Voor de automatische tagroute is een geslaagde interne Play-upload van dezelfde main-pushrun nodig. |
| Workflow opnieuw uitvoeren na eerdere signing/upload | De run houdt dezelfde code en herstelt de bestaande AAB; de client vergelijkt de Play-hash. Verbind nooit andere bundelbytes aan die gebruikte code. |
| Google meldt `CHANGES_ALREADY_IN_REVIEW` | Laat de lopende review aflopen. Controleer daarna Console en voer alleen de nog benodigde actie opnieuw uit. De client gebruikt `ERROR_IF_IN_REVIEW` zodat hij de bestaande review niet annuleert. |
| Commitantwoord verloren of HTTP 5xx tijdens commit | Uitkomst is onzeker. Controleer eerst de echte track en versionCode in Play; start geen blinde nieuwe upload of promotie. |
| HTTP 401 | Controleer tokenverval en scope `androidpublisher`; maak geen token zichtbaar in logs. |
| HTTP 403 | Controleer ingeschakelde API, serviceaccountidentiteit, appselectie en beperkte Play-apprechten; voor WIF ook providerclaims/IAM-binding en propagatietijd. |
| HTTP 404 | Controleer pakket **nl.fabelpad.app**, de eerste handmatige upload, exact geretourneerde track-ID en de geldigheid van de tijdelijke edit. |
| Afwijkende targeting, meerdere te behouden codes of andere open draft/rollout | Het programma stopt om bestaande configuratie te behouden. Beoordeel de bedoelde releases en targeting in Console voordat een passende afzonderlijke wijziging wordt gemaakt. |
| Tag niet beschermd of bewijs verlopen | De automatische productiejob stopt. Herstel de concrete beschermings-/bewijsstap; sla de vrijgavecontrole niet over. |

Alle Play-schrijfjobs delen concurrencygroep **fabelpad-play-release**, met `queue: max`. Bestaande upload-/promotiejobs lopen uit; er zijn geen gelijktijdige edits vanuit deze workflows. Een geslaagde interne upload, een API-submit, een reviewstatus en beschikbaarheid blijven afzonderlijke resultaten. [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [Play edit commit en reviewgedrag](https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit)

## 12. Wat nog concreet ontbreekt

| Open stap | Wat al klaarstaat | Nog nodig |
| --- | --- | --- |
| Definitieve release-AAB | Productionconfig, eigen signing, build-/inspectiescripts en buildbewijsformaat. | Controleer de echte builduitslag bij de geleverde AAB en de toestelacceptatie; gebruik de actuele SHA/hash. |
| Privacyhosting | App-link en lokale pagina voor **https://fabelpad.nl/privacy**; export voorbereid in `artifacts/privacy/index.html`. | Toegang tot de echte hosting, openbare HTTP 200 zonder StackProtect/login, juridische uitgever/contact en feitelijke hosting-/logbewaartermijnen. |
| Store-beelden | Capturebrief en uploadvelden in het productie-invulblad. | Extern app-icoon, functieafbeelding, echte telefoon-/8-inch-/10-inchcaptures; eventueel launcher vervangen en AAB opnieuw bouwen. |
| Account en productievereisten | Pakket en productiescope bevestigd. | Accounttype/aanmaakdatum, verificatiestatus, handelaarsstatus en indien toepasselijk de echte gesloten-testresultaten/productietoegang. |
| Productkeuzes | Gratis lokale eerste versie, Nederlands, support- en privacybestemming bevestigd. De eigenaar heeft de doelgroepkeuze vastgelegd; de verplichte Console-vakken staan in D1 van het invulblad. Store-teksten en externe Store-beelden krijgen geen leeftijdsaanduiding. | Landen, gewenste publicatiedatum, geschiktheid voor de geselecteerde kindergroepen en resterende inhoudelijke IARC-antwoorden volgens het invulblad. |
| Google Cloud | Exacte WIF-opdrachten met geverifieerde repo-ID's. | Eigen Cloud-project-ID, bevoegde beheersessie en uitvoering van stap 5. |
| Google Play API | Client, tests en afzonderlijke interne-/productieroute voorbereid. | Eerste handmatige app/AAB-registratie, de twee appgebonden serviceaccountrechten en verificatie van de echte track-ID's. |
| GitHub-signing/automatisering | Twee workflows, veilige signinginterface, releasebewijs en releasepoorten. | Merge via review, twee environments, eigen signingsecrets, variabelen, bruikbare main-/tagbescherming en expliciete activering van de vlaggen op het juiste moment. |
| Herstel uploadsleutel | Primaire keystore/wachtwoord buiten Git en gescheiden root-only herstelkopie op dg-nxttrack-01; openen en overeenkomstig certificaat geverifieerd. | Eventueel aanvullende eigen herstelopslag van de eigenaar; bestaande gecontroleerde kopie behouden. |

Na deze eenmalige inrichting kan een latere opdracht aan Codex concreet zijn: **“Maak versie 1.0.1, test en merge via onze werkwijze, laat intern testen en promoveer na mijn vrijgave de gecontroleerde SHA naar productie.”** De beschermde releasetag is de concrete productiehandeling; een nieuwe Google-beleidstaak of testgate blijft zichtbaar en moet worden afgehandeld.
