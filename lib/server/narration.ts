import { getSupabaseConfig } from '../supabase/config';
import { createSupabaseRequestClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { requireActiveParentAccount } from './parent';
import { getContent } from './content';
import { checkMutationOrigin, object, privateJson, readJson, RequestError } from './http';
import { narrationResponseBytes } from '../narration/backend-types';
import { narrationHostedTarget } from '../narration/hosted-target';

export type NarrationAction = 'voices' | 'manifest' | 'asset' | 'namePack' | 'sample' | 'get' | 'save' | 'test' | 'plan' | 'enqueue' | 'retry' | 'review' | 'publish' | 'preview';
const PUBLIC = ['voices', 'manifest', 'asset', 'namePack', 'sample'];
const MESSAGES: Record<string, string> = {
  narration_unavailable: 'Voorlezen is tijdelijk niet bereikbaar. Je kunt gewoon verder lezen.', narration_staging_only: 'Voorlezen wordt eerst op staging ingericht.',
  narration_revision_conflict: 'Een andere beheerder heeft de instellingen gewijzigd. Laad de actuele instellingen opnieuw.',
  narration_key_required: 'Voer eerst de OpenAI-sleutel in bij Koppeling.', narration_provider_test_failed: 'De verbinding kon nog niet worden bevestigd. Controleer de koppeling.',
  narration_source_changed: 'De verhaalversie is gewijzigd. Maak een nieuw audioplan.', narration_source_not_published: 'Publiceer eerst de bijbehorende tekstversie.',
  narration_configuration_changed: 'De steminstellingen zijn gewijzigd. Plan de nieuwe versie opnieuw.', narration_plan_expired: 'Maak een nieuw audioplan om verder te gaan.',
  narration_budget_limit: 'De ingestelde bestedingslimiet is bereikt.', narration_incomplete: 'Niet alle audio is volledig en goedgekeurd.', narration_name_pack_required: 'Geef eerst het bijbehorende pakket met naamzinnen vrij.',
  narration_invalid_request: 'Controleer de voorleesinstellingen.', narration_rate_limited: 'Wacht even voordat je opnieuw test.',
  narration_admin_required: 'Voor deze handeling zijn beheerrechten nodig.', narration_forbidden: 'Dit account heeft geen toegang tot deze handeling.',
  fresh_auth_required: 'Log opnieuw in met een e-mailcode of Google voordat je deze handeling uitvoert.',
  account_changed: 'Het beheeraccount is gewijzigd. Laad Voorlezen opnieuw.', sign_in_required: 'Log als ouder in om verder te gaan.', narration_asset_unavailable: 'Deze opname is nog niet beschikbaar.',
};
function safeResponse(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(safeResponse); return; }
  if (object(value)) for (const [key, child] of Object.entries(value)) { if (/^(?:apiKey|api_key|secret|secret_id|accessToken|refreshToken|authorization|leaseId|objectPath)$/iu.test(key)) throw new Error('Unsafe response'); safeResponse(child); }
}
/** Next uses the existing user session only. Provider credentials, storage
 * rights and worker identities remain inside the separately pinned Edge app. */
