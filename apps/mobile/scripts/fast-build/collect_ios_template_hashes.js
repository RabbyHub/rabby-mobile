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
  metadataJson: path.join(workDir, 'ios_template_hashes.json'),
  templateHashTxt: path.join(fscriptDir, 'ios_template_shell_sha256.txt'),
  payloadHashTxt: path.join(fscriptDir, 'ios_patchable_payload_sha256.txt'),
  fingerprintTxt: path.join(fscriptDir, 'ios_template_fingerprint.txt'),
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
  'apps/mobile/ios/Pods/**',
  'apps/mobile/ios/build/**',
  'apps/mobile/ios/Package/**',
  'apps/mobile/ios/DerivedData/**',
];

const TEMPLATE_SHELL_INCLUDE_PATTERNS = [
  `${projectDir}/ios/Podfile`,
  `${projectDir}/ios/Podfile.lock`,
  `${projectDir}/ios/RabbyMobile.xcodeproj/project.pbxproj`,
  `${projectDir}/ios/RabbyMobile.xcworkspace/contents.xcworkspacedata`,
  `${projectDir}/ios/**/*.xcconfig`,
  `${projectDir}/ios/**/*.entitlements`,
  `${projectDir}/ios/**/*.plist`,
  `${projectDir}/ios/patches/phase-bundle-rn.sh`,
  `${projectDir}/fastlane/Fastfile`,
  `${repoRoot}/.yarn/patches/*.patch`,
  `${repoRoot}/package.json`,
  `${repoRoot}/yarn.lock`,
  `${projectDir}/package.json`,
  `${projectDir}/app.json`,
  `${projectDir}/react-native.config.js`,
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
  `${projectDir}/ios/link-assets-manifest.json`,
  `${projectDir}/assets/fonts/**/*`,
  `${projectDir}/assets/custom/**/*`,
  `${projectDir}/assets/ios/**/*`,
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

function getCommandValue(command, args, fallback = '', cwd = repoRoot) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

function getGitValue(args, fallback = '') {
  return getCommandValue('git', ['-C', repoRoot, ...args], fallback);
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

  return entries;
}

function buildCanonicalDigest(entries, salts = {}) {
  const canonicalLines = entries.map(entry => `${entry.relpath}:${entry.hash}`);
  Object.keys(salts)
    .sort()
    .forEach(key => {
      canonicalLines.push(`__env__/${key}:${salts[key]}`);
    });

  return sha256(Buffer.from(canonicalLines.join('\n'), 'utf8'));
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
  ensureWorkDir();

  const templateShellFiles = collectManifest(
    'template_shell',
    TEMPLATE_SHELL_INCLUDE_PATTERNS,
    STRUCTURAL_EXCLUDE_PATTERNS,
  );
  const payloadFiles = collectManifest(
    'patchable_payload',
    PATCHABLE_PAYLOAD_INCLUDE_PATTERNS,
    PATCHABLE_PAYLOAD_EXCLUDE_PATTERNS,
  );

  const gitHead = getGitValue(['rev-parse', '--short=12', 'HEAD']);
  const commitDate = getGitValue(['show', '-s', '--format=%cs', 'HEAD']);
  const xcodeVersion = getCommandValue('xcodebuild', ['-version'], '')
    .split('\n')
    .slice(0, 2)
    .join(' | ');
  const cocoapodsVersion = getCommandValue(
    'bundle',
    ['exec', 'pod', '--version'],
    '',
    projectDir,
  );

  const templateShellSalts = {
    cocoapods_version: cocoapodsVersion,
    xcode_version: xcodeVersion,
  };

  const templateHash = buildCanonicalDigest(
    templateShellFiles,
    templateShellSalts,
  );
  const payloadHash = buildCanonicalDigest(payloadFiles);
  const templateFingerprint = buildTemplateFingerprint(
    commitDate,
    templateHash,
  );

  const metadata = {
    version: 1,
    template_hash: templateHash,
    template_fingerprint: templateFingerprint,
    patchable_payload_hash: payloadHash,
    git: {
      head: gitHead,
      commit_date: commitDate,
    },
    environment: {
      xcode_version: xcodeVersion,
      cocoapods_version: cocoapodsVersion,
    },
    sections: {
      template_shell: {
        total_files: templateShellFiles.length,
        digest: templateHash,
        salts: templateShellSalts,
        files: templateShellFiles,
      },
      patchable_payload: {
        total_files: payloadFiles.length,
        digest: payloadHash,
        files: payloadFiles,
      },
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
