# Blog en SocialHero Connector v1

Dit document beschrijft het herbruikbare ontvangstcontract en de implementatiegrenzen. Het is geen bewijs dat een omgeving al is uitgerold. Het installatievoorbeeld staat in [examples/socialhero-blog/README.md](../examples/socialhero-blog/README.md).

## Onderdelen

| Onderdeel | Verantwoordelijkheid |
| --- | --- |
| `lib/socialhero/client.ts` | Koppelcode claimen en de bestaande verbinding verifiëren bij de vaste SocialHero-omgeving; DNS- en TLS-binding, geen redirects. |
| `lib/socialhero/errors.ts` | Veilige foutcodes, identifiers, SHA-256 en invoerhulpen. |
| `lib/socialhero/supabase.ts` | Edge-adapter voor gebruikers-RPC, service-RPC en private immutable Storage. |
| `lib/blog/runtime.ts` | Frameworkonafhankelijke `Request` → `Response` controller; pairing, media en publicatieherstel. |
| `lib/blog/document.ts`, `markdown.ts`, `types.ts` | Hetzelfde beperkte documentmodel voor de lokale editor en SocialHero-Markdown. |
| `lib/blog/media.ts` | Echte PNG/JPEG-decodering, grenzen vóór allocatie en hashes van de oorspronkelijke bytes. |
| `supabase/functions/blog-runtime/` | Deno-entrypoint, gepinde imports en lockfile. |
| `lib/server/blog.ts`, `app/api/` | Next.js-adapter met beheerderssessie, actorbinding en origincontrole. |
| Blogmigratie | Private opslag, onveranderlijke revisies, CAS, mappings, idempotentie, leases, rechten en duurzame wachtrijen. |

De controller accepteert `site`, `userClient(jwt)`, `serviceClient` en `storage.get/put`. `fetch`, `pairingTransport`, `now` en `background` kunnen expliciet worden geïnjecteerd. De standaard pairingtransport gebruikt echte DNS-resolutie en pint het TLS-socketadres. Een testtransport vervangt deze grens alleen in tests.

## Identiteit en rechten

Staging en productie hebben afzonderlijke Supabaseprojecten, website-origins en SocialHero-origins. `lib/blog/config.ts` is de vaste configuratie. De geïnstalleerde database-identiteit moet bij iedere controllerrequest exact overeenkomen met de ingestelde website. Een request kan geen andere bestemming kiezen via een queryparameter, body of header.

De actuele toegestane SocialHero-origins zijn `https://socialhero-staging.dgwebservices.nl` en `https://socialhero.dgwebservices.nl`. De transportlaag accepteert uitsluitend de vaste claim-/verify-paden. Hij weigert userinfo, query, fragmenten, redirects en niet-publieke DNS-antwoorden en pint de goedgekeurde lookup aan de TLS-verbinding. Claim en verify hebben een timeout en een antwoordgrens van 16 KiB.

Beheeracties gebruiken de werkelijke Supabasegebruikers-JWT. SQL controleert de actuele vertrouwde beheerder, bestaande sessie en accountstatus; koppelen, rechten wijzigen, ontkoppelen en publiceren vereisen recente authenticatie. Een SocialHerobearer is een opaque waarde van 43–1024 URL-veilige base64tekens. Alleen zijn SHA-256-hash bereikt de connector-RPC. Deze bearer wordt nooit als Supabase-JWT gebruikt. De koppelcode heeft wel exact 43 tekens.

Voor een **nieuwe** stabiele bestemming staan `allowDraft` en `allowPublish` beide aan, zichtbaar vóór de beheerder de koppeling bevestigt. De pairingbody bevat beide booleans verplicht. Een bestaande expliciete weigering blijft behouden bij opnieuw koppelen. Alleen een expliciete beleidswijziging past dat bestaande besluit aan. SQL hercontroleert de actuele rechten ook bij een idempotente herhaling, een mediafinalizer en de daadwerkelijke livewissel van een publicatie.

## HTTP-contract voor SocialHero

Alle paden hieronder zijn websitepaden. De Next-adapter stuurt ze door naar `/functions/v1/blog-runtime/socialhero/...`. Elk verzoek vereist `Authorization: Bearer <opaque bearer>`; tokens horen niet in een URL of JSON-body.

