#!/usr/bin/env node
'use strict';

// Build-time resource audit, not a complete font validator or license checker.
// Check font identity, not only filenames: Metro can rename bundled assets.
// name table: https://learn.microsoft.com/en-us/typography/opentype/spec/name
// WOFF 1: https://www.w3.org/TR/WOFF/
const fs = require('node:fs');
const path = require('node:path');
const { inflateSync } = require('node:zlib');

const FONT_EXTENSION = /\.(?:otf|ttf|ttc|woff|woff2)$/i;
const NAME_IDS = new Set([1, 4, 6, 16, 18, 21, 25]);
const MAX_FONT_BYTES = 64 * 1024 * 1024;
const MAX_NAME_BYTES = 1024 * 1024;
const MAX_TABLES = 256;
const MAX_FACES = 128;
const MAX_ENTRIES = 100000;
const MAX_DEPTH = 64;

class AuditError extends Error {}

function ensure(condition, message) {
  if (!condition) throw new AuditError(message);
}

function range(buffer, offset, length) {
  ensure(
    Number.isSafeInteger(offset) &&
      Number.isSafeInteger(length) &&
      offset >= 0 &&
      length >= 0 &&
      offset <= buffer.length - length,
    'malformed font: table or string is outside the file',
  );
  return buffer.subarray(offset, offset + length);
}

function isKnownAppleSystemFont(name) {
  const normalized = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return /^(?:sfpro|sfcompact|sfmono|sfrounded|sfui|sfns|sanfrancisco|newyork)/.test(
    normalized,
  );
}

function decodeUnicode(bytes) {
  ensure(bytes.length % 2 === 0, 'malformed font: odd UTF-16 name length');
  try {
    return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  } catch {
    throw new AuditError('malformed font: invalid UTF-16 name');
  }
}

function readNameTable(table) {
  ensure(table.length <= MAX_NAME_BYTES, 'font name table exceeds audit limit');
  range(table, 0, 6);
  const version = table.readUInt16BE(0);
  const count = table.readUInt16BE(2);
  const storage = table.readUInt16BE(4);
  ensure(version === 0 || version === 1, 'unsupported font name table version');
  ensure(
    count > 0 && count <= 4096,
    'invalid or oversized font name record count',
  );
  let recordsEnd = 6 + count * 12;
  range(table, 0, recordsEnd);
  if (version === 1) {
    range(table, recordsEnd, 2);
    const languageCount = table.readUInt16BE(recordsEnd);
    ensure(languageCount <= 4096, 'font language records exceed audit limit');
    const languageStart = recordsEnd + 2;
    recordsEnd = languageStart + languageCount * 4;
    range(table, 0, recordsEnd);
    for (let index = 0; index < languageCount; index += 1) {
      const entry = languageStart + index * 4;
      decodeUnicode(
        range(
          table,
          storage + table.readUInt16BE(entry + 2),
          table.readUInt16BE(entry),
        ),
      );
    }
  }
  ensure(
    storage >= recordsEnd && storage <= table.length,
    'invalid font name storage',
  );
  const names = new Set();
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 12;
    const platform = table.readUInt16BE(entry);
    const encoding = table.readUInt16BE(entry + 2);
    const nameId = table.readUInt16BE(entry + 6);
    const bytes = range(
      table,
      storage + table.readUInt16BE(entry + 10),
      table.readUInt16BE(entry + 8),
    );
    if (!NAME_IDS.has(nameId)) continue;
    let name;
    if (platform === 0 || (platform === 3 && [0, 1, 10].includes(encoding))) {
      name = decodeUnicode(bytes);
    } else if (platform === 1 && encoding === 0) {
      name = new TextDecoder('macintosh', { fatal: true }).decode(bytes);
    } else {
      continue;
    }
    if (name.trim()) names.add(name.trim());
  }
  ensure(names.size > 0, 'font has no supported readable identity names');
  return [...names];
}

function validSfntSignature(buffer, offset) {
  range(buffer, offset, 4);
  return (
    buffer.readUInt32BE(offset) === 0x00010000 ||
    ['OTTO', 'true', 'typ1'].includes(
      buffer.toString('ascii', offset, offset + 4),
    )
  );
}

