# Ouderomgeving en platformbeheer — 23 november 2026

Deze herinrichting gebruikt de bestaande gegevens, autorisatie, routes en native schermen. De drie privéprototypes dienden als visuele referentie; hun voorbeeldgegevens, financiële grafieken en gesimuleerde acties zijn niet overgenomen. De basis is main `4679d0e3228a9a00e9b7db640a6fcf06da2c8fff`, inclusief het recentere abonnements- en kortingscodewerk.

| Ontwerp | Werkelijke ingang en gegevensbron |
| --- | --- |
| Web Mijn gezin | `/gezin?ouders=1`, `/ouders` schakelt volgens de bestaande datamodus door; `FamilyExperience`, `CloudBoundary`, familie-API en oudertoestemming |
| Lokaal web | `/ouders`, `ParentDashboard`, bestaande apparaatopslag en ouderpoort |
| Account en herstel | `/profiel/account`, `/profiel/account/herstellen`, bestaande lifecycle-/auth-API, synchronisatieclient en privacyacties |
| Native ouders | `parent`, `parent-gate`, `profiles`, `profile-settings`, `library`; React Native en bestaande AsyncStorage-/sessieopslag |
| Beheercockpit | `/studio/overzicht`; echte catalogus en links naar de beheermodules |
| Verhalen | `/studio`; bestaande concepten, revisies, lokale eigenaargebonden herstelkopie en bevestigde publicatie |
| E-mail | `/studio/email`; bestaande Resend-/Vault-configuratie, DNS-controle en testmail |
| Templates | `/studio/email/templates`; dezelfde 13 authenticatie- en 4 servicetemplates, preview, wijzigen/resetten, Auth-HTML kopiëren/downloaden |
| Privacy | `/studio/privacy`; bestaande beperkte metadata, serverpaginering en toegestane statusacties |
| Bestaande betalingen | `/studio/betalingen`, `/studio/premium`, `/profiel/abonnement`; behouden en opgenomen in de navigatie |

## Gedrag en bewuste ontwerpkeuzes

De compacte boek-/menunavigatie heeft toegankelijke labels, actuele bestemming, Escape-/buitenklikbediening en focusherstel. Profielen staan bovenaan, met één bewerkactie per rij en toevoegen bij de kop. Geboortedatum en leesniveau blijven in de profielbewerking. Maximaal vijf profielen en twintig tekens blijven gelden.

Online intrekking gebeurt pas na bevestiging via de bestaande serveractie. De synchronisatie blokkeert verouderde writes, verwijdert de bevestigde profielkopie en haalt de gezaghebbende servergegevens op. Een mislukte herlaadactie blijft zichtbaar en blokkeert hervatting; wijzigingen en leesactiviteiten voor andere kinderen blijven bewaard. Late antwoorden kunnen het ingetrokken profiel niet terugplaatsen.

De beheercockpit toont alleen beschikbare catalogusgegevens en echte bestemmingen. Er zijn geen verzonnen omzet-, gebruikers- of mailaantallen. De Studio maakt alle 31 paden bereikbaar, terwijl de bestaande gegevensstructuur één hoofdstukoverride per deel bewaart. De interface benoemt dit; een aparte tekst voor ieder keuzepad zou een inhoudelijke modelwijziging zijn. `baseRevision`, 409-conflicten, download/herstel en expliciet publiceren blijven onderdeel van de normale editor.

De privacyzoek-/statusfilters gelden voor de geladen serverpagina. De server levert offsetpaginering; de interface suggereert daarom geen volledige serverzoekfunctie. Zaken bevatten uitsluitend de reeds toegestane technische velden.

Alle beheerroutes controleren op de server een door Auth geverifieerde ouder, actieve actuele accountstatus en `content_admins`. De actie-API's herhalen hun eigen autorisatie en binden wijzigingen aan het beheeraccount dat de editor opende. Een sessie- of rolwissel wist de open editor en ingevulde sleutel; late antwoorden herstellen die niet. Een beperkte Next Proxy ververst de sessiecookie vóór de serverrender en geeft vernieuwde cookies door aan de browser. De expliciete lokale modus behoudt de bestaande lokale/onbeschikbare schermen en geïsoleerde browsertestfixtures; een ongeldige cloudconfiguratie faalt gesloten.

Android behoudt de gratis lokale variant en de reeds afzonderlijk bestaande gekoppelde variant. Deze opdracht voegt geen nieuwe provider, checkout of cloudproductkeuze toe. De vier tabs, geboortejaarpoort van vijf minuten, geboortedatumkiezer, leesniveau, lokale voortgang en wisbevestiging blijven gelden. De Play-publicatieconfiguratie en de bestaande uitgeschakelde betaal-/foundersflags blijven behouden.

## Controle en grenzen

De volledige lokale repositorycontrole is geslaagd via `scripts/local-build.sh`: configuratie, typen, content, database/API, e-mail, betalingen, deploymentcontracten, native runtime en Next.js-productiebuild. Alle 116 Playwright-tests slagen op de productiebuild. Ze controleren de webomgeving op 320, 390, 768 en desktopbreedte; de nieuwe regressies behandelen menu/focus, profielbewerking, toestemming en herlaadfouten, Studio-conflicten/herstel, templates en beheerrechten.

De Android-CI bouwt de bestaande lokale en gekoppelde AAB's. Een nieuwe afzonderlijke emulatorjob gebruikt de echte gebouwde lokale AAB met een tijdelijke emulatorhandtekening, controleert de native interface via adb/uiautomator en bewaart screenshots, UI-XML en logcat. Die testsigning is geen Play-upload- of app-signingcertificaat.

Geïsoleerde tests vervangen geen echte mailboxbezorging, OAuth-login, twee fysieke apparaten, handmatige TalkBack-gebaren of een geïnstalleerde Nederlandse offline stem. Resultaten van productieactivatie, exact geteste release en Android-artefacten horen in het afzonderlijke uitrolbewijs; een geslaagde build wordt niet als Play-publicatie beschreven.
