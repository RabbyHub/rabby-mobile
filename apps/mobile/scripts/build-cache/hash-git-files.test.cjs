'use strict';

// Build-script unit/CLI contract tests, using real temporary Git repositories.
// These do not claim React Native, Hermes, native-build, or device coverage.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const helper = path.join(__dirname, 'hash-git-files.cjs');
const legacyScript = `
repo_root="$1"
shift
legacy_sha() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$@";
  else sha256sum "$@"; fi
}
git -C "$repo_root" ls-files "$@" | LC_ALL=C sort |
while IFS= read -r rel_path; do
  if [ -n "$rel_path" ] && [ -f "$repo_root/$rel_path" ]; then
    file_hash=$(legacy_sha "$repo_root/$rel_path" | awk '{print $1}')
    printf '%s:%s\\n' "$rel_path" "$file_hash"
  fi
done | legacy_sha | awk '{print $1}'
`;

function run(program, args, options = {}) {
  return spawnSync(program, args, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
    ...options,
  });
}

function git(root, args, input) {
  const result = run('git', ['-C', root, ...args], { input });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function repository(t, name = 'repository') {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'rabby-hash-git-files-'),
  );
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, name);
  fs.mkdirSync(root);
  git(root, ['init', '-q']);
  git(root, ['config', 'core.quotePath', 'true']);
  return root;
}

function tracked(root, name, bytes = name) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  git(root, ['add', '--', name]);
  return target;
}

function hash(root, pathspecs = []) {
  return run(process.execPath, [helper, root, ...pathspecs]);
}

function matchesLegacy(root, pathspecs = []) {
  const expected = run('bash', [
    '-c',
    legacyScript,
    'legacy-hash',
    root,
    ...pathspecs,
  ]);
  assert.equal(expected.status, 0, expected.stderr);
  const actual = hash(root, pathspecs);
  assert.equal(actual.status, 0, actual.stderr);
  assert.equal(actual.stderr, '');
  assert.match(actual.stdout, /^[a-f0-9]{64}\n$/);
  assert.equal(actual.stdout, expected.stdout);
  return actual.stdout;
}

test('matches legacy paths, C ordering, binary/empty files, and working-tree edits', t => {
  const root = repository(t, 'repo with spaces');
  tracked(root, 'selected/z.txt', Buffer.from([0, 255, 10, 13, 128]));
  tracked(root, 'selected/A.txt', '');
  const edited = tracked(root, 'selected/file with spaces.txt', 'staged');
  tracked(root, 'other.txt', 'not selected');
  const before = matchesLegacy(root, ['selected']);
  fs.writeFileSync(edited, 'working tree, not the index blob');
  assert.notEqual(matchesLegacy(root, ['selected']), before);
});

test('empty selection is the SHA-256 of an empty stream', t => {
  const root = repository(t);
  tracked(root, 'present.txt');
  assert.equal(
    matchesLegacy(root, ['absent']),
    `${createHash('sha256').digest('hex')}\n`,
  );
});

test('preserves Git quoted paths rather than silently decoding them', t => {
  const root = repository(t);
  for (const name of [
    'normal.txt',
    '中文.txt',
    'tab\tname.txt',
    'line\nname.txt',
    'slash\\name.txt',
    'quote"name.txt',
  ]) {
    tracked(root, name);
  }
  assert.equal(matchesLegacy(root), matchesLegacy(root, ['normal.txt']));
});

test('core.quotePath=false keeps raw Unicode names in C byte order', t => {
  const root = repository(t);
  for (const name of ['z.txt', '\uE000.txt', '\u{10000}.txt', '中文.txt'])
    tracked(root, name);
  const quoted = matchesLegacy(root);
  git(root, ['config', 'core.quotePath', 'false']);
  assert.notEqual(matchesLegacy(root), quoted);
});

test('preserves duplicate index entries from an unresolved merge', t => {
  const root = repository(t);
  tracked(root, 'conflict.txt', 'working content');
  const blob = git(
    root,
    ['hash-object', '-w', '--stdin'],
    'index content',
  ).trim();
  git(
    root,
    ['update-index', '--index-info'],
    `0 ${'0'.repeat(40)}\tconflict.txt\n` +
      [1, 2, 3]
        .map(stage => `100644 ${blob} ${stage}\tconflict.txt\n`)
        .join(''),
  );
  assert.equal(git(root, ['ls-files']).split('\n').filter(Boolean).length, 3);
  matchesLegacy(root);
});

test('skips missing and non-files, follows regular-file symlinks', t => {
  const root = repository(t);
  const gone = tracked(root, 'missing.txt');
  fs.unlinkSync(gone);
  const replaced = tracked(root, 'now-directory');
  fs.unlinkSync(replaced);
  fs.mkdirSync(replaced);
  fs.writeFileSync(path.join(root, 'target.txt'), 'untracked symlink target');
  fs.symlinkSync('target.txt', path.join(root, 'link.txt'));
  fs.symlinkSync('absent-target', path.join(root, 'broken.txt'));
  fs.symlinkSync('now-directory', path.join(root, 'directory-link'));
  git(root, ['add', '--', 'link.txt', 'broken.txt', 'directory-link']);
  const before = matchesLegacy(root);
  fs.writeFileSync(path.join(root, 'target.txt'), 'changed target contents');
  assert.notEqual(matchesLegacy(root), before);
});

test('retains legacy checksum escape prefix for unusual repository paths', t => {
  const root = repository(t, 'repo\\backslash\nand-newline');
  tracked(root, 'ordinary.txt', 'contents');
  matchesLegacy(root);
});

test('streams files larger than its read buffer without changing the digest', t => {
  const root = repository(t);
  tracked(root, 'large.bin', Buffer.alloc(3 * 1024 * 1024 + 17, 0xa5));
  matchesLegacy(root);
});

test('Git failure produces no digest and a nonzero exit', t => {
  const root = repository(t);
  const actual = hash(path.join(root, 'missing-repository'));
  assert.notEqual(actual.status, 0);
  assert.equal(actual.stdout, '');
  assert.equal(actual.stderr, 'hash-git-files: unable to hash Git inputs\n');
});

test(
  'read failure after earlier files produces no partial digest',
  {
    skip: process.platform === 'win32' || process.getuid?.() === 0,
  },
  t => {
    const root = repository(t);
    tracked(root, 'a-readable.txt');
    const unreadable = tracked(root, 'z-unreadable.txt');
    fs.chmodSync(unreadable, 0);
    t.after(() => {
      if (fs.existsSync(unreadable)) fs.chmodSync(unreadable, 0o600);
    });
    const actual = hash(root);
    assert.notEqual(actual.status, 0);
    assert.equal(actual.stdout, '');
    assert.equal(actual.stderr, 'hash-git-files: unable to hash Git inputs\n');
  },
);

test('missing repository argument fails without printing a digest', () => {
  const actual = run(process.execPath, [helper]);
  assert.notEqual(actual.status, 0);
  assert.equal(actual.stdout, '');
});
