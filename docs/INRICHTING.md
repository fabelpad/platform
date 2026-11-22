# Fabelpad — inrichting en configuratie

Bijgewerkt: **22 november 2026**. De eigenaar heeft beide Fabelpad-omgevingen en de twee bedoelde Supabase-projecten vrijgegeven voor inrichting. Zie de [actuele status](STAGING-PRODUCTION-STATUS.md) voor uitgevoerd werk en resterende acceptatie.

## Vier GitHub-variabelen per environment

Ga naar **fabelpad/platform → Settings → Environments → staging / production → Environment variables**. Beide environments bestaan en bevatten exact deze vier variabelen.

| Naam | Staging | Production | Fase |
| --- | --- | --- | --- |
| `FABELPAD_APP_ORIGIN` | `https://staging.fabelpad.nl` | `https://fabelpad.nl` | Publieke build- en runtimeconfiguratie |
| `FABELPAD_DATA_MODE` | `supabase` | `supabase` | Build/runtime, zonder stille lokale fallback |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tlwfpivafcokcjyjwgmq.supabase.co` | `https://aptprpkosqctwrzeetgs.supabase.co` | Publiek, buildtijd |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Key van **fabelpad / fabelpad-staging** | Key van **Duindorpdoet / fabelpad-production** | Publiek, buildtijd; eigen environment |

Dit zijn geen secrets. Geen secret/service-role/databasekey in NEXT_PUBLIC-velden. RLS en beperkte RPC's begrenzen clientrechten. Publieke waarden worden ingebakken: gewijzigde origin, modus of Supabase-configuratie vereist een nieuwe kandidaat/configuratie-ID.

## Afgeschermde configuratie buiten GitHub

| Naam / gegeven | Bron en opslag | Gebruik |
| --- | --- | --- |
| Resend-key | Na eerste beheeropslag: eigen **Supabase Vault**. Optionele API-bootstrap vóór de eerste beheeropslag: `RESEND_API_KEY` in Edge Secrets; Auth-SMTP is hiervan onafhankelijk | Alleen Edge-mailfunctie ontsleutelt; nooit build, browserresponse of GitHub-variable |
| `SEND_EMAIL_HOOK_SECRET` | Alleen bij een later afzonderlijk gekozen Send Email Hook; niet nodig voor de huidige SMTP-route | Niet instellen of activeren voor deze release |
| Afzender / `FABELPAD_EMAIL_FROM` | Beheer → E-mail; Edge-waarde alleen voor bootstrap | Geverifieerd adres, bewerkbare naam; staging krijgt altijd testmarkering |
| Antwoordadres / `FABELPAD_EMAIL_REPLY_TO` | Beheer → E-mail; Edge-waarde alleen voor bootstrap | Antwoorden naar de ingestelde support-inbox |
| `FABELPAD_APP_ORIGIN` | Eigen canonieke origin hierboven; ook Edge-configuratie | Bindt ondertekende mail aan de juiste omgeving |
| `FABELPAD_ENVIRONMENT` | `staging` of `production`, Edge-configuratie | Zichtbaar testkenmerk en gescheiden idempotentie |
| Supabase Management PAT | Afgeschermde toegang van het account dat het bedoelde project beheert | Alleen tijdelijk in geheugen van configuratietool |
| `GITHUB_TOKEN` | Kortlevend, automatisch binnen Actions | Bron-/CI-/workflowcontroles; nooit in app of buildproces |

De Edge-configuratienamen zijn **geen extra GitHub-variabelen**. Supabase bewaart functieconfiguratie onder Secrets. De configuratietool vraagt keys verborgen in een eigen terminal; geen keys, PAT's, OTP's of wachtwoorden in chat, argumenten of documenten.

De webserver gebruikt gebruikerssessies en RLS. Next-build en normale runtime vereisen geen service-role key, databasewachtwoord of Resend-key.

**Beheer → E-mail** (`/studio/email`) verzorgt Resend-koppeling en test; **Beheer → E-mailtemplates** (`/studio/email/templates`) bevat alle 17 templates. Na de eerste geaccepteerde opslag is de Vault-configuratie leidend. De automatische servicecredential blijft uitsluitend binnen de Edge-runtime. Zie [EMAIL-BEHEER.md](EMAIL-BEHEER.md) voor eerste login, de twee gescheiden omgevingen en sleutelrotatie.

## Hostmetadata en OTP-gate

Paden, service, Node/pnpm, poorten en runnerlabels staan in het beoordeelde root-owned hostprofiel. SHA, workflowrun/poging en configuratie-ID komen uit de releaseprocedure. De vorige gezonde app/configuratie blijft beschikbaar voor herstel.

De adapter zet `FABELPAD_AUTH_EMAIL_ENABLED=true` en, bij het gecontroleerde v2-configuratiebewijs, `FABELPAD_AUTH_GOOGLE_ENABLED=true`. Het root-owned `email-readiness.json` bindt omgeving, origin en Supabase-URL aan de gecontroleerde publieke providerinstellingen en de SMTP-/OTP-verklaring van de eigenaar. Dit zijn geen extra GitHub-variabelen. De v2-ontvangst vermeldt expliciet `requires-interactive-owner-test`: werkelijke OTP-bezorging, codebevestiging, Google-login, sessie en beheerderacceptatie blijven afzonderlijk te testen. Een instellingencontrole of HTTP-sendresultaat is geen inbox- of loginbewijs.

