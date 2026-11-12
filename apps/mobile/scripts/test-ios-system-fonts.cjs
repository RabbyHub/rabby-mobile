'use strict';

// Node unit/CLI tests for build-time font inspection, not native typography E2E.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { deflateSync } = require('node:zlib');
const { test } = require('node:test');
const {
  auditAppBundle,
  inspectFontBuffer,
  isKnownAppleSystemFont,
} = require('./check-ios-system-fonts.cjs');

const mobileRoot = path.resolve(__dirname, '..');
const cli = path.join(__dirname, 'check-ios-system-fonts.cjs');

function nameTable(names) {
  const strings = names.map(name => Buffer.from(name, 'utf16le').swap16());
  const header = Buffer.alloc(6 + strings.length * 12);
  header.writeUInt16BE(strings.length, 2);
  header.writeUInt16BE(header.length, 4);
  let offset = 0;
  strings.forEach((bytes, index) => {
    const entry = 6 + index * 12;
    header.writeUInt16BE(3, entry);
    header.writeUInt16BE(1, entry + 2);
    header.writeUInt16BE(0x409, entry + 4);
    header.writeUInt16BE(index === 0 ? 1 : 6, entry + 6);
    header.writeUInt16BE(bytes.length, entry + 8);
    header.writeUInt16BE(offset, entry + 10);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...strings]);
}

function sfnt(names, offset = 0) {
  const table = nameTable(names);
  const header = Buffer.alloc(28);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(16, 6);
  header.write('name', 12);
  header.writeUInt32BE(offset + header.length, 20);
  header.writeUInt32BE(table.length, 24);
  return Buffer.concat([header, table]);
}

function woff(names, compress) {
  const table = nameTable(names);
  const encoded = compress ? deflateSync(table) : table;
  assert.ok(encoded.length <= table.length);
  const header = Buffer.alloc(64);
  header.write('wOFF', 0);
  header.writeUInt32BE(0x00010000, 4);
  const padding = Buffer.alloc((4 - (encoded.length % 4)) % 4);
  header.writeUInt32BE(header.length + encoded.length + padding.length, 8);
  header.writeUInt16BE(1, 12);
  header.writeUInt32BE(28 + Math.ceil(table.length / 4) * 4, 16);
  header.write('name', 44);
  header.writeUInt32BE(header.length, 48);
  header.writeUInt32BE(encoded.length, 52);
  header.writeUInt32BE(table.length, 56);
  return Buffer.concat([header, encoded, padding]);
}

function appFixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-font-audit-'));
  const app = path.join(temp, 'Fixture.app');
  fs.mkdirSync(app);
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  return { app, temp };
}

for (const weight of ['Regular', 'Medium', 'Bold', 'Heavy']) {
  test(`rejects real SF Pro Rounded ${weight}, including renamed assets`, t => {
    const { app } = appFixture(t);
    const source = path.join(
      mobileRoot,
      'assets/fonts',
      `SF-Pro-Rounded-${weight}.otf`,
    );
    const bytes = fs.readFileSync(source);
    assert.ok(inspectFontBuffer(bytes).some(isKnownAppleSystemFont));
    fs.writeFileSync(path.join(app, `SF-Pro-Rounded-${weight}.otf`), bytes);
    fs.writeFileSync(path.join(app, 'opaque-metro-hash.otf'), bytes);
    const result = auditAppBundle(app);
    assert.equal(result.issues.length, 2);
    assert.ok(
      result.issues.every(
        issue => issue.reason === 'embedded Apple system font',
      ),
    );
    assert.ok(result.issues.every(issue => issue.names.length > 0));
  });
}

test('allows actual Roboto and a synthetic non-Apple icon family in nested resources', t => {
  const { app } = appFixture(t);
  const nested = path.join(app, 'Resources', 'Icons.bundle');
  fs.mkdirSync(nested, { recursive: true });
  fs.copyFileSync(
    path.join(mobileRoot, 'android/app/src/main/res/font/roboto_regular.ttf'),
    path.join(app, 'Roboto.ttf'),
  );
  fs.writeFileSync(
    path.join(nested, 'icons.otf'),
    sfnt(['Rabby Icons', 'RabbyIcons-Regular']),
  );
  const result = auditAppBundle(app);
  assert.equal(result.fonts.length, 2);
  assert.deepEqual(result.issues, []);
});

test('detects the known Apple family names without disallowing all fonts', () => {
  for (const name of [
    'SFProRounded-Bold',
    '.SF NS Text',
    'SF Compact Display',
    'SFMono-Regular',
    'SF UI Display',
    'NewYorkExtraLarge-Regular',
    'San Francisco',
  ]) {
    assert.equal(isKnownAppleSystemFont(name), true, name);
  }
  for (const name of [
    'Roboto',
    'Ionicons',
    'Material Design Icons',
    'FontAwesome',
    'Times New Roman',
  ]) {
    assert.equal(isKnownAppleSystemFont(name), false, name);
  }
});

test('also rejects obvious Apple filenames when table names were changed', t => {
  const { app } = appFixture(t);
  fs.writeFileSync(
    path.join(app, 'SF-Pro-Rounded-Regular.otf'),
    sfnt(['Other Font']),
  );
  assert.equal(
    auditAppBundle(app).issues[0].reason,
    'embedded Apple system font',
  );
});

