import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mergeWorkflowInputs,
  redactArgs,
  resolveDispatchRef,
} from './one-shot.mjs';

test('redacts a --token value from command error text', () => {
  assert.deepEqual(
    redactArgs([
      'publish.mjs',
      '--platform',
      'android',
      '--token',
      'super-secret',
    ]),
    ['publish.mjs', '--platform', 'android', '--token', '<redacted>'],
  );
});

test('redacts proxy userinfo but keeps the host', () => {
  assert.deepEqual(
    redactArgs(['publish.mjs', '--proxy', 'http://user:pass@127.0.0.1:7890']),
    ['publish.mjs', '--proxy', 'http://<redacted>@127.0.0.1:7890'],
  );
});

test('leaves ordinary arguments untouched', () => {
  assert.deepEqual(redactArgs(['gh', 'workflow', 'run']), [
    'gh',
    'workflow',
    'run',
  ]);
});

test('an explicit --workflow-ref wins over the prepared ref', () => {
  assert.equal(resolveDispatchRef('tmp/20261112', 'develop'), 'tmp/20261112');
  assert.equal(resolveDispatchRef('', 'tmp/20261112'), 'tmp/20261112');
  assert.equal(resolveDispatchRef('', ''), 'develop');
});

test('extra --workflow-input values override prepared inputs', () => {
  assert.deepEqual(
    mergeWorkflowInputs({ platform: 'android', artifact_sha256: 'abc' }, [
      'android_machine_location=mobile-local',
      'platform=ios',
    ]),
    {
      platform: 'ios',
      artifact_sha256: 'abc',
      android_machine_location: 'mobile-local',
    },
  );
});
