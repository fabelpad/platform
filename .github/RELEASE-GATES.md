# Releasevoorwaarden

De opdracht van 11 november 2026 bereidt het nieuwe doel
**fabelpad-nxttrack-staging op dg-nxttrack-01** voor. Er is geen toestemming
voor eerste activatie, verplaatsing of publieke ingebruikname.
Het uitvoerbare contract staat in [het doelrunbook](../docs/DEPLOY-DG-NXTTRACK-01.md).

- Alleen fabelpad/platform, integratiebranch main, volledige commit-SHA.
- De nieuwste push-run van verify.yml op precies die SHA moet volledig geslaagd
  zijn, inclusief de actuele poging, verify-job en verplichte stappen.
- Alleen de twee handmatige Fabelpad-doelworkflows mogen op de eigen runner
  draaien. Registratie blijft uit tot een geselecteerde-workflowbeperking op
  refs/heads/main aantoonbaar geldt. Labels alleen zijn onvoldoende.
- Kandidaatbouw en activering zijn afzonderlijke workflows; bouwen wisselt geen
  current en start geen appservice.
- Activatie vereist de vooraf ingerichte beschermde environment
  fabelpad-nxttrack-staging met reviewers, prevent_self_review en main-branchpolicy.
- De geverifieerde Milo-wrapper en alle bestaande omgevingen blijven ongemoeid.
  De nieuwe root-owned adapter gebruikt eigen accounts, paden, lock en poort.
- Publieke buildconfiguratie en runtimeconfiguratie zijn gescheiden,
  onveranderlijk geïdentificeerd en bij dezelfde release gekoppeld. Geen secrets
  in bron, artefacten, logs, procesargumenten of buildaccount.
- Geen migraties in appworkflows. Databasewijzigingen vereisen een apart
  compatibiliteits-, backup- en herstelcontract voor het bevestigde eigen project.
- Loopbackhealth bewijst alleen procesliveness. Echte Auth/RLS/sync/mailacceptatie
  en HTTPS-readiness zijn aanvullende voorwaarden.

De workflows en scripts in een reviewbranch zijn geen release op main. Een
voorbereide unit of proxytemplate is geen actieve service of publiek domein.
