# SocialHero-ontvanger installeren of hergebruiken

Dit is het installatievoorbeeld bij [het volledige connectorcontract](../../docs/BLOG-SOCIALHERO-CONNECTOR.md). De module is een servercomponent. Plaats servicecredentials en de Storage-adapter nooit in een browserbundle.

## Bestaande Fabelpadinstallatie

1. Installeer de gelockte Node-afhankelijkheden en gebruik de Nodeversie uit het repository. Voor Edge staan de exacte npm-imports en integriteitshashes in `supabase/functions/blog-runtime/deno.json` en `deno.lock`.
2. Pas de gereviewde blogmigratie toe op de bedoelde omgeving. Bootstrap als database-eigenaar de expliciete site-identiteit. Voor staging is dat:

   ```sql
   select private.configure_blog_installation(
     'staging',
     'https://staging.fabelpad.nl',
     'tlwfpivafcokcjyjwgmq',
     'https://socialhero-staging.dgwebservices.nl',
     'https://fabelpad.nl'
   );
   select private.configure_blog_worker_schedule();
   ```

   De tweede functie maakt/verifieert de private bucket en stelt de zelfstandige cronworker met een Vault-HMAC in. Gebruik geen losse, handmatig geplakte workerkey. Controleer vóór uitvoering de bestaande identiteit en het geselecteerde project; de functie weigert een tegenstrijdige gevestigde identiteit.
3. Configureer op **Edge** `FABELPAD_ENVIRONMENT=staging` en `FABELPAD_APP_ORIGIN=https://staging.fabelpad.nl`. De Supabase-URL, service-rolekey en anon-/publishablekey komen uit de bestaande Edge-omgeving. `SB_SECRET_KEY` wordt als compatibele serverfallback ondersteund. Geen van deze servercredentials hoort in Next `NEXT_PUBLIC_*`.
4. Deploy het entrypoint `supabase/functions/blog-runtime/index.ts` met JWT-gatewaycontrole uit voor deze ene functie. Het endpoint ontvangt zowel gebruikers-JWT's, opaque SocialHerobearers als HMAC-workerrequests en controleert die zelf. Ontdek de vlaggen van de geïnstalleerde CLI met `supabase functions deploy --help`; geef het bedoelde project expliciet op. Dit voorbeeld voert geen deployment uit.
5. Configureer de Next-adapter met dezelfde vaste site-origin en publieke Supabaseconfiguratie. De adapter stuurt de echte beheer-JWT door en heeft geen service-rolekey nodig. Behoud de bestaande actorbinding, accountcontrole en origincontrole.
6. Lever op publieke artikelen de exacte revisie- én proofattributen uit het public-RPC-resultaat. Alleen dan kan de worker de werkelijke websiteweergave bevestigen. Controleer ook dat concepten niet in catalogus, sitemap of publieke media verschijnen.
7. Laat de beheerder bij een nieuwe bestemming de zichtbare concept- en publicatierechten bevestigen, voer de koppelcode in en gebruik bij een onzekere uitkomst de bestaande controle-/hervatactie. Opnieuw koppelen behoudt eerdere expliciete opt-outs.

## Factory in een andere serveradapter

De kern heeft geen Next.js-afhankelijkheid. Een adapter kan de factory rechtstreeks gebruiken:

```ts
import { createBlogRuntimeHandler } from '../../lib/blog/runtime.ts';
import { createBlogSupabaseDependencies } from '../../lib/socialhero/supabase.ts';

// edgeEnvironment wordt alleen op de server uit de bestaande configuratie gelezen.
const dependencies = createBlogSupabaseDependencies(edgeEnvironment);
const handle = createBlogRuntimeHandler({
  ...dependencies,
  background: task => EdgeRuntime.waitUntil(task),
});

// Forward de originele Authorization, Content-Type, Idempotency-Key en body.
// De route ligt vast; een client mag geen eigen target-URL kiezen.
Deno.serve(handle);
```

Voor een andere database kun je `userClient(jwt)`, `serviceClient` en `storage` zelf implementeren. `rpc(name,parameters)` levert `{data,error}`; zie de vier dispatchers en envelopes in het contractdocument. De adapter moet CAS, idempotentie, actuele autorisatie, immutable revisions, mediafinalisatie en publicatieleases duurzaam en atomair bewaren. Een geheugenmap is alleen geschikt als testfixture.

Een andere **website-identiteit** vraagt expliciete aanpassing van de vertrouwde siteconfiguratie en SQL-bootstrap; Fabelpads bestaande identiteit mag niet worden hernoemd. De SocialHeropairingcode blijft aan dezelfde vooraf bekende website-origin en omgeving gebonden. Maak de vaste remote-originallowlist nooit afhankelijk van een gebruikersveld.

## Controle vóór aansluiting

```sh
node --test scripts/blog/connector.test.mjs scripts/blog/media.test.mjs scripts/blog/runtime.test.mjs
node --test scripts/blog/database.test.mjs scripts/blog/runtime-database.test.mjs
deno check --config supabase/functions/blog-runtime/deno.json supabase/functions/blog-runtime/index.ts
```

Deze proeven maken geen echte SocialHeroverbinding. Verifieer de eigen hosted configuratie en de echte publieke artikelweergave afzonderlijk. Bewaar alleen foutcodes, request-ID's en resultaatmetadata als bewijs; geen koppelcodes, raw bearers, servicecredentials of Vaultinhoud.
