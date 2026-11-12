/**
 * Fails when a direct dependency is declared with a version range.
 *
 * dependencies, devDependencies and optionalDependencies must use an exact
 * version, so a reinstall or lockfile refresh never moves them silently.
 * peerDependencies are skipped because they describe what consumers may use.
 * Local workspaces keep `workspace:^`, which yarn constraints already enforce.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECKED_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
];
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const MANIFEST =
  /^(?:package\.json|(?:apps|packages|tpl)\/[^/]+\/package\.json)$/u;

/**
 * Returns whether a dependency specifier points to one fixed version.
 *
 * @param {string} spec - The value written in package.json.
 * @returns {boolean} True when the specifier cannot float.
 */
function isPinned(spec) {
  if (EXACT_VERSION.test(spec) || spec.startsWith('workspace:')) {
    return true;
  }
  // Alias, e.g. "npm:react-native-quick-base64@2.1.2".
  const alias = spec.match(/^npm:(?:@[^/@]+\/)?[^@]+@(.+)$/u);
  if (alias) {
    return EXACT_VERSION.test(alias[1]);
  }
  // Yarn patch, e.g. "patch:pkg@npm%3A1.2.3#./.yarn/patches/x.patch".
  const patch = spec.match(/^patch:.+?@npm%3A([^#]+)#/u);
  if (patch) {
    return EXACT_VERSION.test(decodeURIComponent(patch[1]));
  }
  return false;
}

const manifests = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(file => MANIFEST.test(file));

const problems = [];
for (const file of manifests) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  for (const field of CHECKED_FIELDS) {
    for (const [name, spec] of Object.entries(manifest[field] || {})) {
      if (!isPinned(spec)) {
        problems.push(`${file} ${field} ${name}: "${spec}"`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    `Direct dependencies must use exact versions (found ${problems.length}):`,
  );
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  console.error(
    'Pin each one to the version yarn.lock resolves, e.g. "1.2.3" instead of "^1.2.3".',
  );
  process.exitCode = 1;
}
