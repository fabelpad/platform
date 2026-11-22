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
| Resend-key | Na eerste beheeropslag: eigen **Supabase Vault**. Vóór eerste login: `RESEND_API_KEY` in Edge Secrets als bootstrap | Alleen Edge-mailfunctie ontsleutelt; nooit build, browserresponse of GitHub-variable |
| `SEND_EMAIL_HOOK_SECRET` | Cryptografisch gegenereerd per project; Auth Hook en Edge Secrets moeten overeenkomen | Auth/HMAC-verificatie; verschillende secrets per omgeving |
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

De adapter zet `FABELPAD_AUTH_EMAIL_ENABLED=true` na een root-owned `email-readiness.json` voor dezelfde omgeving, origin en Supabase-URL. Dit is geen extra GitHub-variable. Google blijft uit. Leg de ontvangst pas aan na echte OTP-aanvraag, bezorgcontrole, sessiecontrole en beheerderacceptatie. De zelfstandige terminalproef kan dit vóór een eerste kandidaat bewijzen; de app-/studioflow volgt na kandidaatbouw. Alleen een HTTP-sendresultaat is onvoldoende.

## Mail afronden

Volg [EMAIL-CONFIGURATIE.md](EMAIL-CONFIGURATIE.md) voor de veilige tool en [EMAIL-TEMPLATES.md](EMAIL-TEMPLATES.md) voor de plakbestanden. De actieve route is **Supabase Auth → ondertekende Edge Function → Resend API**; er is geen parallel ingestelde SMTP-route.

Voorstel: `noreply@fabelpad.nl`. Dit adres is pas inzetbaar na controle van Resend-verzenddomein, DNS en verzendrechten. Controleer DKIM/SPF/DMARC. Laat open-/kliktracking voor OTP uit. API-acceptatie bewijst geen aflevering in de mailbox.

## Resterende toegang en acceptatie

1. Afgeschermde Resend API-key en Supabase-beheertoegang voor Auth/mailinstellingen, of de eigenaar voert de verborgen terminalconfiguratie uit. De workspaceconnector biedt SQL/Edge, maar geen Authconfiguratie/secretbeheer.
2. Geverifieerd eigen verzenddomein, DNS-toegang als verificatie ontbreekt, en bereikbare support-inbox.
3. GitHub-organisatiebeheer voor een runnergroep met alleen deze repo en geselecteerde main-workflows. De huidige API geeft 403 en mist `admin:org`; geen onbegrensde runner als omweg registreren.
4. Daarna echte OTP-/beheerder-/gezins-/studioacceptatie, main-CI en aparte kandidaatbouw per doel. Vervolgens eigen service, DNS/proxy/TLS en publieke acceptatie volgens [hostrunbook](DG-VPS-08-TWEE-OMGEVINGEN.md).

Er wordt geen betaald abonnement aangegaan. De environments bestaan; eerdere opmerkingen dat ze nog aangemaakt moeten worden zijn historisch.

## Database en Android

Beide Supabase-projecten waren leeg. Nu zijn de twee schemawijzigingen toegepast, met 13 bronreleases per project en migratie-identiteiten gelijk aan de bestanden. Zie [Supabase-contract](../supabase/README.md) en [bewijs](deploy-evidence/supabase-2026-11-22.json). Latere wijzigingen bij echte gebruikers vereisen een passende backup-, herstel- en compatibiliteitscontrole; approllback herstelt geen database/provider.

De lokale native productie-app `nl.fabelpad.app` gebruikt geen Supabase/Resend; zie het [afzonderlijke Play-proces](GOOGLE-PLAY-RELEASE-RUNBOOK.md).
