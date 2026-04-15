/* eslint-env node */

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const glob = require('glob');
const minimatch = require('minimatch');

const fscriptDir = path.dirname(__filename);
const scriptDir = path.dirname(fscriptDir);
const projectDir = path.dirname(scriptDir);
const workDir = path.join(scriptDir, '.fast-build-work');
const repoRoot = path.join(projectDir, '..', '..');

const WORK_FILES = {
  metadataJson: path.join(workDir, 'android_native_hashes.json'),
  templateHashTxt: path.join(fscriptDir, 'android_native_files_sha256.txt'),
  payloadHashTxt: path.join(fscriptDir, 'android_patchable_payload_sha256.txt'),
  fingerprintTxt: path.join(fscriptDir, 'android_template_fingerprint.txt'),
};

const STRUCTURAL_EXCLUDE_PATTERNS = [
  '**/*.iml',
  '**/*.log',
  '**/*.tmp',
  '**/*.bak',
  '**/*~',
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/build/**',
  '**/.gradle/**',
  '**/.idea/**',
  '**/.vscode/**',
  '**/.git/**',
  '**/__pycache__/**',
];

const TEMPLATE_SHELL_INCLUDE_PATTERNS = [
  `${projectDir}/android/build.gradle`,
  `${projectDir}/android/settings.gradle`,
  `${projectDir}/android/gradle.properties`,
  `${projectDir}/android/gradle/wrapper/gradle-wrapper.properties`,
  `${projectDir}/android/*.json`,
  `${projectDir}/android/app/*.json`,
  `${projectDir}/android/proguard-rules.pro`,
  `${projectDir}/android/hashcheck.gradle`,
  `${projectDir}/android/hashcheck.cmake`,
  `${projectDir}/android/app/build.gradle`,
  `${projectDir}/android/app/hashcheck.gradle`,
  `${projectDir}/android/app/src/**/*`,
  `${projectDir}/fastlane/Fastfile`,
  `${repoRoot}/.yarn/patches/*.patch`,
  `${repoRoot}/package.json`,
  `${repoRoot}/yarn.lock`,
  `${projectDir}/package.json`,
  `${projectDir}/app.json`,
  `${projectDir}/react-native.config.js`,
];

const TEMPLATE_SHELL_EXCLUDE_PATTERNS = [
  ...STRUCTURAL_EXCLUDE_PATTERNS,
  'apps/mobile/android/app/src/main/assets/fonts/**',
  'apps/mobile/android/app/src/main/assets/custom/**',
  'apps/mobile/android/app/src/main/assets/threads/**',
];

const PATCHABLE_PAYLOAD_INCLUDE_PATTERNS = [
  `${repoRoot}/.yarn/patches/*.patch`,
  `${repoRoot}/package.json`,
  `${repoRoot}/yarn.lock`,
  `${projectDir}/package.json`,
  `${projectDir}/app.json`,
  `${projectDir}/babel.config.js`,
  `${projectDir}/metro.config.js`,
  `${projectDir}/react-native.config.js`,
  `${projectDir}/tsconfig.worker.json`,
  `${projectDir}/scripts/fns.sh`,
  `${projectDir}/android/link-assets-manifest.json`,
  `${projectDir}/assets/fonts/**/*`,
  `${projectDir}/assets/custom/**/*`,
  `${projectDir}/worker-src/**/*`,
  `${repoRoot}/apps/mobile-local-pages/**/*`,
  `${repoRoot}/packages/base-utils/**/*`,
];

const PATCHABLE_PAYLOAD_EXCLUDE_PATTERNS = [
  ...STRUCTURAL_EXCLUDE_PATTERNS,
  '**/*.md',
];

function getFilesFromGlob(patterns) {
  const options = {
    nodir: true,
    dot: false,
    absolute: true,
    follow: false,
  };

  const files = new Set();
  for (const pattern of patterns) {
    for (const file of glob.sync(pattern, options)) {
      files.add(path.normalize(file));
    }
  }
  return Array.from(files).sort();
}

function matchesAnyPattern(relpath, patterns) {
  return patterns.some(pattern =>
    minimatch(relpath, pattern, {
      dot: false,
      nocase: true,
    }),
  );
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function getFileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function ensureWorkDir() {
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }
}

function getGitValue(args, fallback = '') {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

function collectManifest(sectionName, includePatterns, excludePatterns) {
  let files = getFilesFromGlob(includePatterns);
  files = files.filter(file => {
    const relpath = path.relative(repoRoot, file);
    return !matchesAnyPattern(relpath, excludePatterns);
  });

  if (files.length === 0) {
    throw new Error(`No matching files found for section: ${sectionName}`);
  }

  const entries = files
    .map(file => {
      const relpath = path.relative(repoRoot, file);
      return {
        relpath,
        hash: getFileSha256(file),
      };
    })
    .sort((a, b) => a.relpath.localeCompare(b.relpath));

  const canonicalManifest = entries
    .map(entry => `${entry.relpath}:${entry.hash}`)
    .join('\n');

  return {
    section: sectionName,
    total_files: entries.length,
    digest: sha256(Buffer.from(canonicalManifest, 'utf8')),
    files: entries,
  };
}

function buildTemplateFingerprint(commitDate, templateHash) {
  const fallbackDate = commitDate || 'unknown-date';
  return `${fallbackDate}-${templateHash.slice(0, 8)}_${templateHash.slice(
    -8,
  )}`;
}

function writeTextFile(filepath, value) {
  fs.writeFileSync(filepath, `${value}\n`);
}

function calculateHash() {
  console.log(
    'Collecting Android template shell and patchable payload manifests...',
  );

  ensureWorkDir();

  const templateShell = collectManifest(
    'template_shell',
    TEMPLATE_SHELL_INCLUDE_PATTERNS,
    TEMPLATE_SHELL_EXCLUDE_PATTERNS,
  );
  const patchablePayload = collectManifest(
    'patchable_payload',
    PATCHABLE_PAYLOAD_INCLUDE_PATTERNS,
    PATCHABLE_PAYLOAD_EXCLUDE_PATTERNS,
  );

  const gitHead = getGitValue(['rev-parse', '--short=12', 'HEAD']);
  const commitDate = getGitValue(['show', '-s', '--format=%cs', 'HEAD']);
  const templateHash = templateShell.digest;
  const payloadHash = patchablePayload.digest;
  const templateFingerprint = buildTemplateFingerprint(
    commitDate,
    templateHash,
  );

  const metadata = {
    version: 2,
    template_hash: templateHash,
    template_fingerprint: templateFingerprint,
    patchable_payload_hash: payloadHash,
    git: {
      head: gitHead,
      commit_date: commitDate,
    },
    sections: {
      template_shell: templateShell,
      patchable_payload: patchablePayload,
    },
  };

  fs.writeFileSync(WORK_FILES.metadataJson, JSON.stringify(metadata, null, 2));
  writeTextFile(WORK_FILES.templateHashTxt, templateHash);
  writeTextFile(WORK_FILES.payloadHashTxt, payloadHash);
  writeTextFile(WORK_FILES.fingerprintTxt, templateFingerprint);

  console.log(`Template shell hash: ${templateHash}`);
  console.log(`Patchable payload hash: ${payloadHash}`);
  console.log(`Template fingerprint: ${templateFingerprint}`);
  console.log(`Saved metadata to: ${WORK_FILES.metadataJson}`);
  console.log(`Saved template hash to: ${WORK_FILES.templateHashTxt}`);
  console.log(`Saved payload hash to: ${WORK_FILES.payloadHashTxt}`);
  console.log(`Saved template fingerprint to: ${WORK_FILES.fingerprintTxt}`);
  console.log(`TEMPLATE_HASH="${templateHash}"`);
  console.log(`PATCHABLE_PAYLOAD_HASH="${payloadHash}"`);
  console.log(`export TEMPLATE_FINGERPRINT="${templateFingerprint}"`);
}

const command = process.argv[2];

switch (command) {
  case 'calculate_hash':
    calculateHash();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
