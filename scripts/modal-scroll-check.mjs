import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-modal-scroll-'));
globalThis.document = { body: { style: { overflow: '' } } };
try {
  const { lockBodyScroll } = await import(await compileSource(new URL('../src/modalScroll.ts', import.meta.url), temporary));
  const profile = lockBodyScroll();
  const portal = lockBodyScroll();
  profile();
  assert.equal(document.body.style.overflow, 'hidden', 'A departing profile modal cannot unlock the portal');
  const reader = lockBodyScroll();
  portal();
  assert.equal(document.body.style.overflow, 'hidden', 'A departing portal cannot unlock the reader');
  reader();
  assert.equal(document.body.style.overflow, '', 'The bookshelf scrolls after closing the last modal');
  reader(); portal(); profile();
  assert.equal(document.body.style.overflow, '', 'Repeated cleanup is harmless');

  document.body.style.overflow = 'clip';
  const first = lockBodyScroll(), second = lockBodyScroll(), third = lockBodyScroll();
  second(); first();
  assert.equal(document.body.style.overflow, 'hidden');
  third();
  assert.equal(document.body.style.overflow, 'clip', 'Restore the real pre-modal value after any close order');
  console.log('Modal scroll checks passed: profile → portal → reader overlap, either close order, idempotent cleanup and original overflow restoration.');
} finally { delete globalThis.document; await rm(temporary, { recursive: true, force: true }); }