## Mail afronden

Volg [EMAIL-CONFIGURATIE.md](EMAIL-CONFIGURATIE.md) voor de veilige tool en [EMAIL-TEMPLATES.md](EMAIL-TEMPLATES.md) voor de plakbestanden. De actieve Auth-route is **Supabase Auth → Custom SMTP → Resend**, door de eigenaar ingericht en in deze release behouden. Activeer geen Send Email Hook. De afzonderlijke applicatieservicemails gebruiken de Resend API en hun eigen Vault-koppeling; SMTP levert deze key niet automatisch aan de applicatie.

Voorstel: `noreply@fabelpad.nl`. Dit adres is pas inzetbaar na controle van Resend-verzenddomein, DNS en verzendrechten. Controleer DKIM/SPF/DMARC. Laat open-/kliktracking voor OTP uit. API-acceptatie bewijst geen aflevering in de mailbox.

## Resterende gegevens en acceptatie

1. De bevestigde 180 dagen voor back-ups, Stackmail, maximaal 12 maanden na afsluiting voor gewone supportmail en de verwerkers-/doorgifteafspraken zijn verwerkt in de uitgerolde privacyversie `2026-11-22.1`; zie `PRIVACY-AANVULLING-180-DAGEN.md`. Staging is via HTTPS bereikbaar; productie draait intern. Providerlogcriteria, daadwerkelijke mailboxopschoning en het weigeren van onvoldoende gedekte herstelpunten blijven afzonderlijke uitvoeringscontroles.
2. Plaats per omgeving de eigen Resend API-key veilig via **Beheer → E-mail**, na de eerste echte beheerderlogin; zie de optionele API-bootstrap hieronder. De werkende Auth-SMTP-route levert geen API-key voor servicemails.
3. Rond echte OTP-/Google-/beheerder-/gezins-/studioacceptatie af. Configuratiecontrole, synthetische tests en loopbackhealth zijn afzonderlijke resultaten.
4. Bouw en activeer elke kandidaat volgens de exact-SHA-route en controleer de eigen service, proxy/TLS en publieke routes volgens het [hostrunbook](DG-VPS-08-TWEE-OMGEVINGEN.md). De [actuele status](STAGING-PRODUCTION-STATUS.md) vermeldt welke stappen werkelijk zijn uitgevoerd.

De repositoryspecifieke runners zijn al geregistreerd: staging ID 21 en production ID 22, met eigen accounts en labels. Een organisatiebrede runnergroep of extra GitHub-variabele is voor deze route niet nodig. Beide bestaande GitHub environments blijven behouden. Er wordt geen betaald abonnement aangegaan.

## Database en Android

Beide Supabase-projecten waren leeg. Beide projecten bevatten nu **tien** gecommitte migraties met gecontroleerde identiteiten en de 13 eerdere contentreleases. De laatste twee migraties voegen de nieuwe privacyversie en vaste 210-dagenbewaring voor minimale account-/profielwisbewijzen toe. Zie het [Supabase-contract](../supabase/README.md), het [eerdere contentbewijs](deploy-evidence/supabase-2026-11-22.json), het [lifecyclebewijs](deploy-evidence/google-legal-lifecycle-2026-11-22.json) en de [laatste live databasecontrole](deploy-evidence/privacy180-supabase-live-2026-11-22.json). Latere wijzigingen bij echte gebruikers vereisen een passende backup-, herstel- en compatibiliteitscontrole; approllback herstelt geen database/provider.

De lokale native productie-app `nl.fabelpad.app` gebruikt geen Supabase/Resend; zie het [afzonderlijke Play-proces](GOOGLE-PLAY-RELEASE-RUNBOOK.md).


## Optionele API-bootstrap zonder de SMTP-route te wijzigen

Als servicemails al vóór de eerste beheeropslag moeten werken, kan de eigenaar per bedoeld Supabase-project onder **Edge Functions → Secrets** `RESEND_API_KEY`, `FABELPAD_EMAIL_FROM` en `FABELPAD_EMAIL_REPLY_TO` afgeschermd plaatsen. Gebruik de eigen geverifieerde afzender en voor staging de naam Fabelpad Staging; het antwoordadres is `support@fabelpad.nl`. Dit zijn Supabase Edge-instellingen, geen GitHub-variabelen. Deel geen key in chat of logs. De bestaande Vault-configuratie blijft altijd leidend zodra deze aanwezig is; bij een leesfout wordt niet teruggevallen op oude credentials.

De API-bootstrap is optioneel en wordt niet door deze opdracht met ontbrekende keys voorgewend. De normale beheerroute blijft: werkelijk registreren/aanmelden als `info@dgwebservices.nl`, ouderonboarding afronden, **Beheer → E-mail** koppelen en de testmail controleren. Verander hiervoor geen werkende Supabase Custom SMTP-instellingen. Controleer voor beide omgevingen afzonderlijk API-afzenderrechten en uitgeschakelde open-/kliktracking. Een geslaagde provideracceptatie bewijst nog geen inboxbezorging.
