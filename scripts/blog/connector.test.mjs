import test from 'node:test';
import assert from 'node:assert/strict';
import { SocialHeroPairingClient, safeSocialHeroAddress, pinnedSocialHeroTransport } from '../../lib/socialhero/client.ts';
const attemptId = '11111111-1111-4111-8111-111111111111', connectionId = '22222222-2222-4222-8222-222222222222', destinationId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-11-26T12:00:00Z');
const response = (value, status = 200) => ({ status, body: new TextEncoder().encode(JSON.stringify(value)) });
const input = { code: 'c'.repeat(43), attemptId, siteId: 'fabelpad', origin: 'https://staging.fabelpad.nl', environment: 'staging' };
test('pairing client uses fixed trusted origin, exact binding, same attempt on retry, and bearer only for verify', async () => {
  const calls = [];
  const client = new SocialHeroPairingClient('staging', async request => {
    calls.push(request);
    return request.url.pathname.endsWith('/claim') ? response({ connectionId, destinationId, accessToken: 't'.repeat(64), expiresAt: '2026-11-26T12:10:00Z' }) : response({ connectionId, status: 'verified' });
  }, () => now);
  const first = await client.claim(input); assert.deepEqual(await client.claim(input), first);
  await client.verify(first.connectionId, first.accessToken);
  assert.equal(calls[0].url.origin, 'https://socialhero-staging.dgwebservices.nl');
  assert.deepEqual(JSON.parse(calls[0].body), { ...input, contractVersion: 1 });
  assert.equal(calls[0].headers.Authorization, undefined); assert.equal(calls[2].headers.Authorization, `Bearer ${'t'.repeat(64)}`);
});
test('pairing client refuses unsafe responses, redirects, wrong environments and malformed expiry without leaking bodies', async () => {
  for (const value of [{ connectionId, destinationId, accessToken: 't'.repeat(43), expiresAt: '2026-11-26T11:59:59Z' }, { connectionId, destinationId, accessToken: 'short', expiresAt: '2026-11-26T12:10:00Z' }, { connectionId, destinationId, accessToken: 't'.repeat(43), expiresAt: '2027-11-26T12:10:00Z' }]) {
    await assert.rejects(new SocialHeroPairingClient('staging', async () => response(value), () => now).claim(input), error => error.code === 'PAIRING_UNAVAILABLE' && !error.message.includes('accessToken'));
  }
  await assert.rejects(new SocialHeroPairingClient('production', async () => { throw new Error('must not call'); }).claim(input), error => error.code === 'INVALID_PAIRING_CODE');
  await assert.rejects(new SocialHeroPairingClient('staging', async () => response({}, 302)).claim(input), error => error.code === 'DESTINATION_MISMATCH');
  await assert.rejects(new SocialHeroPairingClient('staging').verify(connectionId, 't'.repeat(1025)), error => error.code === 'INVALID_CREDENTIAL');
  await assert.rejects(pinnedSocialHeroTransport({ url: new URL('https://evil.example/'), headers: {}, signal: AbortSignal.timeout(100) }), error => error.code === 'DESTINATION_MISMATCH');
  await assert.rejects(pinnedSocialHeroTransport({ url: new URL('https://user:password@socialhero-staging.dgwebservices.nl/'), method: 'HEAD', headers: {}, signal: AbortSignal.timeout(100) }), error => error.code === 'DESTINATION_MISMATCH');
  for (const ip of ['127.0.0.1','10.1.1.1','169.254.169.254','100.64.0.1','192.168.0.1','::1','::ffff:127.0.0.1','64:ff9b::7f00:1','2001:0db8::1','2002:7f00:1::']) assert.equal(safeSocialHeroAddress(ip), false, ip);
  for (const ip of ['8.8.8.8','1.1.1.1','2001:4860:4860::8888','2606:4700:4700::1111']) assert.equal(safeSocialHeroAddress(ip), true, ip);
});
