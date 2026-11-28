#!/usr/bin/env node
/**
 * Structural digest of a Mach-O executable.
 *
 * Xcode 27.1 does not produce a byte-identical main binary for two clean builds
 * of this project: the linker's synthesised ObjC stubs/selector references shift
 * by one entry, which only changes `LDR` immediates in __text/__objc_stubs/
 * __init_offsets. Everything else - section table, symbols, strings - is stable.
 *
 * The iOS contract therefore compares the executable structurally: the digest
 * covers the section table, the symbol table and the string table. The raw
 * sha256 is still recorded for audit.
 *
 *   node scripts/unsigned/structural.mjs <mach-o file>
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function run(cmd, args, file) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function sectionTable(file) {
  const lines = run('otool', ['-l', file]).split('\n');
  const rows = [];
  let cur = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('sectname')) cur.sect = line.split(/\s+/)[1];
    else if (line.startsWith('segname')) cur.seg = line.split(/\s+/)[1];
    else if (line.startsWith('addr ')) cur.addr = line.split(/\s+/)[1];
    else if (line.startsWith('size ')) cur.size = line.split(/\s+/)[1];
    else if (line.startsWith('offset ')) cur.offset = line.split(/\s+/)[1];
    if (cur.sect && cur.seg && cur.addr && cur.size && cur.offset) {
      rows.push(`${cur.seg},${cur.sect},${cur.addr},${cur.size},${cur.offset}`);
      cur = {};
    }
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
      `sections\n${sectionTable(file)}\nsymbols\n${symbols(
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
