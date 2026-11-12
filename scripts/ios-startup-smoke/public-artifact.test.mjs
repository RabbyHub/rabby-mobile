import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertPublicArtifactProfile,
  verifyPublicArtifact,
} from './public-artifact.mjs';

// Pure policy unit tests plus JS integration with the real receipt/hash verifier
// and CLI. Small transport fixtures are never extracted or executed as an app.
const commit = 'a'.repeat(40);
const producer = {
  repository: 'RabbyHub/rabby-mobile',
  runId: '123',
  runAttempt: '1',
};
const cli = fileURLToPath(new URL('./public-artifact.mjs', import.meta.url));

async function fixture(t, modify = () => {}) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-public-artifact-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const archive = Buffer.from('simulator archive transport fixture');
  const metadata = {
    schemaVersion: 2,
    buildInputProfile: 'simulator-smoke-v1',
    sourceCommit: commit,
    platform: 'iphonesimulator',
    configuration: 'Regression',
    architectures: ['arm64'],
    executableSha256: 'b'.repeat(64),
    jsBundleSha256: 'c'.repeat(64),
    archive: {
      file: 'RabbyMobile-simulator.zip',
      bytes: archive.length,
      sha256: createHash('sha256').update(archive).digest('hex'),
    },
    sourceProvenance: {
      status: 'clean',
      headCommit: commit,
      changedFiles: [],
    },
    producer: { ...producer },
  };
  modify(metadata);
  const metadataPath = path.join(directory, 'metadata.json');
  const archivePath = path.join(directory, 'RabbyMobile-simulator.zip');
  await fs.writeFile(metadataPath, JSON.stringify(metadata));
  await fs.writeFile(archivePath, archive);
  return { directory, metadata, metadataPath, archivePath };
}

function runCLI(directory, output, { args, env } = {}) {
  return spawnSync(process.execPath, [cli, ...(args || [directory, commit])], {
    encoding: 'utf8',
    timeout: 10000,
    env: {
      GITHUB_REPOSITORY: producer.repository,
      GITHUB_RUN_ID: producer.runId,
      GITHUB_RUN_ATTEMPT: producer.runAttempt,
      GITHUB_OUTPUT: output,
      ...env,
    },
  });
}

test('public profile accepts only its exact version and never mutates legacy metadata', () => {
  const valid = Object.freeze({ buildInputProfile: 'simulator-smoke-v1' });
  assert.equal(assertPublicArtifactProfile(valid), valid);
  for (const value of [
    null,
    undefined,
    Object.freeze({}),
    ...[
      null,
      true,
      'regression',
      'simulator-smoke-v0',
      'simulator-smoke-v2',
      'simulator-smoke-v1\n',
      ['simulator-smoke-v1'],
    ].map(buildInputProfile => Object.freeze({ buildInputProfile })),
  ]) {
    assert.throws(() => assertPublicArtifactProfile(value), {
      message: 'Artifact is not eligible for public Simulator distribution',
    });
  }
});

test('public archive verification retains the real hash, source and producer checks', async t => {
  const input = await fixture(t);
  const before = await fs.readFile(input.metadataPath);
  assert.deepEqual(
    await verifyPublicArtifact(input.directory, commit, { producer }),
    input.metadata,
  );
  assert.deepEqual(await fs.readFile(input.metadataPath), before);
  await assert.rejects(
    verifyPublicArtifact(input.directory, 'd'.repeat(40), { producer }),
    /receipt/,
  );
  for (const key of ['repository', 'runId', 'runAttempt']) {
    await assert.rejects(
      verifyPublicArtifact(input.directory, commit, {
        producer: { ...producer, [key]: 'different' },
      }),
      /producer/,
    );
  }
  // Same byte count, different bytes: retain the cryptographic check, not size only.
  const bytes = await fs.readFile(input.archivePath);
  bytes[0] ^= 1;
  await fs.writeFile(input.archivePath, bytes);
  await assert.rejects(
    verifyPublicArtifact(input.directory, commit, { producer }),
    /receipt/,
  );
});

test('modified public-input app remains diagnostic; publication does not upgrade its provenance', async t => {
  const input = await fixture(t, metadata => {
    metadata.sourceProvenance.status = 'modified';
    metadata.sourceProvenance.changedFiles = ['generated.css'];
  });
  const verified = await verifyPublicArtifact(input.directory, commit, {
    producer,
    probe: false,
  });
  assert.equal(verified.sourceProvenance.status, 'modified');
  assert.deepEqual(verified.sourceProvenance.changedFiles, ['generated.css']);
  assert.equal(verified.qualificationPassed, undefined);
});

