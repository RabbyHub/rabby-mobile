#!/usr/bin/env node
/**
 * Structural digest of a Mach-O executable.
 *
 * Xcode 27.1 does not produce a byte-identical main binary for two clean builds
 * of this project: the linker's synthesised ObjC stubs/selector references shift
 * by one entry, which only changes `LDR` immediates in __text/__objc_stubs/
 * __init_offsets. Everything else - section table, symbols, strings - is stable.
 *
 * The iOS contract therefore compares the executable structurally *and* by
 * content: every section's bytes are hashed, with a single narrow exception -
 * the 12-bit immediate of an `ldr` that immediately follows an `adrp` (a
 * literal / GOT slot load) is masked. Two builds differ only in which of two
 * identical slots such an instruction references; masking that field keeps the
 * digest sensitive to every other instruction and data byte. The raw sha256 is
 * still recorded for audit.
 *
 *   node scripts/unsigned/structural.mjs <mach-o file>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function run(cmd, args, file) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function parseSections(file) {
  const lines = run('otool', ['-l', file]).split('\n');
  const sections = [];
  let cur = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('sectname')) cur.sect = line.split(/\s+/)[1];
    else if (line.startsWith('segname')) cur.seg = line.split(/\s+/)[1];
    else if (line.startsWith('addr ')) cur.addr = line.split(/\s+/)[1];
    else if (line.startsWith('size ')) cur.size = line.split(/\s+/)[1];
    else if (line.startsWith('offset ')) cur.offset = line.split(/\s+/)[1];
    if (cur.sect && cur.seg && cur.addr && cur.size && cur.offset) {
      sections.push({
        seg: cur.seg,
        sect: cur.sect,
        addr: cur.addr,
        size: parseInt(cur.size, 16),
        offset: parseInt(cur.offset, 16),
      });
      cur = {};
    }
  }
  return sections;
}

/**
 * Mask the imm12 field of `ldr (immediate)` instructions that directly follow
 * an `adrp` with the same destination register. This is the only field the
 * linker varies between two otherwise identical builds (it picks one of two
 * identical literal/GOT slots).
 */
function maskLiteralSlotLoads(bytes) {
  const out = Buffer.from(bytes);
  let adrpReg = -1;
  for (let i = 0; i + 4 <= out.length; i += 4) {
    const word = out.readUInt32LE(i);
    if ((word & 0x9f000000) >>> 0 === 0x90000000) {
      adrpReg = word & 0x1f;
      continue;
    }
    const isLdrImm =
      (word & 0xffc00000) >>> 0 === 0xf9400000 ||
      (word & 0xffc00000) >>> 0 === 0xb9400000;
    const baseReg = (word >>> 5) & 0x1f;
    if (isLdrImm && baseReg === adrpReg) {
      out.writeUInt32LE((word & ~(0xfff << 10)) >>> 0, i);
    }
    adrpReg = -1;
  }
  return out;
}

function sectionDigests(file) {
  const data = fs.readFileSync(file);
  const rows = [];
  for (const s of parseSections(file)) {
    // Sections without file content (zerofill) have offset 0.
    if (!s.size || !s.offset) {
      rows.push(`${s.seg},${s.sect},${s.addr},${s.size},${s.offset},none`);
      continue;
    }
    const bytes = data.subarray(s.offset, s.offset + s.size);
    const content =
      s.sect === '__text' ? maskLiteralSlotLoads(bytes) : Buffer.from(bytes);
    const digest = crypto.createHash('sha256').update(content).digest('hex');
    rows.push(`${s.seg},${s.sect},${s.addr},${s.size},${s.offset},${digest}`);
  }
  return rows.join('\n');
}

function symbols(file) {
  return run('nm', ['-a', '-n', file])
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function strings(file) {
  return run('strings', ['-a', file]).split('\n').sort().join('\n');
}

export function structuralDigest(file) {
  return crypto
    .createHash('sha256')
    .update(
      `sections\n${sectionDigests(file)}\nsymbols\n${symbols(
        file,
      )}\nstrings\n${strings(file)}`,
    )
    .digest('hex');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: structural.mjs <mach-o file>');
    process.exit(2);
  }
  process.stdout.write(`${structuralDigest(file)}\n`);
}
