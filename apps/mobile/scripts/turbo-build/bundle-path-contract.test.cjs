'use strict';

// Host build-script/Bundler configuration contracts, not native-build tests.
// Run with the project's Ruby/Bundler on PATH, or set
// RABBY_MOBILE_TEST_RUBY and RABBY_MOBILE_TEST_BUNDLER_LIB explicitly.
// Only disposable configs are written; no bundle install/check/exec is run.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const source = path.join(__dirname, '_fns.sh');
const app = path.resolve(__dirname, '../..');
const ruby = process.env.RABBY_MOBILE_TEST_RUBY || 'ruby';
const bundlerLib = process.env.RABBY_MOBILE_TEST_BUNDLER_LIB || '';

const inspectSettings = `
require 'bundler'
require 'json'
abort 'Expected project Bundler 2.4.22' unless Bundler::VERSION == '2.4.22'
puts JSON.generate(
  path: Bundler.settings.path.explicit_path,
  without: Bundler.settings[:without],
  ffi: Bundler.settings['build.ffi']
)
`;

const harness = `
project_dir="$1"
. "$2" --source-only
# No .ruby-version in this disposable project: exercise the real non-RVM
# command boundary without sourcing or changing the machine's RVM state.
project_dir="$TEST_PROJECT"
bundle() {
  printf '%s\\n' "$*" >> "$EVENTS"
  if [ "$1" = config ] && [ "$2" = set ] && [ "$BIND_STATUS" != 0 ]; then
    return "$BIND_STATUS"
  fi
  if [ "$1" = config ] && [ "$2" = get ] && [ "$COMMAND_STATUS" != 0 ]; then
    return "$COMMAND_STATUS"
  fi
  set -- -rbundler -rbundler/cli -e 'Bundler::CLI.start(ARGV)' -- "$@"
  if [ -n "$TEST_BUNDLER_LIB" ]; then
    set -- -I "$TEST_BUNDLER_LIB" "$@"
  fi
  "$TEST_RUBY" "$@"
}
# The production helper invokes bundle through env. Replace just that process
# boundary so its actual environment assignments reach the real Bundler CLI.
env() (
  while [ "$#" -gt 0 ]; do
    case "$1" in
      BUNDLE_*=*) export "$1"; shift ;;
      *) break ;;
    esac
  done
  "$@"
)
turbo_bundle_exec config get path
`;

const rvmHarness = harness.replace(
  'turbo_bundle_exec config get path',
  String.raw`
rvm() {
  printf 'rvm:%s\n' "$*" >> "$EVENTS"
  return "$RVM_STATUS"
}
export -f bundle env rvm
bash() {
  [ "$1" = -lc ] || return 98
  printf 'rvm-launch\n' >> "$EVENTS"
  # Replace only sourcing the host RVM script. Execute the actual production
  # shell body, including Ruby selection, environment, and both bundle calls.
  payload=$(printf '%s\n' "$2" | awk '
    $0 == "    . \"$HOME/.rvm/scripts/rvm\"" { print ":"; replaced++; next }
    { print }
    END { if (replaced != 1) exit 98 }
  ') || return $?
  shift 2
  /bin/bash -c "$payload" "$@"
}
turbo_bundle_with_project_ruby "$TEST_PROJECT" config get path
`,
);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-bundle-path-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project with spaces');
  const config = path.join(project, 'bundle-config');
  fs.mkdirSync(config, { recursive: true });
  fs.writeFileSync(path.join(project, 'Gemfile'), '');
  const oldPath = path.join(root, 'old worktree', 'vendor', 'bundle');
  const currentPath = path.join(project, 'vendor', 'bundle');
  fs.writeFileSync(
    path.join(config, 'config'),
    [
      '---',
      `BUNDLE_PATH: ${JSON.stringify(oldPath)}`,
      'BUNDLE_WITHOUT: "development:test"',
      'BUNDLE_BUILD__FFI: "--enable-libffi-alloc"',
      '',
    ].join('\n'),
  );
  const events = path.join(root, 'events');
  return {
    project,
    config,
    oldPath,
    currentPath,
    events,
    env: {
      PATH: process.env.PATH,
      BUNDLE_USER_HOME: path.join(root, 'user-bundle'),
      BUNDLE_GEMFILE: path.join(project, 'Gemfile'),
      BUNDLE_APP_CONFIG: config,
      BUNDLE_PATH: currentPath,
      RABBY_MOBILE_TURBO_BUILD: 'true',
      RABBY_MOBILE_TURBO_BUNDLE_APP_CONFIG: config,
      RABBY_MOBILE_TURBO_BUNDLE_PATH: currentPath,
      RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM: '1',
      TEST_PROJECT: project,
      TEST_RUBY: ruby,
      TEST_BUNDLER_LIB: bundlerLib,
      EVENTS: events,
      BIND_STATUS: '0',
      COMMAND_STATUS: '0',
      RVM_STATUS: '0',
    },
  };
}

