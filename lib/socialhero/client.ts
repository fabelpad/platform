import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import { BlogRuntimeError, blogObject, blogUuid } from './errors.ts';

export const SOCIALHERO_ORIGINS = { staging: 'https://socialhero-staging.dgwebservices.nl', production: 'https://socialhero.dgwebservices.nl' } as const;
export type SocialHeroTransport = (request: { url: URL; method?: 'GET' | 'HEAD' | 'POST'; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<{ status: number; body: Uint8Array }>;
export type SocialHeroClaim = { connectionId: string; destinationId: string; accessToken: string; expiresAt: string };
function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !([0, 10, 127].includes(a) || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19, 51].includes(b) || a === 203 && b === 0);
  }
  // Public IPv6 unicast only. IPv4-mapped/NAT64/tunnel ranges fail closed.
  if (isIP(address) !== 6 || !/^2[0-9a-f]{3}:/iu.test(address)) return false;
  const words = address.split(':').map(value => parseInt(value || '0', 16));
  return words[0] !== 0x2002 && !(words[0] === 0x2001 && (words[1] <= 0x1ff || words[1] === 0xdb8));
}
export const safeSocialHeroAddress = publicAddress;
/** Resolve all records, reject any private result, then pin the actual TLS socket. */
export const pinnedSocialHeroTransport: SocialHeroTransport = async request => {
  const method = request.method ?? 'POST';
  if (!(Object.values(SOCIALHERO_ORIGINS) as string[]).includes(request.url.origin) || request.url.username || request.url.password || request.url.search || request.url.hash || !(['GET', 'HEAD'].includes(method) && request.url.pathname === '/' || method === 'POST' && /^\/api\/integrations\/blog\/v1\/pairings\/(?:claim|[a-f0-9-]{36}\/verify)$/iu.test(request.url.pathname))) throw new BlogRuntimeError('DESTINATION_MISMATCH', 409);
  const addresses = await lookup(request.url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => !publicAddress(entry.address))) throw new BlogRuntimeError('PAIRING_UNAVAILABLE', 503);
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const connection = https.request(request.url, {
      method, agent: false, signal: request.signal, headers: request.headers,
      servername: request.url.hostname,
      lookup: ((_hostname: unknown, options: { all?: boolean }, callback: (...args: unknown[]) => void) => options?.all ? callback(null, [address]) : callback(null, address.address, address.family)) as never,
    }, response => {
      let size = 0; const chunks: Uint8Array[] = [];
      response.on('data', (chunk: Uint8Array) => { size += chunk.byteLength; if (size > 16_384) { response.destroy(new Error('bounded_response')); return; } chunks.push(chunk); });
      response.once('error', reject);
      response.once('end', () => { const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } resolve({ status: response.statusCode ?? 503, body: bytes }); });
    });
    connection.once('error', reject); connection.end(request.body);
  });
};
export class SocialHeroPairingClient {
  readonly origin: string;
  readonly environment: 'staging' | 'production'; readonly transport: SocialHeroTransport; readonly now: () => Date;
  constructor(environment: 'staging' | 'production', transport: SocialHeroTransport = pinnedSocialHeroTransport, now = () => new Date()) { this.environment = environment; this.transport = transport; this.now = now; this.origin = SOCIALHERO_ORIGINS[environment]; }
  private async request(path: string, body: unknown, token?: string): Promise<Record<string, unknown>> {
    let response: { status: number; body: Uint8Array };
    try { response = await this.transport({ url: new URL(`/api/integrations/blog/v1/pairings${path}`, this.origin), headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) }); }
    catch { throw new BlogRuntimeError('PAIRING_UNAVAILABLE', 503, 5); }
    if (response.status >= 300 && response.status < 400) throw new BlogRuntimeError('DESTINATION_MISMATCH', 409);
    let result: unknown;
    try { if (response.body.byteLength > 16_384) throw new Error(); result = JSON.parse(new TextDecoder().decode(response.body)); } catch { throw new BlogRuntimeError('PAIRING_UNAVAILABLE', 503, 5); }
    if (response.status !== 200) {
      const code = blogObject(result) && typeof result.code === 'string' && ['INVALID_PAIRING_CODE', 'PAIRING_EXPIRED', 'DESTINATION_MISMATCH', 'INVALID_CREDENTIAL', 'PERMISSION_DENIED', 'RATE_LIMITED'].includes(result.code) ? result.code : 'PAIRING_UNAVAILABLE';
      const status = ({ INVALID_PAIRING_CODE: 400, PAIRING_EXPIRED: 410, DESTINATION_MISMATCH: 409, INVALID_CREDENTIAL: 401, PERMISSION_DENIED: 403, RATE_LIMITED: 429 } as Record<string, number>)[code] ?? 503;
      throw new BlogRuntimeError(code, status, status === 429 ? 60 : undefined);
    }
    if (!blogObject(result)) throw new BlogRuntimeError('PAIRING_UNAVAILABLE', 503);
    return result;
  }
  async claim(input: { code: string; attemptId: string; siteId: string; origin: string; environment: string }): Promise<SocialHeroClaim> {
    if (!/^[A-Za-z0-9_-]{43}$/u.test(input.code) || !blogUuid(input.attemptId) || input.environment !== this.environment) throw new BlogRuntimeError('INVALID_PAIRING_CODE', 400);
    const result = await this.request('/claim', { ...input, contractVersion: 1 });
    const expires = typeof result.expiresAt === 'string' ? Date.parse(result.expiresAt) : NaN;
    if (!blogUuid(result.connectionId) || !blogUuid(result.destinationId) || typeof result.accessToken !== 'string' || !/^[A-Za-z0-9_-]{43,1024}$/u.test(result.accessToken) || !Number.isFinite(expires) || expires <= this.now().valueOf() || expires > this.now().valueOf() + 610_000) throw new BlogRuntimeError('PAIRING_UNAVAILABLE', 503);
    return result as SocialHeroClaim;
  }
  async verify(connectionId: string, accessToken: string): Promise<void> {
    if (!blogUuid(connectionId) || !/^[A-Za-z0-9_-]{43,1024}$/u.test(accessToken)) throw new BlogRuntimeError('INVALID_CREDENTIAL', 401);
    const result = await this.request(`/${connectionId}/verify`, {}, accessToken);
    if (result.connectionId !== connectionId || result.status !== 'verified') throw new BlogRuntimeError('DESTINATION_MISMATCH', 409);
  }
}
