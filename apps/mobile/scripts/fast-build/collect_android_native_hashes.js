// collect-native-hash.js
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const glob = require('glob');

// eslint-disable-next-line no-undef
const fscript_dir = path.dirname(__filename);
const script_dir = path.dirname(fscript_dir);
const project_dir = path.dirname(script_dir);
const work_dir = path.join(script_dir, '.fast-build-work');
const root_dir = path.join(project_dir, '..', '..');

const WORK_FILES = {
  android_native_files: path.join(work_dir, 'android_native_hashes.json'),
  fingerprint_txt: path.join(fscript_dir, 'android_native_files_sha256.txt'),
};

// ==================== Include Patterns ====================
const includePatterns = [
  `${project_dir}/android/app/src/**/*`,
  `${project_dir}/android/build.gradle`,
  `${project_dir}/android/*.json`,
  `${project_dir}/android/app/*.json`,
  `${project_dir}/android/proguard-rules.pro`,
  `${project_dir}/fastlane/Fastfile`,

  // # 3rd deps parts
  `${project_dir}/../../.yarn/patches/*.patch`,
  `${project_dir}/../../package.json`,
  `${project_dir}/../../yarn.lock`,
  // # changes of react-native-* may affect the native part
  `${project_dir}/package.json`,
  `${project_dir}/app.json`,
  `${project_dir}/react-native.config.js`,
  // # "$project_dir/assets/fonts"
];

// ==================== Exclude Patterns ====================
const excludePatterns = [
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
  '**/*.md',
  '**/*.txt',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.png',
  '**/*.gif',
  '**/*.webp',
  // '**/*.otf',
  // '**/*.ttf',
  '**/*.pdf',
  '**/.*',
];

// ==================== Utility Functions ====================
function getFilesFromGlob(patterns) {
  const options = {
    nodir: true,
    dot: false,
    absolute: false,
    follow: false,
  };
  const files = new Set();
  patterns.forEach(pattern => {
    glob.sync(pattern, options).forEach(file => {
      files.add(path.normalize(file));
    });
  });
  return Array.from(files).sort();
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function getFileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

// ==================== Main Logic ====================
function calculate_hash() {
  console.log('🔍 Collecting Android native files...');

  // 1. Collect all matching files
  let files = getFilesFromGlob(includePatterns);

  // 2. Exclude unnecessary files
  const excludeRegex = new RegExp(
    excludePatterns
      .map(
        p =>
          p
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex
            .replace(/\\\*\\\*/g, '.*') // ** -> .*
            .replace(/\\\*/g, '[^/]*'), // * -> [^/]*
      )
      .join('|'),
    'i',
  );
  files = files.filter(file => !excludeRegex.test(file));

  if (files.length === 0) {
    console.error(
      '❌ No matching files found, please check the paths and permissions',
    );
    process.exit(1);
  }

  // 3. Create output directory
  if (!fs.existsSync(work_dir)) {
    fs.mkdirSync(work_dir, { recursive: true });
  }

  // 4. Generate native-files-sha256.txt
  const android_native_json = [];
  const hashes = [];

  files.forEach(file => {
    try {
      const hash = getFileSha256(file);
      const relpath = path.relative(root_dir, file);
      android_native_json.push({ relpath, hash });
      hashes.push(hash);
    } catch (err) {
      console.warn(`⚠️  Unable to read file: ${file}`, err.message);
    }
  });
  android_native_json.sort((a, b) => a.relpath.localeCompare(b.relpath));

  const result = {
    total_files: files.length,
    hashes: hashes,
    files: android_native_json,
  };
  fs.writeFileSync(
    WORK_FILES.android_native_files,
    JSON.stringify(result, null, 2),
  );

  console.log(`✅ Generated file list: ${WORK_FILES.android_native_files}`);
  console.log(
    `✅ Collected ${files.length} files, hashes saved to ${WORK_FILES.android_native_files}`,
  );

  // 5. Calculate .txt file's own SHA256 (as template ID)
  const txtHash = sha256(fs.readFileSync(WORK_FILES.android_native_files));

  console.log(`✅ Template ID: ${txtHash}`);

  // 6. Return fingerprint (for Bash retrieval)
  console.log(`TEMPLATE_HASH="${txtHash}"`);

  const d = new Date();
  const fingerprint = [
    d.getFullYear() /*  '-', */,
    (d.getMonth() + 1).toString().padStart(2, '0') /*  '-', */,
    `${txtHash.slice(0, 8)}_${txtHash.slice(-8)}`,
  ].join('-');
  fs.writeFileSync(WORK_FILES.fingerprint_txt, fingerprint);
  console.log(`✅ Saved fingerprint to: ${WORK_FILES.fingerprint_txt}`);
  console.log(`export TEMPLATE_FINGERPRINT="${fingerprint}"`);

  return {
    txtHash,
    fingerprint,
  };
}

// ==================== Execute ====================
const command = process.argv[2];

switch (command) {
  case 'calculate_hash':
    calculate_hash();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