export async function narrationRequest(request: Request, action: NarrationAction, routeValue?: string): Promise<Response> {
  try {
    const config = getSupabaseConfig();
    if (!config || !narrationHostedTarget({ SUPABASE_URL: config.url, FABELPAD_APP_ORIGIN: config.appUrl, FABELPAD_ENVIRONMENT: process.env.FABELPAD_DEPLOY_ENV === 'local' ? undefined : process.env.FABELPAD_DEPLOY_ENV })) throw new RequestError(503, 'narration_staging_only', MESSAGES.narration_staging_only);
    if (request.method !== 'GET') checkMutationOrigin(request);
    const url = new URL(request.url); let input: Record<string, unknown> = {};
    if (request.method === 'GET') {
      const allowed = action === 'get' ? ['jobId'] : action === 'preview' ? ['jobId', 'itemId'] : action === 'namePack' ? ['voiceSlot', 'presetVersion', 'packVersion', 'packId'] : action === 'sample' ? ['presetVersion'] : action === 'voices' ? [] : ['storyId', 'version', 'readingLevel', 'voiceSlot'];
      if ([...url.searchParams.keys()].some(k => !allowed.includes(k)) || allowed.some(k => url.searchParams.getAll(k).length > 1)) throw new RequestError(422, 'narration_invalid_request');
      input = Object.fromEntries(url.searchParams);
      if (action === 'namePack' || action === 'sample') input.presetVersion = Number(input.presetVersion);
      if (action === 'namePack' && input.packVersion !== undefined) input.packVersion = Number(input.packVersion);
      if (action === 'sample') input.voiceSlot = routeValue;
      if (action === 'asset') input.assetId = routeValue;
    } else { const body = await readJson(request, 96 * 1024); if (!object(body) || Object.hasOwn(body, 'action')) throw new RequestError(422, 'narration_invalid_request'); input = body; }
    let content: Record<string, unknown> | undefined;
    if (action === 'manifest' || action === 'asset') {
      if (typeof input.storyId !== 'string' || typeof input.version !== 'string') throw new RequestError(422, 'narration_invalid_request');
      const contentUrl = new URL(request.url); contentUrl.search = ''; contentUrl.searchParams.set('version', input.version);
      const authorized = await getContent(new Request(contentUrl, { headers: request.headers }), input.storyId);
      if (!authorized.ok) return authorized;
      const value: unknown = await authorized.json(); if (!object(value) || !object(value.release) || value.release.contentVersion !== input.version) throw new RequestError(403, 'narration_forbidden'); content = value.release;
    }
    const client = await createSupabaseRequestClient(request); const parent = await getVerifiedParent(client);
    if (!PUBLIC.includes(action)) {
      if (!parent) throw new RequestError(401, 'sign_in_required', MESSAGES.sign_in_required);
      const expected = request.headers.get('x-fabelpad-parent');
      if ((request.method !== 'GET' || expected !== null) && expected !== parent.id) throw new RequestError(401, 'account_changed', MESSAGES.account_changed);
      await requireActiveParentAccount(client); if (!await isContentAdmin(client, parent.id)) throw new RequestError(403, 'narration_admin_required', MESSAGES.narration_admin_required);
    }
    // The native request already supplies its verified transport token. Cookie
    // sessions use getSession only after the authoritative getUser check.
    let token = parent ? request.headers.get('authorization')?.slice(7) : undefined;
    if (parent && !token) { const session = await client.auth.getSession(); if (session.error || !session.data.session?.access_token) throw new RequestError(401, 'sign_in_required'); token = session.data.session.access_token; }
    const response = await fetch(`${config.url}/functions/v1/voorlezen-admin`, { method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(action === 'plan' ? 120_000 : action === 'test' ? 110_000 : 30_000), headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...input, action }) });
    if (response.ok && response.headers.get('content-type')?.startsWith('audio/wav')) {
      const bytes = await narrationResponseBytes(response, 16 * 1024 * 1024); return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' } });
    }
    const bytes = await narrationResponseBytes(response, 48 * 1024 * 1024); const result: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!response.ok) { const code = object(result) && typeof result.error === 'string' && Object.hasOwn(MESSAGES, result.error) ? result.error : 'narration_unavailable'; return privateJson({ error: code, message: MESSAGES[code] }, [400, 401, 403, 404, 409, 422, 428, 429, 503].includes(response.status) ? response.status : 503); }
    safeResponse(result);
    if (action === 'manifest' && object(result) && object(result.manifest) && content) {
      result.manifest.access = { scope: content.access === 'preview' ? 'preview' : 'full', offlineUntil: content.offlineUntil ?? null, ...(content.cacheOwnerId ? { cacheOwnerId: content.cacheOwnerId } : {}) };
      if (object(result.manifest.assets)) for (const value of Object.values(result.manifest.assets)) if (object(value)) value.url = `/api/voorlezen/assets/${value.id}?${new URLSearchParams({ storyId: String(input.storyId), version: String(input.version), readingLevel: String(input.readingLevel), voiceSlot: String(input.voiceSlot) })}`;
    }
    return privateJson(result);
  } catch (error) { if (error instanceof RequestError) return privateJson({ error: error.code, message: MESSAGES[error.code] ?? error.message }, error.status); return privateJson({ error: 'narration_unavailable', message: MESSAGES.narration_unavailable }, 503); }
}
