#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const semver = require('semver');

const MOBILE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MOBILE_DIR, '../..');
const PACKAGE_JSON_PATH = path.join(MOBILE_DIR, 'package.json');
const CHANGELOG_DIR = path.join(MOBILE_DIR, 'src/changeLogs');

const CLASSIC_CHANGELOG_TEMPLATE = `### Features

- Fixed some bugs and optimized user experience
`;

function printHelp() {
  console.log(`Usage: yarn prepublish:release [--version=X.Y.Z] [--dry-run]

Options:
  --version=X.Y.Z  Publish the given semver version.
                   If omitted, increment the current patch version.
  --dry-run        Run the flow without commit/push/PR creation.
  --help           Show this help message.
`);
}

function parseArgs(argv) {
  const options = {
    version: '',
    dryRun: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg.startsWith('--version=')) {
      options.version = arg.slice('--version='.length).trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    stdio: options.stdio || 'inherit',
    encoding: 'utf8',
    env: options.env || process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const rendered = [command].concat(args).join(' ');
    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }

  return result;
}

function capture(command, args, options = {}) {
  return run(command, args, {
    ...options,
    stdio: 'pipe',
  }).stdout.trim();
}

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  return result.status === 0;
}

function ensureCleanWorktree() {
  const output = capture('git', ['status', '--porcelain']);
  if (output) {
    throw new Error(
      'Working tree must be clean before running prepublish release.',
    );
  }
}

function readPackageJsonAtRef(ref) {
  const raw = capture('git', ['show', `${ref}:apps/mobile/package.json`]);
  return JSON.parse(raw);
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

function writePackageJson(nextPkg) {
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    `${JSON.stringify(nextPkg, null, 2)}\n`,
    'utf8',
  );
}

function resolveTargetVersion(currentVersion, requestedVersion) {
  if (requestedVersion) {
    const valid = semver.valid(requestedVersion);
    if (!valid) {
      throw new Error(`Invalid --version value: ${requestedVersion}`);
    }
    return valid;
  }

  const nextVersion = semver.inc(currentVersion, 'patch');
  if (!nextVersion) {
    throw new Error(`Failed to increment patch version from ${currentVersion}`);
  }

  return nextVersion;
}

