'use strict';

// Host build-script unit/contract tests: real shell function, stubbed Bundler
// and cache I/O. These do not run gem installation, CocoaPods, or native builds.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const source = path.join(__dirname, '_fns.sh');
const app = path.resolve(__dirname, '../..');
const key = 'a'.repeat(64);
const layerArgs = `ruby-gems ${key} apps/mobile/.turbo-build/vendor/bundle apps/mobile/.turbo-build/bundle-config`;
const restore = `restore:${layerArgs}`;
const save = `save:${layerArgs}`;
const check = 'bundle:check';
const install = 'bundle:install --path <bundle-path>';

const harness = `
project_dir="$1"
. "$2" --source-only
turbo_init_env() { :; }
turbo_compute_ruby_bundle_cache_key() {
  [ "$KEY_STATUS" = 0 ] || return "$KEY_STATUS"
  printf '%s\\n' "$TEST_KEY"
}
turbo_layer_remote_sync_enabled() { [ "$TEST_REMOTE_SYNC" = true ]; }
turbo_log() { :; }
turbo_restore_layer() {
  printf 'restore:%s\\n' "$*" >> "$EVENTS"
  return "$RESTORE_STATUS"
}
turbo_save_layer() {
  printf 'save:%s\\n' "$*" >> "$EVENTS"
  return "$SAVE_STATUS"
}
bundle_checks=0
turbo_bundle_exec() {
  case "$1" in
    check)
      [ "$#" = 1 ] || return 98
      printf 'bundle:check\\n' >> "$EVENTS"
      bundle_checks=$((bundle_checks + 1))
      eval "check_status=\\\${CHECK_$bundle_checks:-97}"
      return "$check_status"
      ;;
    install)
      [ "$#" = 3 ] && [ "$2" = --path ] &&
        [ "$3" = "$RABBY_MOBILE_TURBO_BUNDLE_PATH" ] || return 98
      printf 'bundle:install --path <bundle-path>\\n' >> "$EVENTS"
      return "$INSTALL_STATUS"
      ;;
    *) return 98 ;;
  esac
}
turbo_prepare_ruby_bundle
`;

function run(t, options = {}) {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'rabby-ruby-bundle-contract-'),
  );
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const cache = path.join(temporary, 'cache with spaces');
  if (options.mirror !== false) {
    fs.mkdirSync(
      path.join(cache, 'ruby-gems', options.oldKey ? 'b'.repeat(64) : key),
      { recursive: true },
    );
  }
  const eventsFile = path.join(temporary, 'events');
  const checks = options.checks || [0];
  const result = spawnSync(
    '/bin/sh',
    ['-c', harness, 'ruby-bundle-contract', app, source],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        PATH: '/usr/bin:/bin',
        RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT: cache,
        RABBY_MOBILE_TURBO_BUNDLE_PATH: path.join(
          temporary,
          'bundle with spaces',
        ),
        RABBY_MOBILE_TURBO_BUILD: options.turbo === false ? 'false' : 'true',
        RABBY_MOBILE_TURBO_CACHE_MODE: options.mode || 'local-first',
        TEST_KEY: key,
        TEST_REMOTE_SYNC: options.remoteSync ? 'true' : 'false',
        EVENTS: eventsFile,
        KEY_STATUS: String(options.keyStatus || 0),
        INSTALL_STATUS: String(options.installStatus || 0),
        RESTORE_STATUS: String(options.restoreStatus || 0),
        SAVE_STATUS: String(options.saveStatus || 0),
        ...Object.fromEntries(
          checks.map((status, index) => [`CHECK_${index + 1}`, String(status)]),
        ),
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

test('local-first ready bundle with current mirror only runs check', t => {
  assert.deepEqual(run(t), { status: 0, events: [check] });
});

test('local-first ready bundle without a mirror saves once, with no restore/install', t => {
  assert.deepEqual(run(t, { mirror: false }), {
    status: 0,
    events: [check, save],
  });
});

test('an old key mirror does not suppress saving the current key', t => {
  assert.deepEqual(run(t, { oldKey: true }), {
    status: 0,
    events: [check, save],
  });
});

test('not-ready local bundle restores, then checks before deciding to install', t => {
  assert.deepEqual(run(t, { checks: [1, 0] }), {
    status: 0,
    events: [check, restore, check, save],
  });
});

test('restore miss continues to install, verify, and save', t => {
  assert.deepEqual(run(t, { checks: [1, 1, 0], restoreStatus: 1 }), {
    status: 0,
    events: [check, restore, check, install, check, save],
  });
});

test('local install failure propagates immediately without verification or save', t => {
  assert.deepEqual(run(t, { checks: [1, 1], installStatus: 23 }), {
    status: 23,
    events: [check, restore, check, install],
  });
});

test('local post-install check failure propagates without save', t => {
  assert.deepEqual(run(t, { checks: [1, 1, 24] }), {
    status: 24,
    events: [check, restore, check, install, check],
  });
});

for (const mode of ['remote-first', 'l2-first', 'remote', 'l2']) {
  test(`${mode} restores before checking even when local bundle is ready`, t => {
    assert.deepEqual(run(t, { mode }), {
      status: 0,
      events: [restore, check, save],
    });
  });
}

test('local-first with remote sync retains restore/check/save ordering', t => {
  assert.deepEqual(run(t, { remoteSync: true }), {
    status: 0,
    events: [restore, check, save],
  });
});

for (const options of [{ mode: 'remote-first' }, { remoteSync: true }]) {
  const name = options.mode || 'remote-sync';
  test(`${name} install failure propagates without save`, t => {
    assert.deepEqual(run(t, { ...options, checks: [1], installStatus: 23 }), {
      status: 23,
      events: [restore, check, install],
    });
  });
  test(`${name} post-install check failure propagates without save`, t => {
    assert.deepEqual(run(t, { ...options, checks: [1, 24] }), {
      status: 24,
      events: [restore, check, install, check],
    });
  });
}

test('missing mirror save failure propagates', t => {
  assert.deepEqual(run(t, { mirror: false, saveStatus: 25 }), {
    status: 25,
    events: [check, save],
  });
});

test('cold save failure propagates', t => {
  assert.deepEqual(run(t, { checks: [1, 0], saveStatus: 25 }), {
    status: 25,
    events: [check, restore, check, save],
  });
});

test('key failure stops before Bundler or cache operations', t => {
  assert.deepEqual(run(t, { keyStatus: 27 }), { status: 27, events: [] });
});

test('non-Turbo ready bundle checks without cache operations', t => {
  assert.deepEqual(run(t, { turbo: false }), { status: 0, events: [check] });
});

test('non-Turbo installation is checked, without cache operations', t => {
  assert.deepEqual(run(t, { turbo: false, checks: [1, 0] }), {
    status: 0,
    events: [check, install, check],
  });
});

test('non-Turbo install failure propagates immediately', t => {
  assert.deepEqual(run(t, { turbo: false, checks: [1], installStatus: 23 }), {
    status: 23,
    events: [check, install],
  });
});

test('non-Turbo post-install check failure propagates', t => {
  assert.deepEqual(run(t, { turbo: false, checks: [1, 24] }), {
    status: 24,
    events: [check, install, check],
  });
});