test('missing, legacy and unknown profile archives are rejected without adding a marker', async t => {
  for (const profile of [
    undefined,
    'legacy-regression',
    'simulator-smoke-v2',
  ]) {
    const input = await fixture(t, metadata => {
      if (profile === undefined) delete metadata.buildInputProfile;
      else metadata.buildInputProfile = profile;
    });
    const before = await fs.readFile(input.metadataPath);
    await assert.rejects(
      verifyPublicArtifact(input.directory, commit, { producer }),
      /not eligible for public/,
    );
    assert.deepEqual(await fs.readFile(input.metadataPath), before);
  }
});

test('public marker does not bypass structural or source-provenance receipt validation', async t => {
  for (const modify of [
    metadata => (metadata.platform = 'iphoneos'),
    metadata => (metadata.sourceCommit = 'd'.repeat(40)),
    metadata => (metadata.sourceProvenance.headCommit = 'd'.repeat(40)),
    metadata => (metadata.schemaVersion = 1),
    metadata => (metadata.archive.bytes += 1),
  ]) {
    const input = await fixture(t, modify);
    await assert.rejects(
      verifyPublicArtifact(input.directory, commit, { producer }),
      /receipt|provenance/,
    );
  }
});

test('CLI emits allowed=true only after complete public profile verification', async t => {
  const input = await fixture(t);
  const output = path.join(input.directory, 'outputs');
  const result = runCLI(input.directory, output);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Public Simulator artifact profile verified\n');
  assert.equal(await fs.readFile(output, 'utf8'), 'allowed=true\n');
});

test('CLI never grants public upload for a legacy package, hash drift or wrong producer/source', async t => {
  for (const kind of ['legacy', 'hash', 'producer', 'source']) {
    const input = await fixture(t, metadata => {
      if (kind === 'legacy') delete metadata.buildInputProfile;
      if (kind === 'producer') metadata.producer.runId = '456';
      if (kind === 'source') metadata.sourceCommit = 'd'.repeat(40);
    });
    if (kind === 'hash') await fs.appendFile(input.archivePath, 'tamper');
    const output = path.join(input.directory, 'outputs');
    const result = runCLI(input.directory, output);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(
      result.stderr,
      'Public Simulator artifact verification failed\n',
    );
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  }
});

test('CLI requires the full exact producer context and valid arguments before allowing publication', async t => {
  const input = await fixture(t);
  const output = path.join(input.directory, 'outputs');
  const cases = [
    { env: { GITHUB_REPOSITORY: '' } },
    { env: { GITHUB_REPOSITORY: 'fork/rabby-mobile' } },
    { env: { GITHUB_RUN_ID: '' } },
    { env: { GITHUB_RUN_ID: '123\n' } },
    { env: { GITHUB_RUN_ATTEMPT: '' } },
    { env: { GITHUB_RUN_ATTEMPT: '01' } },
    { env: { GITHUB_RUN_ATTEMPT: '9007199254740992' } },
    { args: [input.directory] },
    { args: [input.directory, commit, 'unexpected'] },
    { args: [input.directory, `${commit}\n`] },
  ];
  for (const options of cases) {
    const result = runCLI(input.directory, output, options);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(
      result.stderr,
      'Public Simulator artifact verification failed\n',
    );
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  }
});

test('CLI failure preserves unrelated Actions outputs and never prints malformed metadata', async t => {
  const input = await fixture(t);
  const sentinel = 'synthetic-private-build-data';
  await fs.writeFile(input.metadataPath, `${sentinel}: not JSON`);
  const output = path.join(input.directory, 'outputs');
  await fs.writeFile(output, 'existing=unchanged\n');
  const result = runCLI(input.directory, output);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(
    result.stderr,
    'Public Simulator artifact verification failed\n',
  );
  assert.ok(!result.stderr.includes(sentinel));
  assert.ok(!result.stderr.includes(input.directory));
  assert.equal(await fs.readFile(output, 'utf8'), 'existing=unchanged\n');
});

test('importing the helper does not execute the CLI or publish an allow output', async t => {
  const input = await fixture(t);
  const output = path.join(input.directory, 'outputs');
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(
        new URL('./public-artifact.mjs', import.meta.url).href,
      )});`,
    ],
    { encoding: 'utf8', timeout: 10000, env: { GITHUB_OUTPUT: output } },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  await assert.rejects(fs.stat(output), { code: 'ENOENT' });
});
