#!/usr/bin/env node
/**
 * Canonicalise duplicate __got slots in a linked arm64 Mach-O executable.
 *
 * ld64 creates more than one __got atom for `_objc_msgSend` and sorts them by
 * name only, so a tie decides which of the identical slots a code reference
 * uses - and that tie is resolved by the parallel stub/GOT builder, i.e.
 * differently on almost every link.
 *
 * This pass rewrites every `adrp + ldr` reference that targets a duplicated
 * __got slot so it uses the lowest-addressed slot of that symbol. The slots
 * hold the same value, so the binary behaves identically, but two builds now
 * agree byte for byte (LC_UUID is content-derived and follows).
 *
 *   node scripts/unsigned/canonicalize-got.mjs <macho> [--check]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const file = process.argv[2];
const rootArgIndex = process.argv.indexOf('--root');
const buildRoot = rootArgIndex > 0 ? process.argv[rootArgIndex + 1] : null;
const checkOnly = process.argv.includes('--check');
if (!file) {
  console.error('usage: canonicalize-got.mjs <macho> [--check]');
  process.exit(2);
}

const data = fs.readFileSync(file);
if (data.readUInt32LE(0) !== 0xfeedfacf) {
  console.error('[got] not a 64-bit Mach-O');
  process.exit(2);
}

const ncmds = data.readUInt32LE(16);
let offset = 32;
let symtab = null;
let dysymtab = null;
let uuidOffset = -1;
const sections = [];

for (let i = 0; i < ncmds; i += 1) {
  const cmd = data.readUInt32LE(offset);
  const size = data.readUInt32LE(offset + 4);
  if (cmd === 0x19) {
    // LC_SEGMENT_64
    const nsects = data.readUInt32LE(offset + 64);
    let sectionOffset = offset + 72;
    for (let s = 0; s < nsects; s += 1) {
      const sectname = data
        .subarray(sectionOffset, sectionOffset + 16)
        .toString('utf8')
        .replace(/\0.*$/, '');
      const addr = Number(data.readBigUInt64LE(sectionOffset + 32));
      const sizeBytes = Number(data.readBigUInt64LE(sectionOffset + 40));
      const fileOffset = data.readUInt32LE(sectionOffset + 48);
      sections.push({ sectname, addr, size: sizeBytes, offset: fileOffset });
      sectionOffset += 80;
    }
  } else if (cmd === 0x2) {
    symtab = {
      symoff: data.readUInt32LE(offset + 8),
      nsyms: data.readUInt32LE(offset + 12),
      stroff: data.readUInt32LE(offset + 16),
    };
  } else if (cmd === 0xb) {
    dysymtab = {
      indirectsymoff: data.readUInt32LE(offset + 56),
      nindirectsyms: data.readUInt32LE(offset + 60),
    };
  } else if (cmd === 0x1b) {
    // LC_UUID
    uuidOffset = offset + 8;
  }
  offset += size;
}

if (!symtab || !dysymtab) {
  console.error('[got] missing symbol tables');
  process.exit(2);
}

const symbolName = index => {
  const strx = data.readUInt32LE(symtab.symoff + index * 16);
  const start = symtab.stroff + strx;
  let end = start;
  while (end < data.length && data[end] !== 0) end += 1;
  return data.subarray(start, end).toString('utf8');
};

const indirect = index =>
  data.readUInt32LE(dysymtab.indirectsymoff + index * 4);

const got = sections.find(s => s.sectname === '__got');
const text = sections.find(s => s.sectname === '__text');
if (!got || !text) {
  console.log('[got] no __got/__text section; nothing to do');
  process.exit(0);
}

// Group __got slots by their encoded value: chained fixups store the same bind
// encoding for identical targets, so equal values mean equivalent slots.
const byValue = new Map();
for (let i = 0; i < got.size / 8; i += 1) {
  const valueOffset = got.offset + i * 8;
  const value = data.readBigUInt64LE(valueOffset).toString(16);
  const addr = got.addr + i * 8;
  if (!byValue.has(value)) byValue.set(value, []);
  byValue.get(value).push(addr);
}

const canonical = new Map();
for (const [, addresses] of byValue) {
  if (addresses.length < 2) continue;
  const first = Math.min(...addresses);
  for (const address of addresses)
    if (address !== first) canonical.set(address, first);
}
if (canonical.size === 0) {
  console.log('[got] no duplicated slots; nothing to do');
  process.exit(0);
}

let patched = 0;
const scanSections = sections.filter(s =>
  ['__text', '__objc_stubs', '__stubs', '__stub_helper'].includes(s.sectname),
);
for (const scan of scanSections) {
  let adrpReg = -1;
  let adrpPage = 0;
  let adrpAge = 0;
  for (let i = 0; i + 8 <= scan.size; i += 4) {
    const wordOffset = scan.offset + i;
    const word = data.readUInt32LE(wordOffset);
    if ((word & 0x9f000000) >>> 0 === 0x90000000) {
      adrpReg = word & 0x1f;
      const pc = scan.addr + i;
      const immlo = (word >>> 29) & 0x3;
      let immhi = (word >>> 5) & 0x7ffff;
      if (immhi & 0x40000) immhi -= 0x80000;
      adrpPage =
        Math.floor(pc / 0x1000) * 0x1000 + (immhi * 4 + immlo) * 0x1000;
      adrpAge = 0;
      continue;
    }
    adrpAge += 1;
    const isLdr =
      (word & 0xffc00000) >>> 0 === 0xf9400000 ||
      (word & 0xffc00000) >>> 0 === 0xb9400000;
    if (!isLdr || ((word >>> 5) & 0x1f) !== adrpReg || adrpAge > 8) {
      adrpReg = -1;
      continue;
    }
    const page = adrpPage;
    const scale = (word & 0xffc00000) >>> 0 === 0xf9400000 ? 8 : 4;
    const target = page + ((word >>> 10) & 0xfff) * scale;
    const replacement = canonical.get(target);
    if (replacement !== undefined) {
      const delta = replacement - target;
      if (delta % scale !== 0) continue;
      const imm = ((word >>> 10) & 0xfff) + delta / scale;
      if (imm < 0 || imm > 0xfff) continue;
      if (!checkOnly) {
        data.writeUInt32LE(
          ((word & ~(0xfff << 10)) | (imm << 10)) >>> 0,
          wordOffset,
        );
      }
      patched += 1;
    }
    adrpReg = -1;
  }
}

// Swift's frontend embeds the length of the source path in the `mov w2` of
// every `_swift_isEscapingClosureAtFileLocation` call; no flag remaps it. The
// suffix is identical across builders, only the root prefix differs, so rewrite
// the immediate to `suffix + len('/rabby')`.
let escapingPatched = 0;
if (buildRoot) {
  // Xcode canonicalises /private/... to /... before handing paths to the
  // compiler, so that is the prefix the frontend baked in.
  const effectiveRoot = buildRoot.replace(/^\/private\//, '/');
  const textSection = sections.find(s => s.sectname === '__text');
  const sites = [];
  for (let i = 0; i + 20 <= textSection.size; i += 4) {
    const at = textSection.offset + i;
    const word = data.readUInt32LE(at);
    if ((word & 0x7f800000) >>> 0 !== 0x52800000) continue;
    if ((word & 0x1f) !== 2) continue;
    const next = [1, 2, 3].map(k => data.readUInt32LE(at + k * 4));
    if (next.some(w => (w & 0x7f800000) >>> 0 !== 0x52800000)) continue;
    if (((next[2] >>> 5) & 0xffff) !== 1) continue;
    const branch = data.readUInt32LE(at + 16);
    if (branch >>> 26 !== 0b100101) continue;
    sites.push({ at, word, imm: (word >>> 5) & 0xffff });
  }
  const rootLength = effectiveRoot.length;
  if (process.env.RABBY_CANONICALIZE_DEBUG) {
    console.log(
      '[got] escaping root length',
      rootLength,
      'sites',
      sites.length,
    );
  }
  for (const site of sites) {
    const replacement = site.imm - rootLength + '/rabby'.length;
    if (replacement < 0 || replacement > 0xfff) continue;
    if (!checkOnly) {
      data.writeUInt32LE(
        ((site.word & ~(0xffff << 5)) | (replacement << 5)) >>> 0,
        site.at,
      );
    }
    escapingPatched += 1;
  }
}

if (!checkOnly && (patched || escapingPatched)) {
  // The UUID is content-derived at link time, so it differs between two links
  // even when everything else now agrees. Re-derive it from the canonical bytes.
  if (uuidOffset > 0) {
    data.fill(0, uuidOffset, uuidOffset + 16);
    const digest = crypto.createHash('sha256').update(data).digest();
    digest.copy(data, uuidOffset, 0, 16);
  }
  fs.writeFileSync(file, data);
}
console.log(
  `[got] duplicated symbols=${canonical.size} patched-references=${patched} ` +
    `escaping-closure-lengths=${escapingPatched}`,
);
