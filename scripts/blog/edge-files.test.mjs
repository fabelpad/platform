import test from 'node:test';
import assert from 'node:assert/strict';
import { blogEdgeFiles } from './edge-files.mjs';
test('the real Edge upload contains only its transitive reviewed source, fixed dependencies and integrity lock', async () => {
  const result = await blogEdgeFiles();
  const names = result.files.map(file => file.name);
  for (const name of ['supabase/functions/blog-runtime/index.ts','supabase/functions/blog-runtime/deno.json','supabase/functions/blog-runtime/deno.lock','lib/blog/runtime.ts','lib/blog/document.ts','lib/blog/markdown.ts','lib/blog/media.ts','lib/socialhero/client.ts','lib/socialhero/supabase.ts']) assert.ok(names.includes(name));
  assert.ok(result.totalBytes < 1_000_000); assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(new Set(names).size, names.length); assert.ok(!names.some(name => /(?:\.env|fixture|test|node_modules|attachments|server\/|mobile\/)/u.test(name)));
  for (const file of result.digests) assert.ok(file.byteLength > 0);
});
