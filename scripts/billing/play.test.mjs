import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-play-billing-'));
after(() => rm(temporary, { recursive: true, force: true }));
const { createPlayClient, createPlayCredentialAccessToken, createPlayWorkloadIdentityToken, createGooglePushVerifier, parsePlayNotification, playAccountId, playDigest, verifyPlayProduct, verifyPlaySubscription } = await import(await compileSource(new URL('../../lib/billing/play.ts', import.meta.url), temporary));
const { createPlayBillingService } = await import(await compileSource(new URL('../../lib/billing/play-service.ts', import.meta.url), temporary));
const parentId = '8701f0d6-0fa7-4cd0-8980-a183daab8713', owner = await playAccountId(parentId), token = 'synthetic-purchase-token-a';
const now = Date.parse('2026-11-23T12:00:00Z');
const settings = { packageName: 'nl.fabelpad.app', monthlyProductId: 'family', monthlyBasePlanId: 'monthly', yearlyProductId: 'family', yearlyBasePlanId: 'annual', rtdnAudience: 'https://staging.fabelpad.nl/api/billing/play/notifications', rtdnServiceAccount: 'push@fabelpad.iam.gserviceaccount.com', pubsubSubscription: 'projects/fabelpad/subscriptions/play-staging' };
const purchase = (changes = {}) => ({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', testPurchase: {}, startTime: '2026-11-23T11:59:00Z', externalAccountIdentifiers: { obfuscatedExternalAccountId: owner }, lineItems: [{ productId: 'family', expiryTime: '2026-12-23T11:59:00Z', offerDetails: { basePlanId: 'monthly' }, autoRenewingPlan: { autoRenewEnabled: true, recurringPrice: { currencyCode: 'EUR', units: '4', nanos: 990_000_000 } } }], ...changes });
const verify = (value = purchase(), changes = {}) => verifyPlaySubscription(value, { settings, token, mode: 'test', expectedAccountId: owner, now, ...changes });
test('verified server response binds the family, mode, exact product/base plan, price and acknowledgement', async () => {
  const result = await verify();
  assert.equal(result.state, 'active'); assert.equal(result.amountCents, 499); assert.equal(result.acknowledgementRequired, true);
  assert.equal(result.obfuscatedAccountId, owner); assert.equal(result.tokenHash, await playDigest(token)); assert.equal(result.period, 'month');
  await assert.rejects(verify(purchase(), { expectedAccountId: 'a'.repeat(64) }), /owner_mismatch/u);
  await assert.rejects(verify(purchase(), { mode: 'live' }), /mode_mismatch/u);
  await assert.rejects(verify(purchase({ externalAccountIdentifiers: {} })), /owner_mismatch/u);
  await assert.rejects(verify(purchase({ lineItems: [{ productId: 'other', offerDetails: { basePlanId: 'monthly' }, expiryTime: '2027-01-01T00:00:00Z' }] })), /product_mismatch/u);
  const usd = purchase(); usd.lineItems[0].autoRenewingPlan.recurringPrice.currencyCode = 'USD'; await assert.rejects(verify(usd), /currency_mismatch/u);
});
test('Play lifecycle states preserve paid cancellation and grace, withhold hold/paused/pending and expire past end', async () => {
  for (const [google, expected] of [['ACTIVE','active'],['IN_GRACE_PERIOD','grace'],['CANCELED','cancelled'],['ON_HOLD','hold'],['PAUSED','hold'],['EXPIRED','expired'],['PENDING','pending'],['PENDING_PURCHASE_CANCELED','failed']]) {
    const result = await verify(purchase({ subscriptionState: `SUBSCRIPTION_STATE_${google}` })); assert.equal(result.state, expected);
    if (['hold','expired','failed','pending'].includes(expected)) assert.equal(result.acknowledgementRequired, false);
  }
  const old = purchase(); old.lineItems[0].expiryTime = '2026-11-22T00:00:00Z'; assert.equal((await verify(old)).state, 'expired');
  const pending = purchase({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }); delete pending.lineItems[0].expiryTime;
  assert.equal((await verify(pending)).state, 'pending');
  await assert.rejects(verify(purchase({ subscriptionState: 'FUTURE_UNKNOWN_STATE' })), /unknown_play/u);
});
test('restored linked purchase uses a previously proven owner only; unknown unbound purchases fail closed', async () => {
  assert.equal((await verify(purchase({ externalAccountIdentifiers: {}, linkedPurchaseToken: 'synthetic-previous-token' }), { knownLinkedAccountId: owner })).obfuscatedAccountId, owner);
  await assert.rejects(verify(purchase({ externalAccountIdentifiers: {} }), { knownLinkedAccountId: undefined }), /owner_mismatch/u);
});
test('official v2 cancellation and revocation use read-only access tokens and sanitize provider errors', async () => {
  const calls = [], client = createPlayClient(async () => 'synthetic-access-token', async (url, init) => { calls.push([url, init]); return new Response(null, { status: 204 }); });
  await client.cancel('nl.fabelpad.app', token, true); await client.revoke('nl.fabelpad.app', token, 'prorated');
  assert.match(calls[0][0], /purchases\/subscriptionsv2\/tokens\/synthetic-purchase-token-a:cancel$/u);
  assert.equal(JSON.parse(calls[0][1].body).cancellationContext.cancellationType, 'DEVELOPER_REQUESTED_STOP_PAYMENTS');
  assert.deepEqual(JSON.parse(calls[1][1].body), { revocationContext: { proratedRefund: {} } });
  const denied = createPlayClient(async () => 'synthetic-access-token', async () => Response.json({ secret: 'DO_NOT_EXPOSE' }, { status: 403 }));
  await assert.rejects(denied.getSubscription('nl.fabelpad.app', token), error => error.code === 'play_permission_denied' && !error.message.includes('DO_NOT_EXPOSE'));
  const uncertain = createPlayClient(async () => 'synthetic-access-token', async () => { throw new Error('transport failed'); });
  await assert.rejects(uncertain.cancel('nl.fabelpad.app', token), error => error.uncertain === true);
});
test('base-plan probe proves period, EUR region and actual sale state without changing sale state', () => {
  const product = { packageName: 'nl.fabelpad.app', productId: 'family', basePlans: [{ basePlanId: 'monthly', state: 'ACTIVE', autoRenewingBasePlanType: { billingPeriodDuration: 'P1M' }, regionalConfigs: [{ regionCode: 'NL', newSubscriberAvailability: true, price: { currencyCode: 'EUR', units: '4', nanos: 990_000_000 } }] }] };
  assert.equal(verifyPlayProduct(product, 'family', 'monthly', 'month').salesStatus, 'active');
  assert.throws(() => verifyPlayProduct(product, 'family', 'monthly', 'year'), /base_plan_mismatch/u);
  product.basePlans[0].state = 'INACTIVE'; assert.equal(verifyPlayProduct(product, 'family', 'monthly', 'month').salesStatus, 'inactive');
});
test('WIF exchanges a runtime OIDC token then impersonates the scoped Play identity, caching short-lived access', async () => {
  const calls = [], access = createPlayWorkloadIdentityToken({ audience: '//iam.googleapis.com/projects/471984799009/locations/global/workloadIdentityPools/fabelpad-play-internal/providers/github', serviceAccount: 'fabelpad-play-internal@fabelpad.iam.gserviceaccount.com', subjectToken: async () => 'synthetic.oidc.token', now: () => now,
    fetcher: async (url, init) => { calls.push([url, JSON.parse(init.body)]); return url.includes('sts.googleapis') ? Response.json({ access_token: 'synthetic-federated-token' }) : Response.json({ accessToken: 'synthetic-play-token', expireTime: '2026-11-23T13:00:00Z' }); } });
  assert.equal(await access(), 'synthetic-play-token'); assert.equal(await access(), 'synthetic-play-token'); assert.equal(calls.length, 2);
  assert.equal(calls[0][1].subjectToken, 'synthetic.oidc.token'); assert.deepEqual(calls[1][1].scope, ['https://www.googleapis.com/auth/androidpublisher']);
  assert.throws(() => createPlayCredentialAccessToken(JSON.stringify({ type: 'external_account' })), /source_unavailable/u);
});
test('existing Google service-account JSON accepts standard multiline PKCS8 PEM and signs a verifiable short-lived scoped assertion',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const encoded=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
  const pem=`-----BEGIN PRIVATE KEY-----\n${encoded.match(/.{1,64}/gu).join('\n')}\n-----END PRIVATE KEY-----\n`;
  const credential={type:'service_account',client_email:'synthetic-server@fabelpad.iam.gserviceaccount.com',private_key:pem,token_uri:'https://oauth2.googleapis.com/token'};
  let calls=0;
  const access=createPlayCredentialAccessToken(JSON.stringify(credential),{now:()=>now,fetcher:async(url,init)=>{
    calls++;assert.equal(url,'https://oauth2.googleapis.com/token');const body=new URLSearchParams(init.body),jwt=body.get('assertion').split('.');
    assert.equal(body.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const claims=JSON.parse(Buffer.from(jwt[1],'base64url'));assert.equal(claims.iss,credential.client_email);assert.equal(claims.scope,'https://www.googleapis.com/auth/androidpublisher');assert.equal(claims.exp-claims.iat,3600);
    assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,Buffer.from(jwt[2],'base64url'),new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`)),true);
    return Response.json({access_token:'synthetic-short-lived-token',expires_in:3600});
  }});
  assert.equal(await access(),'synthetic-short-lived-token');assert.equal(await access(),'synthetic-short-lived-token');assert.equal(calls,1);
  assert.throws(()=>createPlayCredentialAccessToken(JSON.stringify({...credential,private_key:pem.replace('\n','\u0000')})),/invalid_play_server_credential/u);
});
async function signedPush(changes = {}) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign','verify']);
  const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'synthetic-key', alg: 'RS256', use: 'sig' };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid: 'synthetic-key' }), claims = encode({ iss: 'https://accounts.google.com', aud: settings.rtdnAudience, email: settings.rtdnServiceAccount, email_verified: true, sub: '1234567890', iat: now / 1000 - 5, exp: now / 1000 + 3_595, ...changes });
  const signature = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${header}.${claims}`))).toString('base64url');
  return { jwt: `${header}.${claims}.${signature}`, jwk };
}
test('RTDN authenticates signature, issuer, exact audience, verified service identity and expiration before trusting a signal', async () => {
  const valid = await signedPush(), verifier = createGooglePushVerifier({ audience: settings.rtdnAudience, serviceAccount: settings.rtdnServiceAccount, now: () => now, fetcher: async () => Response.json({ keys: [valid.jwk] }) });
  await verifier(`Bearer ${valid.jwt}`);
  await assert.rejects(verifier(`Bearer ${valid.jwt.slice(0, -5)}abcde`), /invalid_play_push/u);
  for (const changes of [{ aud: 'https://other.example.test' }, { email: 'attacker@example.test' }, { email_verified: false }, { exp: now / 1000 - 60 }, { iss: 'https://evil.example.test' }]) {
    const bad = await signedPush(changes), check = createGooglePushVerifier({ audience: settings.rtdnAudience, serviceAccount: settings.rtdnServiceAccount, now: () => now, fetcher: async () => Response.json({ keys: [bad.jwk] }) });
    await assert.rejects(check(`Bearer ${bad.jwt}`), /invalid_play_push/u);
  }
  const envelope = { subscription: settings.pubsubSubscription, message: { messageId: '1234', data: Buffer.from(JSON.stringify({ packageName: 'nl.fabelpad.app', eventTimeMillis: String(now), subscriptionNotification: { purchaseToken: token, notificationType: 2 } })).toString('base64') } };
  assert.equal(parsePlayNotification(envelope, { packageName: 'nl.fabelpad.app', subscription: settings.pubsubSubscription }).payload.purchaseToken, token);
  assert.throws(() => parsePlayNotification(envelope, { packageName: 'nl.fabelpad.app', subscription: 'projects/other/subscriptions/other' }), /invalid_play_notification/u);
});
test('server rejects stolen tokens before provider lookup; durable worker confirms stop through fresh readback', async () => {
  const credential = { revision: 1, environment: 'staging', mode: 'test', provider: 'play', apiKey: 'server-only', config: { play: settings } };
  const events = [], backend = { async rpc(name, args) {
    events.push([name,args]);
    if (name === 'get_billing_play_binding') return { parentId };
    if (name === 'get_billing_provider_config') return credential;
    if (name === 'record_billing_provider_test') return {};
    if (name === 'apply_billing_provider_evidence') return { applied: true, duplicate: false };
    if (name === 'complete_billing_job') return { completed: true };
    if (name === 'fail_billing_job') return { updated: true };
    throw new Error(`unexpected ${name}`);
  } };
  let calls = 0, stopped = false;
  const service = createPlayBillingService({ backend, accessToken: () => async () => 'synthetic-provider-token', now: () => now, fetcher: async (url, init) => {
    calls++;
    if (url.endsWith(':cancel')) { stopped = true; return new Response(null, { status: 204 }); }
    const result = purchase({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }); result.lineItems[0].autoRenewingPlan.autoRenewEnabled = !stopped;
    return Response.json(result);
  } });
  await assert.rejects(service.verifyPurchase({ token, parentId: '45e4578e-2211-449c-80a1-f2b18988f92e', mode: 'test' }), /owner_mismatch/u); assert.equal(calls, 0);
  const job = { id: 'synthetic-job-id', provider: 'play', kind: 'play_cancel', mode: 'test', environment: 'staging', credentialRevision: 1, idempotencyKey: 'cancel:one', payload: { purchaseToken: token, reason: 'phaseout' }, attempt: 1, leaseToken: 'synthetic-lease' };
  const result = await service.handleJob(job); assert.equal(result.providerConfirmed, true); assert.equal(result.autoRenew, false); assert.equal(result.cancellationConfirmed, true);
  assert.equal(events.at(-1)[0], 'complete_billing_job'); assert.equal(events.at(-1)[1].p_lease_token, 'synthetic-lease');
  assert(events.some(([name,args]) => name === 'apply_billing_provider_evidence' && args.p_evidence.autoRenew === false));
});

const serviceCredential = () => ({ provider: 'play', revision: 7, mode: 'test', environment: 'staging', config: { play: settings }, verification: { serverVerificationVerified: true } });
const serviceJob = (changes = {}) => ({ id: 'synthetic-job', provider: 'play', kind: 'play_cancel', environment: 'staging', mode: 'test', credentialRevision: 7, settingsRevision: 4,
  idempotencyKey: 'synthetic-stop', attempt: 1, leaseToken: 'synthetic-lease', payload: { purchaseToken: token, reason: 'account_deletion' }, ...changes });
test('a delayed old active response keeps its verification start time and cannot replace newer expired evidence', async () => {
  let clock = now, releaseOld, reachedOld;
  const oldStarted = new Promise(resolve => { reachedOld = resolve; }), oldResponse = new Promise(resolve => { releaseOld = resolve; });
  const observations = []; let stored = null, requests = 0;
  const backend = { rpc: async (name, args) => {
    if (name === 'get_billing_play_binding') return { parentId, subscriptionId: 'synthetic-contract', credentialRevision: 7, mode: 'test' };
    if (name === 'get_billing_provider_config') return serviceCredential();
    if (name === 'apply_billing_provider_evidence') {
      observations.push(args.p_evidence);
      const applies = !stored || args.p_evidence.verifiedAt >= stored.verifiedAt;
      if (applies) stored = args.p_evidence;
      return { applied: applies, duplicate: false };
    }
    throw new Error(`unexpected ${name}`);
  } };
  const service = createPlayBillingService({ backend, accessToken: () => async () => 'synthetic-provider-token', now: () => clock, fetcher: async () => {
    if (++requests === 1) { reachedOld(); await oldResponse; return Response.json(purchase({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' })); }
    return Response.json(purchase({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
  } });
  const slow = service.verifyPurchase({ token, parentId, mode: 'test', eventId: 'old-active' }); await oldStarted;
  clock += 10_000; await service.verifyPurchase({ token, parentId, mode: 'test', eventId: 'new-expired' });
  clock += 10_000; releaseOld(); await slow;
  assert.equal(observations.find(value => value.eventId === 'old-active').verifiedAt, new Date(now).toISOString());
  assert.equal(stored.state, 'expired'); assert.equal(stored.eventId, 'new-expired');
});
test('deleted-account reconciliation stops renewal using its retained opaque binding without restoring the parent', async () => {
  const events = []; let stopped = false;
  const backend = { rpc: async (name, args) => {
    events.push([name,args]);
    if (name === 'get_billing_play_binding') return { parentId: null, subscriptionId: 'retained-contract', deleted: true, obfuscatedAccountId: owner, credentialRevision: 7, mode: 'test' };
    if (name === 'get_billing_provider_config') return serviceCredential();
    if (name === 'apply_billing_provider_evidence') return { applied: true, duplicate: false };
    if (name === 'complete_billing_job') return { completed: true };
    throw new Error(`unexpected ${name}`);
  } };
  const service = createPlayBillingService({ backend, accessToken: () => async () => 'synthetic-provider-token', now: () => now, fetcher: async (url, init) => {
    if (url.endsWith(':cancel')) { assert.equal(JSON.parse(init.body).cancellationContext.cancellationType, 'DEVELOPER_REQUESTED_STOP_PAYMENTS'); stopped = true; return new Response(null, { status: 204 }); }
    const value = purchase({ externalAccountIdentifiers: {}, acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }); value.lineItems[0].autoRenewingPlan.autoRenewEnabled = !stopped; return Response.json(value);
  } });
  await assert.rejects(service.verifyPurchase({ token, parentId, mode: 'test' }), /account_deleted/u);
  assert.equal((await service.handleJob(serviceJob())).cancellationConfirmed, true);
  assert(events.some(([name,args]) => name === 'apply_billing_provider_evidence' && args.p_evidence.subscriptionId === 'retained-contract'));
  assert(!events.some(([name]) => name === 'get_billing_play_reservation'));
});
test('authenticated RTDN retries have stable deduplication payloads and their durable test proof requires a valid lease', async () => {
  const signed = await signedPush(), events = [], credential = serviceCredential();
  const backend = { rpc: async (name, args) => {
    events.push([name,args]);
    if (name === 'get_billing_provider_config') return credential;
    if (name === 'record_billing_provider_event') return { accepted: true };
    if (name === 'record_billing_provider_test') return { recorded: true };
    if (name === 'complete_billing_job') return { completed: false };
    if (name === 'fail_billing_job') return { updated: false };
    throw new Error(`unexpected ${name}`);
  } };
  let clock = now;
  const service = createPlayBillingService({ backend, accessToken: () => async () => 'synthetic-provider-token', now: () => clock, fetcher: async () => Response.json({ keys: [signed.jwk] }) });
  const body = { subscription: settings.pubsubSubscription, message: { messageId: 'test-signal', data: Buffer.from(JSON.stringify({ packageName: settings.packageName, eventTimeMillis: String(now), testNotification: { version: '1.0' } })).toString('base64') } };
  await service.acceptNotification({ authorization: `Bearer ${signed.jwt}`, body, mode: 'test' }); clock += 10_000;
  await service.acceptNotification({ authorization: `Bearer ${signed.jwt}`, body, mode: 'test' });
  const recorded = events.filter(([name]) => name === 'record_billing_provider_event'); assert.deepEqual(recorded[0][1],recorded[1][1]);
  await assert.rejects(service.handleJob(serviceJob({ kind: 'play_verify', payload: recorded[0][1].p_payload })), /lease_lost/u);
  assert(events.some(([name,args]) => name === 'record_billing_provider_test' && args.p_result.rtdnVerified === true));
  assert.equal(events.at(-1)[0], 'fail_billing_job'); assert.equal(events.at(-1)[1].p_error_code, 'play_job_lease_lost');
});
test('production license readiness acknowledges a genuine sandbox purchase without applying payment or content evidence', async () => {
  const credential={...serviceCredential(),mode:'live',environment:'production',config:{play:settings,prices:{month:{enabled:true,amountCents:499},year:{enabled:false,amountCents:3999}}}};
  let acknowledged=false,mutations=0,actual=purchase();
  const service=createPlayBillingService({backend:{rpc:async()=>{throw new Error('Proof-only flow must not create evidence, payment or entitlement');}},accessToken:()=>async()=>'synthetic-access',now:()=>now,fetcher:async(url)=>{
    if(url.endsWith(':acknowledge')){mutations++;acknowledged=true;return new Response(null,{status:204});}
    return Response.json({...actual,acknowledgementState:acknowledged?'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED':'ACKNOWLEDGEMENT_STATE_PENDING'});
  }});
  const proof=await service.verifyLicenseProof({token,credential,expectedAccountId:owner});assert.equal(proof.sandbox,true);assert.equal(proof.acknowledged,true);assert.equal(proof.ownerBinding,owner);assert.equal(proof.tokenHash,await playDigest(token));assert.equal(proof.amountCents,499);assert.equal(mutations,1);assert(!JSON.stringify(proof).includes(token));
  acknowledged=false;actual=purchase();delete actual.testPurchase;await assert.rejects(service.verifyLicenseProof({token,credential,expectedAccountId:owner}),/mode_mismatch/u);assert.equal(mutations,1);
  actual=purchase();await assert.rejects(service.verifyLicenseProof({token,credential,expectedAccountId:'a'.repeat(64)}),/owner_mismatch/u);assert.equal(mutations,1);
});
test('monthly-only Play readiness ignores unconfigured disabled annual products and rejects a stale configured price',async()=>{
  const credential={...serviceCredential(),config:{play:{...settings,yearlyProductId:'',yearlyBasePlanId:''},prices:{month:{enabled:true,amountCents:499},year:{enabled:false,amountCents:3999}}}};
  const calls=[],product={packageName:settings.packageName,productId:'family',basePlans:[{basePlanId:'monthly',state:'ACTIVE',autoRenewingBasePlanType:{billingPeriodDuration:'P1M'},regionalConfigs:[{regionCode:'NL',newSubscriberAvailability:true,price:{currencyCode:'EUR',units:'4',nanos:990000000}}]}]};
  const service=createPlayBillingService({backend:{rpc:async()=>{throw new Error('Unexpected RPC');}},accessToken:()=>async()=>'synthetic-access',fetcher:async(url)=>{calls.push(url);return Response.json(product);}});
  const result=await service.testConnection(credential);assert.equal(result.productsVerified,true);assert.equal(result.products.length,1);assert.equal(calls.length,1);assert.equal(result.serverVerificationVerified,false);
  product.basePlans[0].regionalConfigs[0].price.units='5';await assert.rejects(service.testConnection(credential),/price_mismatch/u);
});
