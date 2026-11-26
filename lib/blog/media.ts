import { Buffer } from 'node:buffer';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { createInflate } from 'node:zlib';
import { BlogRuntimeError, blogHash } from '../socialhero/errors.ts';

export const BLOG_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const BLOG_MEDIA_MAX_PIXELS = 8_000_000;
export const BLOG_MEDIA_MAX_SIDE = 6000;
export type DecodedBlogMedia = { bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg'; width: number; height: number; sha256: string; byteLength: number };
const invalid = (): never => { throw new BlogRuntimeError('INVALID_MEDIA', 422); };
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > BLOG_MEDIA_MAX_SIDE || height > BLOG_MEDIA_MAX_SIDE || width * height > BLOG_MEDIA_MAX_PIXELS) invalid();
}
/** pngjs bounds noninterlaced inflation, but its Adam7 path does not. Count the
 * exact scanline bytes in a streaming preflight before either decoder allocates. */
async function boundedPngInflation(bytes: Uint8Array, width: number, height: number): Promise<void> {
  const depth = bytes[24], color = bytes[25], interlace = bytes[28];
  const samples = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
  if (!samples || ![1, 2, 4, 8, 16].includes(depth) || ![0, 1].includes(interlace)) invalid();
  let maximum = 0;
  const passes = interlace ? [[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]] : [[0,0,1,1]];
  for (const [x,y,dx,dy] of passes) {
    const w = Math.ceil(Math.max(0, width-x)/dx), h = Math.ceil(Math.max(0, height-y)/dy);
    if (w && h) maximum += (Math.ceil(w*samples*depth/8)+1)*h;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), compressed: Uint8Array[] = []; let offset = 8, ended = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if (length > bytes.length-offset-12 || ['acTL','fcTL','fdAT'].includes(type)) invalid();
    if (type === 'IDAT') compressed.push(bytes.subarray(offset+8,offset+8+length));
    offset += length+12;
    if (type === 'IEND') { if (length !== 0 || offset !== bytes.length) invalid(); ended = true; break; }
  }
  if (!ended || !compressed.length || !maximum) invalid();
  await new Promise<void>((resolve,reject) => {
    const decoder = createInflate({ chunkSize: 16_384 }); let size = 0;
    decoder.on('data', (chunk: Uint8Array) => { size += chunk.byteLength; if (size > maximum) decoder.destroy(new Error('png_scanline_limit')); });
    decoder.once('error',reject); decoder.once('end',() => size === maximum ? resolve() : reject(new Error('png_scanline_length')));
    decoder.end(Buffer.concat(compressed));
  });
}
/** Read SOF before allocation. A real decoder must still validate the full image. */
function jpegDimensions(bytes: Uint8Array): [number, number] {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) invalid();
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9 || marker === undefined) invalid();
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.length) invalid();
    const size = bytes[offset] * 256 + bytes[offset + 1];
    if (size < 2 || offset + size > bytes.length) invalid();
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (size < 8) invalid();
      return [bytes[offset + 5] * 256 + bytes[offset + 6], bytes[offset + 3] * 256 + bytes[offset + 4]];
    }
    offset += size;
  }
  return invalid();
}
/** Shared validation for manual uploads and machine uploads; headers are not evidence. */
export async function decodeBlogMedia(input: Uint8Array, declaredMime?: string): Promise<DecodedBlogMedia> {
  if (input.byteLength < 12 || input.byteLength > BLOG_MEDIA_MAX_BYTES) invalid();
  const bytes = new Uint8Array(input);
  let mimeType: DecodedBlogMedia['mimeType'], width: number, height: number;
  try {
    if (bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) {
      if (bytes.length < 33 || bytes[8] !== 0 || bytes[9] !== 0 || bytes[10] !== 0 || bytes[11] !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') invalid();
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      width = view.getUint32(16); height = view.getUint32(20); dimensions(width, height);
      await boundedPngInflation(bytes, width, height);
      const decoded = PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
      if (decoded.width !== width || decoded.height !== height || decoded.data.length !== width * height * 4) invalid();
      mimeType = 'image/png';
    } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      [width, height] = jpegDimensions(bytes); dimensions(width, height);
      const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 8, maxMemoryUsageInMB: 128 });
      if (decoded.width !== width || decoded.height !== height || decoded.data.length !== width * height * 4) invalid();
      mimeType = 'image/jpeg';
    } else return invalid();
  } catch { return invalid(); }
  if (declaredMime && declaredMime !== 'application/octet-stream' && declaredMime !== mimeType) invalid();
  return { bytes, mimeType, width, height, sha256: await blogHash(bytes), byteLength: bytes.byteLength };
}
