#!/usr/bin/env node
/**
 * Hash a reproducible build artifact and write its attestation.
 *
 * Two artifact shapes are supported:
 *   --artifact <file>  a single file (the Android AAB)
 *   --tree <dir>       a directory tree (the iOS .app)
 *
 * The attestation records the hashes, the toolchain fingerprint and the exact
 * list of normalisations that were applied before hashing, so a second machine
 * can tell both "do we match?" and "did we normalise the same things?".
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { normalization: [], contract: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[name] = true;
      continue;
    }
    if (name === 'normalization' || name === 'contract') {
      args[name].push(next);
    } else {
      args[name] = next;
    }
    i += 1;
  }
  return args;
}

function run(cmd, cmdArgs, { allowFailure = false } = {}) {
  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

const sha256File = file =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function walk(dir, base = dir, out = []) {
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name === '.DS_Store') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, base, out);
    } else if (entry.isFile()) {
      out.push({ abs, rel: path.relative(base, abs) });
    }
  }
  return out;
}

function hashTree(dir) {
  const files = walk(dir);
  const lines = files
    .map(
      ({ abs, rel }) => `${sha256File(abs)}  ${rel.split(path.sep).join('/')}`,
    )
    .sort();
  const manifest = lines.join('\n') + (lines.length ? '\n' : '');
  return {
    tree_sha256: crypto.createHash('sha256').update(manifest).digest('hex'),
    file_count: files.length,
    total_bytes: files.reduce((sum, { abs }) => sum + fs.statSync(abs).size, 0),
  };
}

function hashZip(file, bundleEntry) {
  const entries = run('unzip', ['-Z1', file])
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  let bundle = null;
  if (bundleEntry && entries.includes(bundleEntry)) {
    const bytes = execFileSync('unzip', ['-p', file, bundleEntry], {
      maxBuffer: 512 * 1024 * 1024,
    });
    bundle = {
      entry: bundleEntry,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      size: bytes.length,
    };
  }
  return { entry_count: entries.length, bundle };
}

function toolchain() {
  const xcode = run('xcodebuild', ['-version'], { allowFailure: true })
    .split('\n')
    .filter(Boolean);
  const javaVersion = run('sh', ['-c', 'java -version 2>&1 | head -n 1'], {
    allowFailure: true,
  });
  const sdkRoot =
    process.env.ANDROID_SDK_ROOT ||
    process.env.ANDROID_HOME ||
    path.join(os.homedir(), 'Library', 'Android', 'sdk');
  const listDirs = dir =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter(name => fs.statSync(path.join(dir, name)).isDirectory())
          .sort()
      : [];
  const gradleBuildFile = (() => {
    for (const candidate of [
      'android/build.gradle',
      'android/app/build.gradle',
    ]) {
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
    }
    return '';
  })();
  const pinned = name => {
    const match = gradleBuildFile.match(
      new RegExp(`${name}['\"]?\\s*[=:]\\s*['\"]([^'\"]+)['\"]`),
    );
    return match ? match[1] : null;
  };
  const gradleWrapper = (() => {
    const props = 'android/gradle/wrapper/gradle-wrapper.properties';
    if (!fs.existsSync(props)) return null;
    const match = fs
      .readFileSync(props, 'utf8')
      .match(/gradle-([0-9.]+)-bin\.zip/);
    return match ? match[1] : null;
  })();
  return {
    // Native objects embed this path; it is part of the build contract.
    build_root: (() => {
      try {
        return execFileSync('git', ['rev-parse', '--show-toplevel'], {
          encoding: 'utf8',
        }).trim();
      } catch {
        return null;
      }
    })(),
    macos: run('sw_vers', ['-productVersion'], { allowFailure: true }),
    xcode: xcode[0] || null,
    xcode_build: (xcode[1] || '').replace(/^Build version\s*/, '') || null,
    node: process.env.RABBY_REPRODUCE_BUILD_NODE || process.version,
    java: javaVersion || null,
    ruby: run('ruby', ['-v'], { allowFailure: true }).split(' ')[1] || null,
    cocoapods: run('pod', ['--version'], { allowFailure: true }) || null,
    gradle_wrapper: gradleWrapper,
    // Only the versions the project actually pins matter; the list of installed
    // SDK components is host inventory, not part of the build contract.
    ndk_version: pinned('ndkVersion'),
    build_tools_version: pinned('buildToolsVersion'),
    installed_android_ndk: listDirs(path.join(sdkRoot, 'ndk')),
    installed_android_build_tools: listDirs(path.join(sdkRoot, 'build-tools')),
  };
}

