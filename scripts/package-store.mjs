/**
 * Zips the *contents* of dist/ into studyflow-store.zip for the Chrome Web Store.
 *
 * manifest.json must sit at the root of the archive, so we add dist/manifest.json
 * as "manifest.json" rather than "dist/manifest.json".
 *
 * Written against node:zlib directly: there is no portable `zip` binary on Windows,
 * and PowerShell 5.1's Compress-Archive writes backslash separators in entry names,
 * which the Web Store rejects.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'studyflow-store.zip');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Returns every file under dir, as POSIX-separated paths relative to dir, sorted. */
function walk(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

/** DOS date/time pair, fixed so builds are reproducible. */
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const name of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = fs.readFileSync(path.join(DIST, name));
    const deflated = deflateRawSync(data, { level: 9 });
    // Fall back to "stored" when deflate does not actually help.
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs: regular file, 0644
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist/ not found. Run `npm run build:store` first.');
    process.exit(1);
  }

  const manifestPath = path.join(DIST, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('dist/manifest.json not found. Run `npm run build:store` first.');
    process.exit(1);
  }

  const files = walk(DIST);
  if (files.length === 0) {
    console.error('dist/ is empty.');
    process.exit(1);
  }

  fs.rmSync(OUT, { force: true });
  fs.writeFileSync(OUT, buildZip(files));

  const { version } = require(manifestPath);
  const sizeKb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`Packaged v${version}: ${files.length} files -> studyflow-store.zip (${sizeKb} kB)`);
}

main();