test('audits every face of a TTC, not just its first allowed face', t => {
  const { app } = appFixture(t);
  const header = Buffer.alloc(20);
  header.write('ttcf', 0);
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt32BE(2, 8);
  header.writeUInt32BE(header.length, 12);
  const first = sfnt(['Rabby Icons'], header.length);
  const secondOffset = header.length + first.length;
  header.writeUInt32BE(secondOffset, 16);
  const collection = Buffer.concat([
    header,
    first,
    sfnt(['SFCompact-Regular'], secondOffset),
  ]);
  fs.writeFileSync(path.join(app, 'collection.ttc'), collection);
  assert.deepEqual(inspectFontBuffer(collection), [
    'Rabby Icons',
    'SFCompact-Regular',
  ]);
  assert.equal(
    auditAppBundle(app).issues[0].reason,
    'embedded Apple system font',
  );
});

test('reads uncompressed and compressed WOFF identities', t => {
  const { app } = appFixture(t);
  for (const compressed of [false, true]) {
    const bytes = woff(
      ['New York', 'NewYork-Regular', 'NewYork-Regular'],
      compressed,
    );
    assert.ok(inspectFontBuffer(bytes).includes('NewYork-Regular'));
    fs.writeFileSync(path.join(app, `opaque-${compressed}.woff`), bytes);
  }
  assert.equal(auditAppBundle(app).issues.length, 2);
  assert.deepEqual(
    inspectFontBuffer(woff(['Rabby Icons', 'RabbyIcons-Regular'], true)),
    ['Rabby Icons', 'RabbyIcons-Regular'],
  );
});

test('decodes Macintosh identity records and format 1 language-tag storage', () => {
  const mac = sfnt(['Rabby Icons']);
  const nameOffset = 28;
  const recordOffset = nameOffset + 6;
  mac.writeUInt16BE(1, recordOffset);
  mac.writeUInt16BE(0, recordOffset + 2);
  mac.writeUInt16BE(0, recordOffset + 4);
  mac.writeUInt16BE(7, recordOffset + 8);
  mac.write('SF Mono', nameOffset + 18, 'ascii');
  assert.deepEqual(inspectFontBuffer(mac), ['SF Mono']);

  const original = sfnt(['New York']);
  const originalName = original.subarray(nameOffset);
  const header = Buffer.from(original.subarray(0, nameOffset));
  const nameHeader = Buffer.from(originalName.subarray(0, 18));
  const language = Buffer.from('en', 'utf16le').swap16();
  const originalString = originalName.subarray(18);
  const languageRecord = Buffer.alloc(6);
  languageRecord.writeUInt16BE(1, 0);
  languageRecord.writeUInt16BE(language.length, 2);
  languageRecord.writeUInt16BE(originalString.length, 4);
  nameHeader.writeUInt16BE(1, 0);
  nameHeader.writeUInt16BE(24, 4);
  nameHeader.writeUInt16BE(0x8000, 10);
  const table = Buffer.concat([
    nameHeader,
    languageRecord,
    originalString,
    language,
  ]);
  header.writeUInt32BE(table.length, 24);
  assert.deepEqual(inspectFontBuffer(Buffer.concat([header, table])), [
    'New York',
  ]);
});

test('fails closed on unsupported WOFF2 and malformed font structures', t => {
  const { app } = appFixture(t);
  const brokenOffset = sfnt(['Rabby Icons']);
  brokenOffset.writeUInt32BE(0xfffffff0, 20);
  const brokenName = sfnt(['Rabby Icons']);
  brokenName.writeUInt16BE(0xffff, 28 + 6 + 8);
  const missingName = sfnt(['Rabby Icons']);
  missingName.write('cmap', 12);
  const oversizedWoff = woff(['Rabby Icons'], false);
  oversizedWoff.writeUInt32BE(64 * 1024 * 1024 + 1, 56);
  const fixtures = [
    Buffer.from('wOF2'),
    Buffer.from('not a font'),
    Buffer.from([0, 1]),
    brokenOffset,
    brokenName,
    missingName,
    oversizedWoff,
  ];
  fixtures.forEach((bytes, index) => {
    assert.throws(() => inspectFontBuffer(bytes));
    fs.writeFileSync(path.join(app, `broken-${index}.ttf`), bytes);
  });
  assert.equal(auditAppBundle(app).issues.length, fixtures.length);
});

test('rejects directory and font symlinks without following them outside the app', t => {
  const { app, temp } = appFixture(t);
  const outside = path.join(temp, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'font.otf'), sfnt(['SFPro-Regular']));
  fs.symlinkSync(outside, path.join(app, 'linked-directory'));
  fs.symlinkSync(
    path.join(outside, 'font.otf'),
    path.join(app, 'linked-font.otf'),
  );
  const result = auditAppBundle(app);
  assert.equal(result.fonts.length, 0);
  assert.equal(result.issues.length, 2);
  assert.ok(result.issues.every(issue => issue.reason.includes('symlink')));
});

test('validates app paths and CLI exit codes, reporting only relative font paths', t => {
  const { app, temp } = appFixture(t);
  const run = args =>
    spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  assert.equal(run([]).status, 1);
  assert.equal(run([temp]).status, 1);
  assert.equal(run([path.join(temp, 'missing.app')]).status, 1);
  assert.equal(run([app]).status, 0);
  assert.equal(run([`${app}/`]).status, 0);
  const alias = path.join(temp, 'Alias.app');
  fs.symlinkSync(app, alias);
  assert.equal(run([alias]).status, 1);
  fs.writeFileSync(
    path.join(app, 'renamed\nfont.otf'),
    sfnt(['SFPro-Regular']),
  );
  const rejected = run([app]);
  assert.equal(rejected.status, 1);
  assert.ok(rejected.stderr.includes('renamed\\nfont.otf'));
  assert.ok(!rejected.stderr.includes(temp));
  assert.ok(!rejected.stderr.includes('renamed\nfont.otf'));
});