function spawn(program, args, env) {
  const result = spawnSync(program, args, {
    env,
    encoding: 'utf8',
    timeout: 20_000,
  });
  assert.ifError(result.error);
  return result;
}

function settings(f) {
  const result = spawn(
    ruby,
    [...(bundlerLib ? ['-I', bundlerLib] : []), '-e', inspectSettings],
    f.env,
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function run(f, overrides = {}, useRvm = false) {
  if (useRvm) {
    fs.writeFileSync(path.join(f.project, '.ruby-version'), '2.7.4\n');
    fs.writeFileSync(path.join(f.project, '.ruby-gemset'), 'rabbymobile\n');
  }
  const result = spawn(
    useRvm ? '/bin/bash' : '/bin/sh',
    ['-c', useRvm ? rvmHarness : harness, 'bundle-path-contract', app, source],
    {
      ...f.env,
      ...overrides,
    },
  );
  const events = fs.existsSync(f.events)
    ? fs.readFileSync(f.events, 'utf8').trimEnd().split('\n')
    : [];
  return { status: result.status, stderr: result.stderr, events };
}

test('real Bundler local BUNDLE_PATH overrides the intended environment path', t => {
  const f = fixture(t);
  assert.equal(settings(f).path, f.oldPath);
});

test('Turbo rebinds restored path, preserving unrelated Bundler settings', t => {
  const f = fixture(t);
  const before = settings(f);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [
    `config set --local path ${f.currentPath}`,
    'config get path',
  ]);
  assert.deepEqual(settings(f), { ...before, path: f.currentPath });
});

test('each command rebinds after an old mirror config is restored again', t => {
  const f = fixture(t);
  const original = fs.readFileSync(path.join(f.config, 'config'));
  assert.equal(run(f).status, 0);
  fs.writeFileSync(path.join(f.config, 'config'), original);
  assert.equal(settings(f).path, f.oldPath);
  assert.equal(run(f).status, 0);
  assert.equal(settings(f).path, f.currentPath);
});

test('non-Turbo keeps original config and command behavior', t => {
  const f = fixture(t);
  const before = fs.readFileSync(path.join(f.config, 'config'));
  const result = run(f, { RABBY_MOBILE_TURBO_BUILD: 'false' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, ['config get path']);
  assert.deepEqual(fs.readFileSync(path.join(f.config, 'config')), before);
  assert.equal(settings(f).path, f.oldPath);
});

test('binding failure stops before the original command and preserves config', t => {
  const f = fixture(t);
  const before = fs.readFileSync(path.join(f.config, 'config'));
  const result = run(f, { BIND_STATUS: '37' });
  assert.equal(result.status, 37);
  assert.deepEqual(result.events, [`config set --local path ${f.currentPath}`]);
  assert.deepEqual(fs.readFileSync(path.join(f.config, 'config')), before);
});

test('original command failure still propagates after successful binding', t => {
  const f = fixture(t);
  const result = run(f, { COMMAND_STATUS: '39' });
  assert.equal(result.status, 39);
  assert.equal(settings(f).path, f.currentPath);
});

test('RVM path binding and original command use one selected Ruby shell', t => {
  const f = fixture(t);
  const result = run(f, {}, true);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [
    'rvm-launch',
    'rvm:use 2.7.4@rabbymobile',
    `config set --local path ${f.currentPath}`,
    'config get path',
  ]);
  assert.equal(settings(f).path, f.currentPath);
});

test('RVM non-Turbo keeps one shell and does not rebind settings', t => {
  const f = fixture(t);
  const result = run(f, { RABBY_MOBILE_TURBO_BUILD: 'false' }, true);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [
    'rvm-launch',
    'rvm:use 2.7.4@rabbymobile',
    'config get path',
  ]);
  assert.equal(settings(f).path, f.oldPath);
});

test('RVM selection failure stops before binding and original command', t => {
  const f = fixture(t);
  const result = run(f, { RVM_STATUS: '41' }, true);
  assert.equal(result.status, 41);
  assert.deepEqual(result.events, ['rvm-launch', 'rvm:use 2.7.4@rabbymobile']);
  assert.equal(settings(f).path, f.oldPath);
});

test('RVM binding failure stops before the original command', t => {
  const f = fixture(t);
  const result = run(f, { BIND_STATUS: '37' }, true);
  assert.equal(result.status, 37);
  assert.deepEqual(result.events, [
    'rvm-launch',
    'rvm:use 2.7.4@rabbymobile',
    `config set --local path ${f.currentPath}`,
  ]);
  assert.equal(settings(f).path, f.oldPath);
});

test('RVM original command failure propagates after binding', t => {
  const f = fixture(t);
  const result = run(f, { COMMAND_STATUS: '39' }, true);
  assert.equal(result.status, 39);
  assert.equal(settings(f).path, f.currentPath);
});
