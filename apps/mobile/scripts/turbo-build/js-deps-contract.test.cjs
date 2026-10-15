'use strict';

// Host build-script unit/contract tests. Source the real shell function, but
// replace install/cache/workspace boundaries; no Yarn or native build is run.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const source = path.join(__dirname, '_fns.sh');
const app = path.resolve(__dirname, '../..');
const key = 'a'.repeat(64);
const layerArgs = `js-deps ${key} .turbo-build/yarn .yarn/install-state.gz .yarn/unplugged`;
const installEvent = 'yarn:install --immutable --mode=skip-build';
const coldEvents = [
  `restore:${layerArgs}`,
  installEvent,
  `save:${layerArgs}`,
  'workspace',
];

const harness = `
project_dir="$1"
. "$2" --source-only
turbo_init_env() { :; }
turbo_compute_js_deps_cache_key() {
  [ "$KEY_STATUS" = 0 ] || return "$KEY_STATUS"
  printf '%s\\n' "$TEST_KEY"
}
turbo_layer_remote_sync_enabled() { [ "$TEST_REMOTE_SYNC" = true ]; }
turbo_log() { :; }
turbo_restore_layer() {
  printf 'restore:%s\\n' "$*" >> "$EVENTS"
  return "$RESTORE_STATUS"
}
turbo_save_layer() { printf 'save:%s\\n' "$*" >> "$EVENTS"; }
turbo_prepare_workspace_build() {
  printf 'workspace\\n' >> "$EVENTS"
  return "$WORKSPACE_STATUS"
}
yarn() {
  [ "$PWD" = "$RABBY_MOBILE_REPO_ROOT" ] || return 98
  printf 'yarn:%s\\n' "$*" >> "$EVENTS"
  return "$YARN_STATUS"
}
turbo_prepare_js_dependencies
`;

function run(t, options = {}) {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'rabby-js-deps-contract-'),
  );
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'repo with spaces');
  const cache = path.join(temporary, 'cache');
  const yarnCache = path.join(root, '.turbo-build/yarn');
  const files = {
    installState: path.join(root, '.yarn/install-state.gz'),
    linkerState: path.join(root, 'node_modules/.yarn-state.yml'),
  };
  fs.mkdirSync(root);
  for (const [name, target] of Object.entries(files)) {
    if (options.missing === name) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, options.empty === name ? '' : 'fixture-state');
  }
  if (options.missing !== 'mirror') {
    fs.mkdirSync(
      path.join(cache, 'js-deps', options.oldKey ? 'b'.repeat(64) : key),
      { recursive: true },
    );
  }
  if (options.missing !== 'yarnCache')
    fs.mkdirSync(yarnCache, { recursive: true });
  const eventsFile = path.join(temporary, 'events');
  const result = spawnSync(
    '/bin/sh',
    ['-c', harness, 'js-deps-contract', app, source],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        PATH: '/usr/bin:/bin',
        RABBY_MOBILE_REPO_ROOT: root,
        RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT: cache,
        RABBY_MOBILE_TURBO_BUILD: options.turbo === false ? 'false' : 'true',
        RABBY_MOBILE_TURBO_CACHE_MODE: options.mode || 'local-first',
        YARN_CACHE_FOLDER: options.missing === 'yarnCacheEnv' ? '' : yarnCache,
        TEST_KEY: key,
        TEST_REMOTE_SYNC: options.remoteSync ? 'true' : 'false',
        EVENTS: eventsFile,
        KEY_STATUS: String(options.keyStatus || 0),
        YARN_STATUS: String(options.yarnStatus || 0),
        RESTORE_STATUS: String(options.restoreStatus || 0),
        WORKSPACE_STATUS: String(options.workspaceStatus || 0),
        CI: options.ci ? 'true' : '',
      },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.stderr, '');
  const events = fs.existsSync(eventsFile)
    ? fs.readFileSync(eventsFile, 'utf8').trimEnd().split('\n')
    : [];
  return { status: result.status, events };
}

test('warm local-first still validates with immutable Yarn without restore/save', t => {
  assert.deepEqual(run(t), { status: 0, events: [installEvent, 'workspace'] });
});

for (const missing of [
  'mirror',
  'installState',
  'linkerState',
  'yarnCache',
  'yarnCacheEnv',
]) {
  test(`missing ${missing} retains restore/install/save/workspace`, t => {
    assert.deepEqual(run(t, { missing }), { status: 0, events: coldEvents });
  });
}

for (const empty of ['installState', 'linkerState']) {
  test(`empty ${empty} is not a warm hint`, t => {
    assert.deepEqual(run(t, { empty }), { status: 0, events: coldEvents });
  });
}

test('a different cache key cannot qualify the warm path', t => {
  assert.deepEqual(run(t, { oldKey: true }), { status: 0, events: coldEvents });
});

for (const mode of ['remote-first', 'l2-first', 'remote', 'l2']) {
  test(`${mode} retains the existing path even without remote sync`, t => {
    assert.deepEqual(run(t, { mode }), { status: 0, events: coldEvents });
  });
}

test('local-first with remote sync retains cache restore/save', t => {
  assert.deepEqual(run(t, { remoteSync: true }), {
    status: 0,
    events: coldEvents,
  });
});

test('warm immutable install failure returns immediately without save/workspace', t => {
  assert.deepEqual(run(t, { yarnStatus: 23 }), {
    status: 23,
    events: [installEvent],
  });
});

test('cold immutable install failure returns immediately without save/workspace', t => {
  assert.deepEqual(run(t, { missing: 'mirror', yarnStatus: 23 }), {
    status: 23,
    events: [`restore:${layerArgs}`, installEvent],
  });
});

test('cache miss still proceeds to immutable install and populates the layer', t => {
  assert.deepEqual(run(t, { missing: 'mirror', restoreStatus: 1 }), {
    status: 0,
    events: coldEvents,
  });
});

test('key failure stops before install or cache/workspace operations', t => {
  assert.deepEqual(run(t, { keyStatus: 27 }), { status: 27, events: [] });
});

for (const missing of [undefined, 'mirror']) {
  test(`workspace failure propagates on ${
    missing ? 'cold' : 'warm'
  } path`, t => {
    assert.deepEqual(run(t, { missing, workspaceStatus: 29 }), {
      status: 29,
      events: missing ? coldEvents : [installEvent, 'workspace'],
    });
  });
}

test('non-Turbo CI keeps workspace preparation without extra Yarn', t => {
  assert.deepEqual(run(t, { turbo: false, ci: true }), {
    status: 0,
    events: ['workspace'],
  });
});

test('non-Turbo local keeps the original bare Yarn invocation', t => {
  assert.deepEqual(run(t, { turbo: false }), { status: 0, events: ['yarn:'] });
});
