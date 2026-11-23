# Ouderomgeving op Android — 23 november 2026

Deze herinrichting volgt de echte Android-prototypebron. De vier bestaande tabs
Ontdek, Schatkist, Wie speelt? en Ouders blijven bestaan. De recente verbonden
variant en de oorspronkelijke lokale app behouden hun eigen gegevensstromen.
De nieuwe build gebruikt versie `1.0.2`; het versionCode volgt het bestaande
releaseproces. Er zijn geen Play-uploadinstellingen of betaalschakelaars gewijzigd.

| Prototypeonderdeel | Native bestemming en bestaande gegevensbron |
| --- | --- |
| Compacte appbalk, boek en menu | `ParentAppBar.tsx`; bestaande `library`, `profiles`, `treasures` en ouderpoort in `App.tsx` |
| Kindprofielen bovenaan | `ParentOverview.tsx`; lokale `Store.profiles`, bijnaam, actief profiel en verdiende stempels |
| Toevoegen en bewerken | `profile-settings`; bestaande maximaal vijf profielen, twintig tekens, native datumkiezer en gedeelde kalender-/leesniveauregels |
| Leesinstellingen | Bestaande `calm` en `largeText` van het actieve profiel; Androids verminderde beweging blijft leidend |
| Offline verhalen en stem | Bestaande dertien gebundelde verhalen en native offline spraakmodule; uitleg via een native dialoog |
| Privacy, contact en wissen | Bestaande ouderlinks en bevestigde `clearDeviceData`; de verbonden variant wist ook aanmelding, downloads en ongedeelde voortgang |
| Online gezin | Bestaande `ConnectedParentArea` binnen Ouders; geen nieuwe account-, synchronisatie- of betaalkeuze |

De geboortedatum blijft voor nieuwe persoonlijke profielen verplicht volgens de
bestaande implementatie. Bestaande profielen zonder datum blijven bruikbaar.
Hiermee wijkt de echte validatie bewust af van het gesimuleerde prototype dat
de datum optioneel toont. Bewerkingen behouden leesroutes, favorieten, stempels,
verhaalversies en de expliciete handmatige leesniveaukeuze.

De ouderpoort blijft een lokale geboortejaarcontrole, geen identiteitscontrole.
De toegang vervalt na vijf minuten en bij achtergrond. Directe ouderbestemmingen,
terugnavigatie, menu en tabs gebruiken dezelfde controle. Terug sluit eerst het
menu of een native dialoog; een gewijzigd profielformulier vraagt voor verlaten
om bevestiging. Een laat antwoord van een gesloten datumkiezer wordt genegeerd.

## Geautomatiseerde controles

- `npm run check --prefix mobile`, `npm run test:runtime --prefix mobile` en
  `npm run check:native`: geslaagd. Gerichte regressies controleren de vier tabs,
  menu/terugvolgorde, directe ouderbestemmingen, vijfminutengrens, behoud van
  profielgegevens. De webfase van deze gedeelde checks vereist geen Expo- of
  React Native-installatie; de echte emulatorstart controleert de native React-runtime.
- `node --test scripts/billing/native-connected.test.mjs`: negen tests geslaagd,
  waaronder importtoestemming, vaste verhaalversies, voortgang na herstart,
  CAS-conflicten, volledig wissen en vertraagde antwoorden na uitloggen.
- Beide Android Metro/Hermes-exports zijn uitgevoerd. De app gebruikt bestaande
  illustraties; er zijn geen nieuwe native dependencies of productrechten.
- De bestaande Android-workflow bouwt nog steeds beide AAB-varianten. Een
  afzonderlijke job `Android-ouderomgeving op emulator` maakt met Google
  bundletool een tijdelijke test-APK uit de gratis AAB van dezelfde CI-run.
  Dit wijzigt geen uploadsigning, Play-release of betaalinstellingen.

De herbruikbare smoke staat in `scripts/native-ux-smoke.py`. Hij weigert een
fysiek toestel en vereist expliciet `--reset-test-data`. Op een geïsoleerde
emulator controleert hij koude offline start, vier tabs, ouderpoort, menu/terug,
native datumdialoog, profielopslaan/herstart, offline lezen, grotere systeemtekst,
landschap, de echte vijfminutengrens en de lokale wisbevestiging. Screenshots,
native UI-XML, crashlog en `report.json` worden ook bij een fout bewaard.

Voor lokaal gebruik met een al gestarte testemulator:

```sh
python3 -B scripts/native-ux-smoke.py --serial emulator-5554 \
  --apk /pad/naar/emulator-test.apk --output /tmp/fabelpad-parent-ux-evidence \
  --reset-test-data
```

Dit verwijdert uitsluitend de Fabelpad-testgegevens op die emulator. Gebruik het
niet voor een toestel met te bewaren gegevens. De CI-smoke gebruikt synthetische
profielgegevens, geen ouderaanmelding of Google Play-account.

## Grenzen van de acceptatie

De lokale host heeft geen `/dev/kvm`. Een teruggevonden API24-emulator kan via
software TCG/SwiftShader werken op 540×960 pixels en 240 dpi (360 dp breed).
Voor de lokale UI-controle is een expliciete test-APK samengesteld uit de native
binaries van main `4679d0e` en de actuele Hermes-bundel. Dit is aanvullend
runtimebewijs, geen bewijs voor de bytes of signing van een nieuwe release.
De CI-job gebruikt API35 x86_64/KVM en de exacte AAB van zijn eigen broncommit.

Een volledige lokale Gradle/AAB-build wordt door de bestaande voorcontrole
geblokkeerd bij minder dan 6 GiB vrije schijfruimte. TypeScript en een geslaagde
Metro-export vervangen die native build niet. Het CI-runresultaat is hiervoor
leidend.

Handmatig nog te controleren: TalkBack-spraak en focusvolgorde, echte gebaren,
fysieke telefoons/tablets, toetsenborden van andere fabrikanten, een werkelijk
geïnstalleerde Nederlandse offline stem en alle verhaalroutes. De UX-smoke doet
geen nieuwe connected-account-, cloud-, betaal- of Play-publicatietest.

Technische referenties: [Expo Metro](https://docs.expo.dev/guides/customizing-metro/),
[Google bundletool](https://developer.android.com/tools/bundletool) en
[Android-emulator](https://developer.android.com/studio/run/emulator-commandline).