| Methode en pad | Invoer | Resultaat |
| --- | --- | --- |
| `GET /api/socialhero/v1/capabilities` | Geen | Contractversie, exacte site/omgeving/bestemming, credentialstatus, actuele scopes, auteurs, categorieën en medialimieten. Pending mag alleen dit endpoint gebruiken. |
| `POST /api/socialhero/v1/media` | `multipart/form-data` met precies één `file`; verplichte `Idempotency-Key` | `{assetId,mimeType,width,height}` na volledige decode, immutable upload, hash-readback en finalisatie. |
| `PUT /api/socialhero/v1/posts/{externalId}` | Markdownartikel; verplichte `Idempotency-Key` | `SocialHeroPostStatus`; nieuw artikel heeft `baseRevision:null`, een wijziging vereist de actuele revisie. |
| `GET /api/socialhero/v1/posts/{externalId}` | Geen | Actuele lokale revisie en status voor dezelfde stabiele bestemming. |
| `POST /api/socialhero/v1/posts/{externalId}/publish` | `{revision}`; verplichte `Idempotency-Key` | `200` met bevestigde status of `202` zolang zichtbaarheid nog wordt gecontroleerd. |
| `DELETE /api/socialhero/v1/connection` | Geen | `204`; trekt uitsluitend de bij deze bearer horende credential in. |

Een `externalId` en `Idempotency-Key` hebben 1–200 tekens: een alfanumeriek begin, gevolgd door alfanumerieke tekens of `_.:-`. Dezelfde sleutel en dezelfde invoer leveren hetzelfde opgeslagen resultaat. Een andere payload bij dezelfde sleutel geeft `IDEMPOTENCY_CONFLICT`. Een lokale bewerking kan `REVISION_CONFLICT` veroorzaken; SocialHero moet dan eerst de huidige status ophalen en de wijziging bewust verwerken.

Voorbeeld van de artikelbody:

```json
{
  "baseRevision": null,
  "type": "blog",
  "locale": "nl-NL",
  "title": "Samen voorlezen",
  "content": {"format": "markdown", "body": "## Een rustig begin\n\nLees samen een verhaal."},
  "excerpt": "Een praktisch begin met samen voorlezen.",
  "tags": ["voorlezen"],
  "seo": {"title": "Samen voorlezen", "description": "Praktische tips voor samen lezen."}
}
```

Optionele artikelvelden zijn `slug`, `authorId`, `categoryId`, `hero` en `ogImageAssetId`. Een hero gebruikt `{assetId,alt,focalPoint:{x,y}}`; zonder opgegeven focalPoint wordt het midden gebruikt. Nieuwe artikelen krijgen een slug uit de titel als die ontbreekt. Een titelwijziging behoudt de bestaande slug als `slug` ontbreekt. Een slugwijziging wordt pas live bij publicatie; eerdere slugs verwijzen daarna rechtstreeks naar de actuele URL. Inline afbeeldingen gebruiken `asset:<uuid>` of de exacte eigen `/api/blog/media/<uuid>`-URL. Externe afbeeldingen en uitvoerbare HTML komen niet in het opgeslagen document terecht.

`SocialHeroPostStatus` bevat `postId`, `externalId`, `slug`, `state`, `revision`, `draftRevision`, `publishedRevision`, `previewUrl`, `publicUrl` en `publishedAt`. De status is `draft`, `publishing` of `published`. Een bevestiging voor de ene revisie mag geen nieuwere conceptrevisie publiceren.

## Beheer en pairing

De beheerpaden beginnen met `/api/admin/blog`; de controller gebruikt `/admin/posts`, `/admin/authors`, `/admin/categories`, `/admin/media` en `/admin/connection`. Nieuwe en bestaande documenten lopen door dezelfde validator en dezelfde SQL-revisieservice als SocialHero.

1. De beheerder bevestigt `{code,allowDraft,allowPublish}` via `/connection/pair`.
2. `pair_begin` bewaart de poging en code tijdelijk in Vault. De server claimt bij het vaste SocialHero-origin met dezelfde `attemptId`.
3. `pair_pending` commit de specifieke connection/destination, credentialhash en tijdelijke bearer **vóór** remote verify. De remote callback kan nu uitsluitend pending capabilities lezen.
4. Na het exacte verifyantwoord activeert `pair_activate` de verbinding atomair, trekt de vorige specifieke credential in en verwijdert de tijdelijke geheimen.
5. Bij een onzekere netwerkuitkomst behoudt `pair_fail` de poging. `/connection/check` gebruikt `pair_resume` en dezelfde opgeslagen poging; er wordt geen tweede verbinding geclaimd als de eerste al pending is.