function localBranchExists(branchName) {
  const result = spawnSync(
    'git',
    ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`],
    {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    },
  );

  return result.status === 0;
}

function remoteBranchExists(branchName) {
  const result = spawnSync(
    'git',
    ['ls-remote', '--exit-code', '--heads', 'origin', branchName],
    {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    },
  );

  return result.status === 0;
}

function ensurePublishBranch(version) {
  const currentBranch = capture('git', ['branch', '--show-current']);
  const publishBranch = `publish/${version}`;

  if (!currentBranch) {
    throw new Error('Expected to run from a local branch, not detached HEAD.');
  }

  console.log('[prepublish-release] fetching origin/develop');
  run('git', ['fetch', 'origin', 'develop'], { cwd: REPO_ROOT });

  if (currentBranch === publishBranch) {
    return publishBranch;
  }

  if (currentBranch !== 'develop') {
    console.log(
      `[prepublish-release] switching from ${currentBranch} to ${publishBranch}`,
    );
  }

  if (localBranchExists(publishBranch)) {
    console.log(
      `[prepublish-release] switching to existing local branch ${publishBranch}`,
    );
    run('git', ['switch', publishBranch], { cwd: REPO_ROOT });
    return publishBranch;
  }

  if (remoteBranchExists(publishBranch)) {
    console.log(
      `[prepublish-release] tracking existing remote branch origin/${publishBranch}`,
    );
    run(
      'git',
      ['switch', '-c', publishBranch, '--track', `origin/${publishBranch}`],
      { cwd: REPO_ROOT },
    );
    return publishBranch;
  }

  console.log(
    `[prepublish-release] creating ${publishBranch} from origin/develop`,
  );
  run('git', ['switch', '-c', publishBranch, 'origin/develop'], {
    cwd: REPO_ROOT,
  });
  return publishBranch;
}

function ensureChangelog(version) {
  const candidates = [
    path.join(CHANGELOG_DIR, `${version}.md`),
    path.join(CHANGELOG_DIR, `${version}.ios.md`),
    path.join(CHANGELOG_DIR, `${version}.android.md`),
  ];

  const existing = candidates.find(file => fs.existsSync(file));
  if (existing) {
    console.log(
      `[prepublish-release] changelog exists: ${path.relative(
        REPO_ROOT,
        existing,
      )}`,
    );
    return existing;
  }

  const genericChangelogPath = path.join(CHANGELOG_DIR, `${version}.md`);
  fs.writeFileSync(genericChangelogPath, CLASSIC_CHANGELOG_TEMPLATE, 'utf8');
  console.log(
    `[prepublish-release] created changelog: ${path.relative(
      REPO_ROOT,
      genericChangelogPath,
    )}`,
  );
  return genericChangelogPath;
}

function stagePublishFiles() {
  run(
    'git',
    [
      'add',
      '--all',
      'apps/mobile/package.json',
      'apps/mobile/android',
      'apps/mobile/ios',
      'apps/mobile/src/changeLogs',
    ],
    { cwd: REPO_ROOT },
  );
}

function ensureStagedChanges() {
  const staged = capture('git', ['diff', '--cached', '--name-only']);
  if (!staged) {
    throw new Error('No staged changes found for publish commit.');
  }
}

function findOpenPr(branchName) {
  const result = spawnSync(
    'gh',
    [
      'pr',
      'list',
      '--head',
      branchName,
      '--base',
      'develop',
      '--state',
      'open',
      '--json',
      'number,url,title',
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to list open PRs with gh.');
  }

  const prs = JSON.parse(result.stdout || '[]');
  return prs[0] || null;
}

function maybeCreatePr({ branchName, version, commitMessage, dryRun }) {
  if (dryRun) {
    console.log('[prepublish-release] dry-run: skip push and PR creation');
    return null;
  }

  if (!commandExists('gh')) {
    console.log('[prepublish-release] gh not found: skip PR creation');
    return null;
  }

  console.log(`[prepublish-release] pushing ${branchName}`);
  run('git', ['push', '-u', 'origin', branchName], { cwd: REPO_ROOT });

  const prBody = [
    '## Summary',
    `- publish Rabby Mobile ${version}`,
    '- sync native version metadata with yarn rnversion',
    '- ensure a default changelog file exists for this release',
    '',
    '## Verification',
    '- version bump applied',
    '- changelog present',
    '- publish commit created',
  ].join('\n');

  const existingPr = findOpenPr(branchName);
  if (existingPr) {
    console.log(
      `[prepublish-release] updating existing PR #${existingPr.number}: ${existingPr.url}`,
    );
    run(
      'gh',
      [
        'pr',
        'edit',
        String(existingPr.number),
        '--title',
        commitMessage,
        '--body',
        prBody,
      ],
      { cwd: REPO_ROOT },
    );
    return existingPr.url;
  }

  console.log('[prepublish-release] creating PR with gh');
  return capture(
    'gh',
    [
      'pr',
      'create',
      '--base',
      'develop',
      '--head',
      branchName,
      '--title',
      commitMessage,
      '--body',
      prBody,
    ],
    { cwd: REPO_ROOT },
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  ensureCleanWorktree();

  const developPkg = readPackageJsonAtRef('origin/develop');
  const baseVersion = developPkg.version;
  const targetVersion = resolveTargetVersion(baseVersion, options.version);
  const branchName = ensurePublishBranch(targetVersion);
  const pkg = readPackageJson();
  const currentVersion = pkg.version;

  if (pkg.version !== targetVersion) {
    pkg.version = targetVersion;
    writePackageJson(pkg);
    console.log(
      `[prepublish-release] package.json version: ${currentVersion} -> ${targetVersion} (base develop version: ${baseVersion})`,
    );
  } else {
    console.log(
      `[prepublish-release] package.json already at target version ${targetVersion}`,
    );
  }

  console.log('[prepublish-release] running yarn rnversion');
  run('yarn', ['rnversion'], { cwd: MOBILE_DIR });

  ensureChangelog(targetVersion);
  stagePublishFiles();
  ensureStagedChanges();

  const commitMessage = `build: publish ${targetVersion}`;

  if (options.dryRun) {
    console.log(`[prepublish-release] dry-run: skip commit "${commitMessage}"`);
    console.log(`version=${targetVersion}`);
    console.log(`[prepublish-release] branch: ${branchName}`);
    return;
  }

  console.log(`[prepublish-release] committing: ${commitMessage}`);
  run('git', ['commit', '-m', commitMessage], { cwd: REPO_ROOT });
  const commitSha = capture('git', ['rev-parse', 'HEAD']);

  const prUrl = maybeCreatePr({
    branchName,
    version: targetVersion,
    commitMessage,
    dryRun: options.dryRun,
  });

  console.log('[prepublish-release] done');
  console.log(`version=${targetVersion}`);
  console.log(`branch=${branchName}`);
  console.log(`commit=${commitSha}`);
  if (prUrl) {
    console.log(`pr=${prUrl}`);
  }
}

try {
  main();
} catch (error) {
  console.error(
    `[prepublish-release] ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