function readSfnt(buffer, offset) {
  ensure(validSfntSignature(buffer, offset), 'unsupported font signature');
  range(buffer, offset, 12);
  const count = buffer.readUInt16BE(offset + 4);
  ensure(
    count > 0 && count <= MAX_TABLES,
    'invalid or oversized font table count',
  );
  range(buffer, offset + 12, count * 16);
  const tags = new Set();
  let names;
  for (let index = 0; index < count; index += 1) {
    const entry = offset + 12 + index * 16;
    const tag = buffer.toString('ascii', entry, entry + 4);
    ensure(!tags.has(tag), 'malformed font: duplicate table');
    tags.add(tag);
    const table = range(
      buffer,
      buffer.readUInt32BE(entry + 8),
      buffer.readUInt32BE(entry + 12),
    );
    if (tag === 'name') names = readNameTable(table);
  }
  ensure(names, 'font is missing its name table');
  return names;
}

function readWoff(buffer) {
  range(buffer, 0, 44);
  ensure(validSfntSignature(buffer, 4), 'unsupported WOFF font flavor');
  ensure(
    buffer.readUInt32BE(8) === buffer.length,
    'malformed WOFF file length',
  );
  ensure(buffer.readUInt16BE(14) === 0, 'malformed WOFF reserved field');
  const count = buffer.readUInt16BE(12);
  ensure(
    count > 0 && count <= MAX_TABLES,
    'invalid or oversized WOFF table count',
  );
  const directoryEnd = 44 + count * 20;
  range(buffer, 44, count * 20);
  const tags = new Set();
  let names;
  let sfntSize = 12 + count * 16;
  for (let index = 0; index < count; index += 1) {
    const entry = 44 + index * 20;
    const tag = buffer.toString('ascii', entry, entry + 4);
    ensure(!tags.has(tag), 'malformed WOFF: duplicate table');
    tags.add(tag);
    const offset = buffer.readUInt32BE(entry + 4);
    const compressedLength = buffer.readUInt32BE(entry + 8);
    const originalLength = buffer.readUInt32BE(entry + 12);
    ensure(
      offset >= directoryEnd &&
        offset % 4 === 0 &&
        compressedLength <= originalLength &&
        originalLength <= MAX_FONT_BYTES,
      'malformed or oversized WOFF table',
    );
    const stored = range(buffer, offset, compressedLength);
    sfntSize += Math.ceil(originalLength / 4) * 4;
    ensure(
      sfntSize <= MAX_FONT_BYTES,
      'WOFF decompressed size exceeds audit limit',
    );
    if (tag === 'name') {
      ensure(
        originalLength <= MAX_NAME_BYTES,
        'font name table exceeds audit limit',
      );
      let table = stored;
      if (compressedLength < originalLength) {
        try {
          table = inflateSync(stored, { maxOutputLength: MAX_NAME_BYTES });
        } catch {
          throw new AuditError(
            'malformed or oversized compressed WOFF name table',
          );
        }
      }
      ensure(
        table.length === originalLength,
        'malformed WOFF name table length',
      );
      names = readNameTable(table);
    }
  }
  ensure(sfntSize === buffer.readUInt32BE(16), 'malformed WOFF sfnt size');
  ensure(names, 'font is missing its name table');
  return names;
}

function inspectFontBuffer(buffer) {
  ensure(Buffer.isBuffer(buffer), 'font input must be bytes');
  ensure(buffer.length <= MAX_FONT_BYTES, 'font exceeds audit size limit');
  range(buffer, 0, 4);
  const signature = buffer.toString('ascii', 0, 4);
  if (signature === 'wOF2') {
    throw new AuditError(
      'WOFF2 is unsupported by this audit; decode and audit it before shipping',
    );
  }
  if (signature === 'wOFF') return readWoff(buffer);
  if (signature !== 'ttcf') return readSfnt(buffer, 0);
  range(buffer, 0, 12);
  ensure(
    [0x00010000, 0x00020000].includes(buffer.readUInt32BE(4)),
    'unsupported font collection version',
  );
  const count = buffer.readUInt32BE(8);
  ensure(
    count > 0 && count <= MAX_FACES,
    'invalid or oversized font collection',
  );
  range(buffer, 12, count * 4);
  if (buffer.readUInt32BE(4) === 0x00020000) range(buffer, 12 + count * 4, 12);
  const names = new Set();
  for (let index = 0; index < count; index += 1) {
    for (const name of readSfnt(buffer, buffer.readUInt32BE(12 + index * 4))) {
      names.add(name);
    }
  }
  return [...names];
}

