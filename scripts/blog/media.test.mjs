import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { deflateSync } from 'node:zlib';
import { decodeBlogMedia, BLOG_MEDIA_MAX_BYTES } from '../../lib/blog/media.ts';

test('shared media service decodes real PNG/JPEG, hashes exact immutable bytes and rejects lies/corruption/bombs', async () => {
  const pixels = Buffer.alloc(4 * 3 * 4, 255);
  const png = PNG.sync.write({ width: 4, height: 3, data: pixels });
  const jpg = jpeg.encode({ width: 4, height: 3, data: pixels }, 75).data;
  for (const [bytes, mimeType] of [[png, 'image/png'], [jpg, 'image/jpeg']]) {
    const result = await decodeBlogMedia(bytes, mimeType);
    assert.equal(result.mimeType, mimeType); assert.equal(result.width, 4); assert.equal(result.height, 3);
    assert.deepEqual(result.bytes, new Uint8Array(bytes)); assert.match(result.sha256, /^[a-f0-9]{64}$/);
    await assert.rejects(decodeBlogMedia(bytes, 'image/webp'), error => error.code === 'INVALID_MEDIA');
    await assert.rejects(decodeBlogMedia(bytes.subarray(0, 32), mimeType), error => error.code === 'INVALID_MEDIA');
  }
  const crc = Buffer.from(png); crc[29] ^= 1;
  await assert.rejects(decodeBlogMedia(crc), error => error.code === 'INVALID_MEDIA');
  const bomb = Buffer.from(png); bomb.writeUInt32BE(6001, 16);
  await assert.rejects(decodeBlogMedia(bomb), error => error.code === 'INVALID_MEDIA');
  const pixelsBomb = Buffer.from(png); pixelsBomb.writeUInt32BE(4000, 16); pixelsBomb.writeUInt32BE(3000, 20);
  await assert.rejects(decodeBlogMedia(pixelsBomb), error => error.code === 'INVALID_MEDIA');
  await assert.rejects(decodeBlogMedia(new Uint8Array(BLOG_MEDIA_MAX_BYTES + 1)), error => error.code === 'INVALID_MEDIA');
  for (const text of ['<svg xmlns="http://www.w3.org/2000/svg"/>', '<script>alert(1)</script>', 'RIFFxxxxWEBPxxxx']) await assert.rejects(decodeBlogMedia(new TextEncoder().encode(text)), error => error.code === 'INVALID_MEDIA');
});
function chunk(type, data) {
  const bytes = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit=0;bit<8;bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
  const result = Buffer.alloc(data.length+12);result.writeUInt32BE(data.length,0);bytes.copy(result,4);result.writeUInt32BE((crc ^ 0xffffffff) >>> 0,result.length-4);return result;
}
test('Adam7 PNG has a streaming inflation bound before pngjs; animation frames cannot bypass single-image validation', async () => {
  const plain = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([255,0,0,255]) });
  const header = Buffer.from(plain.subarray(16,29)); header[12] = 1;
  const image = (data, extra = Buffer.alloc(0)) => Buffer.concat([plain.subarray(0,8),chunk('IHDR',header),extra,chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]);
  const good = image(Buffer.from([0,255,0,0,255]));
  assert.equal((await decodeBlogMedia(good)).width,1,'A real single-pixel interlaced PNG remains supported');
  const expanded = Buffer.alloc(2_000_000); expanded.set([0,255,0,0,255]);
  const bomb = image(expanded);
  assert.ok(bomb.length<4096,'Small compressed input would otherwise expand beyond declared scanlines');
  await assert.rejects(decodeBlogMedia(bomb),error=>error.code==='INVALID_MEDIA');
  const animation = Buffer.alloc(8); animation.writeUInt32BE(1,0);
  await assert.rejects(decodeBlogMedia(image(Buffer.from([0,255,0,0,255]),chunk('acTL',animation))),error=>error.code==='INVALID_MEDIA');
});
