import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const listeners = {};
const puts = [];
const cache = { async put(key) { puts.push(typeof key === 'string' ? key : key.url); }, async match() { return undefined; } };
let mode = 'online';
const context = {
  self: { location: { origin: 'https://fabelpad.test' }, addEventListener(type, listener) { listeners[type] = listener; }, async skipWaiting() {}, clients: { async claim() {} } },
  caches: { async open() { return cache; }, async keys() { return ['fabelpad-static-v2']; }, async delete() { return true; } },
  URL, Response, Request, TypeError, Promise,
  async fetch(input) {
    if (mode === 'offline') throw new TypeError('offline');
    const path = typeof input === 'string' ? input : new URL(input.url).pathname;
    const isAsset = path.startsWith('/brand/') || path.startsWith('/icons/') || path.startsWith('/art/');
    const response = new Response(isAsset ? 'image' : '<html>private-parent-identity</html>', { headers: { 'Content-Type': isAsset ? 'image/webp' : 'text/html' } });
    Object.defineProperty(response, 'url', { value: `https://fabelpad.test${path}` });
    return response;
  },
};
vm.runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
let install;
listeners.install({ waitUntil(value) { install = value; } });
await install;
assert(puts.length > 0);
assert(!puts.some(path => path === '/' || path === '/index.html' || path.includes('/api/')));

function request(path, navigation = false) {
  let answer;
  listeners.fetch({ request: { method: 'GET', url: `https://fabelpad.test${path}`, mode: navigation ? 'navigate' : 'cors' }, respondWith(value) { answer = value; } });
  return answer;
}
assert.equal(request('/api/family'), undefined);
assert.equal(request('/auth/callback', true), undefined);
const before = puts.length;
const online = await request('/', true);
assert((await online.text()).includes('private-parent-identity'));
assert.equal(puts.length, before, 'Personalized HTML must never enter CacheStorage.');
mode = 'offline';
const offline = await request('/', true);
assert.equal(offline.status, 503);
assert.equal((await request('/gezin', true)).status, 503, 'Cold family navigation returns only the neutral offline page.');
assert(!(await offline.text()).includes('private-parent-identity'));
assert.equal(puts.length, before);
console.log('PWA privacy checks passed: no auth/API/parent HTML cached; neutral offline page only.');