function auditAppBundle(appPath) {
  ensure(
    typeof appPath === 'string' && appPath.length > 0,
    'expected one .app directory',
  );
  const root = path.resolve(appPath);
  ensure(root.endsWith('.app'), 'expected one .app directory');
  let rootStat;
  try {
    rootStat = fs.lstatSync(root);
  } catch {
    throw new AuditError('app directory does not exist or is unreadable');
  }
  ensure(
    rootStat.isDirectory() && !rootStat.isSymbolicLink(),
    'app must be a real directory, not a symlink',
  );
  const result = { fonts: [], issues: [] };
  let entries = 0;
  function visit(directory, depth) {
    ensure(depth <= MAX_DEPTH, 'bundle directory depth exceeds audit limit');
    for (const name of fs.readdirSync(directory).sort()) {
      entries += 1;
      ensure(entries <= MAX_ENTRIES, 'bundle entry count exceeds audit limit');
      const absolute = path.join(directory, name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        // Do not silently skip a directory link that could conceal font assets.
        result.issues.push({
          path: relative,
          reason: 'symlink cannot be audited safely',
        });
      } else if (stat.isDirectory()) {
        visit(absolute, depth + 1);
      } else if (FONT_EXTENSION.test(name)) {
        try {
          ensure(stat.isFile(), 'font is not a regular file');
          ensure(stat.size <= MAX_FONT_BYTES, 'font exceeds audit size limit');
          const fd = fs.openSync(
            absolute,
            fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
          );
          let bytes;
          try {
            const opened = fs.fstatSync(fd);
            ensure(
              opened.isFile() &&
                opened.dev === stat.dev &&
                opened.ino === stat.ino &&
                opened.size === stat.size,
              'font changed during audit',
            );
            // Allocate only the preflighted size, even if a concurrent writer
            // grows the file. This audit runs on a completed, quiescent bundle.
            bytes = Buffer.alloc(opened.size);
            let read = 0;
            while (read < bytes.length) {
              const count = fs.readSync(
                fd,
                bytes,
                read,
                bytes.length - read,
                read,
              );
              ensure(count > 0, 'font changed during audit');
              read += count;
            }
            const after = fs.fstatSync(fd);
            ensure(
              after.size === stat.size && after.mtimeMs === stat.mtimeMs,
              'font changed during audit',
            );
          } finally {
            fs.closeSync(fd);
          }
          const names = inspectFontBuffer(bytes);
          result.fonts.push({ path: relative, names });
          const knownNames = names.filter(isKnownAppleSystemFont);
          if (
            knownNames.length ||
            isKnownAppleSystemFont(path.parse(name).name)
          ) {
            result.issues.push({
              path: relative,
              reason: 'embedded Apple system font',
              names: knownNames,
            });
          }
        } catch (error) {
          result.issues.push({
            path: relative,
            reason:
              error instanceof AuditError
                ? error.message
                : 'font could not be read or parsed',
          });
        }
      }
    }
  }
  visit(root, 0);
  return result;
}

function main(args = process.argv.slice(2)) {
  try {
    ensure(
      args.length === 1,
      'usage: node check-ios-system-fonts.cjs <path/to/App.app>',
    );
    const result = auditAppBundle(args[0]);
    for (const issue of result.issues.slice(0, 100)) {
      // JSON quoting keeps control characters in filenames/names out of logs.
      const display = {
        ...issue,
        names: issue.names?.slice(0, 8).map(name => name.slice(0, 160)),
      };
      const serialized = JSON.stringify(display).replace(
        /[\u202a-\u202e\u2066-\u2069]/g,
        character => `\\u${character.charCodeAt(0).toString(16)}`,
      );
      console.error(`[ios-font-audit] ${serialized}`);
    }
    if (result.issues.length) {
      console.error(
        `[ios-font-audit] FAILED: ${result.issues.length} issue(s).`,
      );
      return 1;
    }
    console.log(
      `[ios-font-audit] Passed: ${result.fonts.length} font file(s); no known SF/New York system families embedded.`,
    );
    return 0;
  } catch (error) {
    console.error(
      `[ios-font-audit] FAILED: ${
        error instanceof AuditError
          ? error.message
          : 'bundle could not be inspected'
      }`,
    );
    return 1;
  }
}

module.exports = {
  auditAppBundle,
  inspectFontBuffer,
  isKnownAppleSystemFont,
  main,
};
if (require.main === module) process.exitCode = main();
