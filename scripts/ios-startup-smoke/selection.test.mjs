import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requiredMajors } from './run.mjs';
import { resolveSelection } from './selection.mjs';

const manualContext = {
  eventName: 'workflow_dispatch',
  ref: 'refs/heads/feat/ios-simulator-startup-ci',
};
const unchecked = Object.fromEntries(
  requiredMajors.map(major => [`ios_${major}`, false]),
);
const script = fileURLToPath(new URL('./selection.mjs', import.meta.url));

// Unit coverage for the selection policy; subprocess cases below exercise the
// real CLI, environment parsing and filesystem output (JS integration only).
test('manual selection defaults to iOS27 and a complete startup run', () => {
  assert.deepEqual(requiredMajors, [16, 17, 18, 26, 27]);
  for (const context of [manualContext, { ...manualContext, inputs: {} }])
    assert.deepEqual(resolveSelection(context), {
      requested_majors: '27',
      build_only: false,
    });
});

test('checkboxes select every subset in canonical order with exact boolean strings', () => {
  for (let mask = 1; mask < 1 << requiredMajors.length; mask++) {
    const inputs = Object.fromEntries(
      [...requiredMajors].reverse().map(major => {
        const selected = Boolean(mask & (1 << requiredMajors.indexOf(major)));
        return [`ios_${major}`, mask % 2 ? selected : String(selected)];
      }),
    );
    const expected = requiredMajors.filter((_, index) => mask & (1 << index));
    assert.deepEqual(resolveSelection({ ...manualContext, inputs }), {
      requested_majors: expected.join(','),
      build_only: false,
    });
  }
});

test('false strings are not truthy selections and build-only is parsed independently', () => {
  for (const buildOnly of [true, 'true', false, 'false'])
    assert.deepEqual(
      resolveSelection({
        ...manualContext,
        inputs: {
          ios_16: 'false',
          ios_17: true,
          ios_18: 'false',
          ios_26: false,
          ios_27: 'false',
          build_only: buildOnly,
        },
      }),
      {
        requested_majors: '17',
        build_only: buildOnly === true || buildOnly === 'true',
      },
    );
});

test('all unchecked fails even for a build-only request', () => {
  for (const buildOnly of [false, true, 'true'])
    assert.throws(
      () =>
        resolveSelection({
          ...manualContext,
          inputs: { ...unchecked, build_only: buildOnly },
        }),
      /Select at least one/,
    );
  assert.throws(
    () => resolveSelection({ ...manualContext, inputs: { ios_27: false } }),
    /Select at least one/,
  );
});

test('manual checkboxes and build-only reject malformed explicit values', () => {
  const malformed = [
    undefined,
    null,
    0,
    1,
    '',
    'TRUE',
    'False',
    ' false',
    'true\n',
    [],
    {},
  ];
  for (const key of [
    ...requiredMajors.map(major => `ios_${major}`),
    'build_only',
  ])
    for (const value of malformed)
      assert.throws(
        () => resolveSelection({ ...manualContext, inputs: { [key]: value } }),
        /must be booleans/,
      );
  for (const inputs of [null, [], 'true', false, 7, new Date(0)])
    assert.throws(
      () => resolveSelection({ ...manualContext, inputs }),
      /Expected Simulator selection inputs/,
    );
});

test('publish branch pushes and manual dispatch always run all versions, ignoring selection values', () => {
  for (const eventName of ['push', 'workflow_dispatch'])
    for (const inputs of [
      {},
      { ...unchecked, build_only: true },
      { ios_16: 'invalid', ios_27: null, build_only: 'invalid' },
      { ios_majors: '27', build_only: true },
      null,
    ])
      assert.deepEqual(
        resolveSelection({
          eventName,
          ref: 'refs/heads/publish/0.6.95',
          inputs,
        }),
        { requested_majors: requiredMajors.join(','), build_only: false },
      );
  assert.deepEqual(
    resolveSelection({
      eventName: 'push',
      ref: 'refs/heads/publish/next/candidate',
    }),
    { requested_majors: requiredMajors.join(','), build_only: false },
  );
});

test('old CSV input and unrelated workflow inputs do not replace the checkbox policy', () => {
  assert.deepEqual(
    resolveSelection({
      ...manualContext,
      inputs: {
        ios_majors: '16,17,18,26',
        build_xcode: '27.1',
        environment: 'mobile-local',
      },
    }),
    { requested_majors: '27', build_only: false },
  );
});