Vaultcodes, tijdelijke bearers, credentialhashes, Storagepaden en leases worden nooit in HTTP-resultaten of gebruikersmeldingen teruggegeven. De lokale interface toont en wijzigt de actuele scopes via `GET/PATCH /connection`; DELETE kan een specifieke `connectionId` intrekken. Een verouderd beheertabblad kan zo geen vervangende verbinding wijzigen.

Zonder open pairingpoging controleert `/connection/check` de actuele lokale beheer-/sessierechten en actieve verbinding via `connection_check` en werkt `lastCheckedAt` bij. Dit is een lokale autorisatiecontrole; de bestaande remote API heeft geen algemeen healthendpoint. De Edge-adapter logt gestructureerd requestId, methode, routepatroon, status en veilige foutcode. Identifiers, queryparameters, bodies, headers en geheimen worden daarbij niet gelogd.

## RPC-contract voor een adapter

Alle inputs en DTO's gebruiken camelCase JSON. De vier publieke dispatchers zijn uniek benoemd, `SECURITY INVOKER` en hebben gerichte grants. Private functies doen de beperkte geautoriseerde transacties; clients krijgen geen directe tabelrechten.

| Dispatcher | Identiteit | Acties |
| --- | --- | --- |
| `blog_public(p_action,p_input)` | Anon/authenticated/service | `site`, `catalog`, `post`, `media`, `sitemap`. Media alleen bij een actuele liveverwijzing. |
| `blog_admin(p_action,p_input)` | Werkelijke authenticated gebruikers-JWT | `list`, `get`, `preview`, `save`, `restore`, `taxonomy`, `media_reserve`, `media_get`, `publish`, `connection_status`, `connection_check`, `connection_policy`, `connection_revoke`, `pair_begin`, `pair_pending`, `pair_resume`. |
| `blog_connector(p_token_hash,p_action,p_input)` | Alleen service-role; opaque bearerhash als argument | `capabilities`, `get`, `put`, `media_reserve`, `publish`, `revoke`. Site en bestemming worden uit de credential afgeleid. |
| `blog_service(p_action,p_input)` | Alleen service-role | `pair_context`, `pair_activate`, `pair_fail`, `media_context`, `media_complete`, `publication_claim`, `publication_promote`, `publication_confirm`, `publication_fail`, `worker_verify`, `cleanup`. |

`save` neemt `{postId:null|uuid,baseRevision:null|number,document}`; `restore` neemt `{postId,baseRevision,revision}` en maakt een nieuwe revisie. `taxonomy` neemt `{kind,id:null|uuid,name,bio?,active?}` en retourneert `{record}`; HTTP geeft alleen het record terug.

Een mediareservatie bevat `{assetId,mimeType,width,height,byteLength,sha256,objectPath,leaseId,complete}`. Dit is serverinformatie. De controller vergelijkt deze metadata met de werkelijk gedecodeerde afbeelding voordat hij uploadt. `media_complete({assetId,leaseId})` hercontroleert de oorspronkelijke sessie/credential en rechten. Een verloren uploadantwoord wordt hersteld door bestaande bytes te lezen en hun exacte lengte en SHA-256 te controleren; een object wordt niet overschreven.

`publication_claim({publicationId?})` retourneert `{claim:null|context}`. `publication_promote({publicationId,leaseId})` retourneert **rechtstreeks** dezelfde context: `{publicationId,leaseId,postId,revision,publicUrl,proof,alreadyPromoted}`. Promote controleert CAS en actuele authority en wisselt dan de exacte livepointer. `publication_confirm({publicationId,leaseId,proof})` volgt pas op de echte HTTP-proef. `publication_fail` bewaart een begrensde retry met backoff. Deze envelopes zijn bewust verschillend.

## Media en publicatiecontrole