function info() {
  return {
    // Paths are recorded for diagnosis only and are excluded from comparisons.
    paths: {
      xcode_select: run('xcode-select', ['-p'], { allowFailure: true }) || null,
      android_sdk:
        process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || null,
    },
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.out || (!args.artifact && !args.tree)) {
  console.error(
    'usage: hash.mjs --platform <android|ios> --channel production --out <dir> (--artifact <file> | --tree <dir>) [--bundle-entry <zip entry>] [--normalization <step>]...',
  );
  process.exit(2);
}

const outDir = path.resolve(args.out);
fs.mkdirSync(outDir, { recursive: true });

const commit =
  run('git', ['rev-parse', 'HEAD'], { allowFailure: true }) || null;
const attest = {
  schemaVersion: 1,
  platform: args.platform,
  channel: args.channel || 'production',
  commit,
  artifact: null,
  tree: null,
  toolchain: toolchain(),
  normalization: args.normalization,
  contract: args.contract,
  builder: {
    host: os.hostname(),
    user: os.userInfo().username,
    builtAt: new Date().toISOString(),
  },
  ...info(),
};

if (args.artifact) {
  const file = path.resolve(args.artifact);
  const stat = fs.statSync(file);
  attest.artifact = {
    name: path.basename(file),
    sha256: sha256File(file),
    size: stat.size,
    ...hashZip(file, args['bundle-entry']),
  };
}
if (args.tree) {
  attest.tree = {
    name: path.basename(path.resolve(args.tree)),
    ...hashTree(path.resolve(args.tree)),
  };
}

const attestPath = path.join(outDir, 'attest.json');
fs.writeFileSync(attestPath, `${JSON.stringify(attest, null, 2)}\n`);

const hashLines = [
  attest.artifact &&
    `- artifact sha256: \`${attest.artifact.sha256}\` (${attest.artifact.size} bytes, ${attest.artifact.entry_count} zip entries)`,
  attest.artifact?.bundle &&
    `- bundle (${attest.artifact.bundle.entry}) sha256: \`${attest.artifact.bundle.sha256}\``,
  attest.tree &&
    `- tree sha256: \`${attest.tree.tree_sha256}\` (${attest.tree.file_count} files, ${attest.tree.total_bytes} bytes)`,
].filter(Boolean);

const report = `# Reproducible build attestation

- platform: \`${attest.platform}\`
- channel: \`${attest.channel}\`
- commit: \`${attest.commit}\`
- builder: ${attest.builder.user}@${attest.builder.host} at ${
  attest.builder.builtAt
}

## Hashes

${hashLines.join('\n')}

## Normalization applied before hashing

${
  attest.normalization.length
    ? attest.normalization.map(item => `- \`${item}\``).join('\n')
    : '- none (raw artifact bytes)'
}

## Toolchain (must match exactly between builders)

${Object.entries(attest.toolchain)
  .map(
    ([key, value]) =>
      `- ${key}: ${
        Array.isArray(value)
          ? value.length
            ? value.join(', ')
            : '(none)'
          : value
      }`,
  )
  .join('\n')}

> Compare \`toolchain\` (excluding \`paths\`) and the hash lines above. A different
> \`normalization\` list means the two builds were not canonicalised the same way.
`;
fs.writeFileSync(path.join(outDir, 'report.md'), report);

console.log(
  JSON.stringify(
    {
      attest: attestPath,
      report: path.join(outDir, 'report.md'),
      hashes: {
        artifact: attest.artifact?.sha256 || null,
        bundle: attest.artifact?.bundle?.sha256 || null,
        tree: attest.tree?.tree_sha256 || null,
      },
      normalization: attest.normalization,
    },
    null,
    2,
  ),
);