test('unsupported events, non-publish pushes and non-branch or malformed refs fail closed', () => {
  for (const eventName of [
    undefined,
    '',
    'pull_request',
    'workflow_call',
    'schedule',
  ])
    assert.throws(
      () => resolveSelection({ eventName, ref: 'refs/heads/publish/0.6.95' }),
      /Unsupported/,
    );
  for (const branch of [
    'develop',
    'publish',
    'publish-test/0.6.95',
    'feat/publish/0.6.95',
  ])
    assert.throws(
      () =>
        resolveSelection({ eventName: 'push', ref: `refs/heads/${branch}` }),
      /requires manual dispatch/,
    );
  for (const ref of [
    undefined,
    '',
    'publish/0.6.95',
    'refs/tags/publish/0.6.95',
    'refs/pull/2276/merge',
    'refs/heads/',
    'refs/heads/publish/',
    'refs/heads/publish//next',
    'refs/heads/publish/a..b',
    'refs/heads/publish/a@{b}',
    'refs/heads/publish/.hidden',
    'refs/heads/publish/a.lock',
    'refs/heads/publish/name.',
    'refs/heads/publish/a b',
    'refs/heads/publish/a\nb',
    'refs/heads/publish/a\n',
    'refs/heads/publish/a\\b',
    'refs/heads/publish/a?b',
  ])
    for (const eventName of ['push', 'workflow_dispatch'])
      assert.throws(() => resolveSelection({ eventName, ref }), /branch ref/);
});

function cli(output, overrides = {}, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: manualContext.eventName,
      GITHUB_REF: manualContext.ref,
      SIMULATOR_INPUTS: '{}',
      GITHUB_OUTPUT: output,
      ...overrides,
    },
  });
}

test('CLI writes canonical outputs for defaults, subsets and forced publish runs', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-simulator-selection-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const cases = [
    [{}, '27', false],
    [{ SIMULATOR_INPUTS: undefined }, '27', false],
    [
      {
        SIMULATOR_INPUTS: JSON.stringify({
          ios_16: true,
          ios_27: 'false',
          build_only: 'true',
        }),
      },
      '16',
      true,
    ],
    [
      {
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/publish/0.6.95',
        SIMULATOR_INPUTS: JSON.stringify({
          ...unchecked,
          build_only: 'invalid',
        }),
      },
      requiredMajors.join(','),
      false,
    ],
    [
      {
        GITHUB_REF: 'refs/heads/publish/0.6.95',
        SIMULATOR_INPUTS: JSON.stringify({ ios_16: null, build_only: true }),
      },
      requiredMajors.join(','),
      false,
    ],
  ];
  for (const [index, [overrides, majors, buildOnly]] of cases.entries()) {
    const output = path.join(directory, `${index}.txt`);
    const result = cli(output, overrides);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(
      result.stdout,
      `Selected iOS majors: ${majors}; build only: ${buildOnly}\n`,
    );
    assert.equal(
      await fs.readFile(output, 'utf8'),
      `requested_majors=${majors}\nbuild_only=${buildOnly}\n`,
    );
  }
});

test('CLI failures emit no selection outputs and never echo invalid context', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-simulator-selection-invalid-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const invalid = [
    { SIMULATOR_INPUTS: '{private-invalid-body' },
    { SIMULATOR_INPUTS: '' },
    { SIMULATOR_INPUTS: 'null' },
    { SIMULATOR_INPUTS: JSON.stringify(unchecked) },
    { SIMULATOR_INPUTS: JSON.stringify({ ios_27: 'private-invalid-value' }) },
    { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_REF: 'refs/tags/publish/private-invalid-ref' },
  ];
  for (const [index, overrides] of invalid.entries()) {
    const output = path.join(directory, `${index}.txt`);
    const result = cli(output, overrides);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Simulator selection failed\n');
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  }
  const existing = path.join(directory, 'existing.txt');
  await fs.writeFile(existing, 'unrelated=preserved\n');
  const result = cli(existing, {}, ['unexpected']);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(await fs.readFile(existing, 'utf8'), 'unrelated=preserved\n');
});

test('importing the selection module has no CLI or output-file side effects', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-simulator-selection-import-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'output.txt');
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(
        new URL('./selection.mjs', import.meta.url).href,
      )})`,
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_EVENT_NAME: 'unsupported',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  await assert.rejects(fs.stat(output), { code: 'ENOENT' });
});