Alleen PNG en JPEG worden geaccepteerd: maximaal 8 MiB, 8.000.000 pixels en 6000 pixels per zijde. Afmetingen worden vóór de decoder gecontroleerd. PNG heeft CRC-controle en een streaming IDAT-grens op de exact toegestane scanlinebytes, ook voor Adam7. APNG wordt geweigerd zodat verborgen animatieframes niet buiten de validatie vallen. JPEG gebruikt strikte decode en een geheugengrens. MIME, extensie of uploadnaam geldt niet als bewijs van veilige inhoud.

De bucket `fabelpad-blog` is private. Objectpaden zijn immutable `blog/<assetId>/<sha256>.png|jpg`. Publieke media wordt via de website gecontroleerd en met de juiste image-MIME en `nosniff` geleverd; conceptmedia vereist actuele beheerrechten. Geen signed URL of Storagepad bereikt de artikelbody.

Een publicatie is eerst `publishing`. De worker vraagt de werkelijke vaste website-URL op, zonder redirects, met timeout en begrensde HTML. De actieve `<article>` moet exact deze beide attributen bevatten:

```html
<article data-blog-revision="POST_UUID:REVISION" data-blog-proof="OPAQUE_PUBLICATION_PROOF">
```

Een generieke HTTP 200, oudere revisie, dubbele overeenkomende artikelen, comments, templates en scriptvoorbeelden bevestigen niets. Na een tijdelijke fout blijft de opgeslagen taak hervatbaar; er is geen nieuwe artikelgoedkeuring nodig voor een eerder toegestane SocialHeropublicatie. Een ingetrokken publishscope blokkeert de livewissel, ook als de taak eerder is klaargezet.

De eigen cronworker gebruikt een Vault-HMAC, geen handmatig Next-/Edgegeheim. Hij accepteert alleen een recente timestamp, een eenmalige UUID-nonce en een geldige handtekening over project en exacte bodyhash:

```text
fabelpad-blog-worker-v1\nPROJECT_REF\nTIMESTAMP\nNONCE\nSHA256_EXACT_BODY
```

De headers zijn `x-fabelpad-timestamp`, `x-fabelpad-nonce` en `x-fabelpad-signature`. Een aanroep verwerkt maximaal drie taken en ruimt verlopen pairinggeheimen op.

## Fouten en controles

Een foutantwoord bevat `{code,message,requestId,fieldErrors?}` en `private, no-store`. Relevante codes zijn `INVALID_CREDENTIAL` (401), `PERMISSION_DENIED` (403), `POST_NOT_FOUND` (404), `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `DESTINATION_MISMATCH` en `PAIRING_IN_PROGRESS` (409), `PAIRING_EXPIRED` (410), `INVALID_CONTENT`/`INVALID_MEDIA` (422), `RATE_LIMITED` (429) en een veilige beschikbaarheidsfout (503). `fresh_auth_required` vraagt opnieuw aanmelden. Waar van toepassing komt `Retry-After` mee. Ruwe upstream- of SQLfouten worden niet gepubliceerd.

De lokale tests gebruiken synthetische credentials en fixturedata:

```sh
node --test scripts/blog/connector.test.mjs scripts/blog/media.test.mjs scripts/blog/runtime.test.mjs
node --test scripts/blog/database.test.mjs scripts/blog/runtime-database.test.mjs
deno check --config supabase/functions/blog-runtime/deno.json supabase/functions/blog-runtime/index.ts
```

Controllerproeven gebruiken een echte lokale HTTP-callback en echte decode. De database-integratieproef koppelt de controller aan de geïnstalleerde PGlite-dispatchers, inclusief Vault-resume, immutable uploadherstel, CAS, actuele scopes en SQL-ondertekende publicatieherhaling. Hosted Edge, echte SocialHeropairing en publieke stagingweergave hebben aanvullend omgevingsbewijs nodig.

Supabase gebruikt voor een endpoint met eigen machine-/HMAC-authenticatie `verify_jwt=false`; deze controller controleert vervolgens iedere route zelf. Achtergrond: [Edge Function authentication](https://supabase.com/docs/guides/functions/auth) en [authorization headers](https://supabase.com/docs/guides/functions/auth-headers). De bestaande projectconfiguratie blijft leidend; het [Supabasechangelog](https://supabase.com/changelog) beschrijft onder meer de nieuwe CLIconfiguratie voor nieuwe projecten.
