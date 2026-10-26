import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const workflow = name =>
  fs.readFile(
    new URL(
      `../../.github/workflows/ios_simulator_${name}.yml`,
      import.meta.url,
    ),
    'utf8',
  );

// Small source contracts complement actionlint. They do not execute GitHub's
// scheduler, authenticate to AWS or prove native build/Simulator behavior.
function job(source, name) {
  const match = source.match(
    new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  \\w+:|$(?![\\s\\S]))`, 'm'),
  );
  assert.ok(match, `Missing job ${name}`);
  return match[1];
}

const localTransferLabels = [
  'self-hosted',
  'macOS',
  'ARM64',
  'mobile-local',
  'mobile-ios-simulator',
];
const localTransferRunner =
  /runs-on:\s*\[\s*self-hosted,\s*macOS,\s*ARM64,\s*mobile-local,\s*mobile-ios-simulator,?\s*\]/;

test('simulator build pins UTF-8 locale before Ruby and CocoaPods preparation', async () => {
  const build = job(await workflow('startup'), 'build');
  const environment = build.match(/^    env:\n([\s\S]*?)(?=^    \w+:)/m);
  assert.ok(environment, 'Missing build-job environment');
  assert.match(environment[1], /^      LANG: 'en_US\.UTF-8'$/m);
  assert.match(environment[1], /^      LC_ALL: 'en_US\.UTF-8'$/m);
  // Job scope reaches toolchain setup and the native build without relying on
  // an interactive shell, SSH's locale forwarding or a sourced user profile.
  const steps = build.slice(build.indexOf('    steps:'));
  assert.match(steps, /source "\$HOME\/\.rvm\/scripts\/rvm"/);
  assert.match(steps, /build-ios-simulator\.sh/);
  assert.doesNotMatch(steps, /^\s+(?:LANG|LC_ALL):/m);
});

test('local test jobs select the installed matrix Xcode while App build retains its selected compiler', async () => {
  for (const name of ['startup', 'probe']) {
    const source = await workflow(name);
    const startup = job(source, 'startup');
    assert.match(startup, /TEST_XCODE: \$\{\{ matrix.xcode \}\}/);
    assert.match(
      startup,
      /if \[ "\$EXECUTION_ENVIRONMENT" = mobile-local \]; then toolchain_args\+=\(--installed\); fi/,
    );
    assert.match(
      startup,
      /toolchain\.mjs "\$TEST_XCODE" "\$\{toolchain_args\[@\]\}"/,
    );
    assert.doesNotMatch(startup, /xcode-select\s+(?:-s|--switch)/);
  }
  const build = job(await workflow('startup'), 'build');
  assert.match(
    build,
    /BUILD_XCODE: \$\{\{ inputs.build_xcode \|\| '27.1' \}\}/,
  );
  assert.match(build, /toolchain\.mjs "\$BUILD_XCODE" --build/);
  assert.doesNotMatch(build, /--installed/);
});

test('build-only creates reusable output without archive or startup qualification', async () => {
  const source = await workflow('startup');
  assert.match(
    source,
    /build_only:[\s\S]*?type: boolean[\s\S]*?default: false/,
  );
  assert.match(
    job(source, 'build'),
    /artifact_id:.*app_artifact.outputs.artifact-id/,
  );
  assert.match(job(source, 'startup'), /if:.*!inputs.build_only/);
  assert.match(job(source, 'archive'), /if:.*!inputs.build_only/);
  assert.match(job(source, 'summary'), /Build only — no startup qualification/);
  assert.match(job(source, 'summary'), /if: always\(\) && !inputs.build_only/);
});

test('public app publication excludes release secrets and raw build logs and requires a verified profile', async () => {
  const build = job(await workflow('startup'), 'build');
  assert.doesNotMatch(
    build,
    /secrets\.(?:RABBY_MOBILE_KR_PWD|RABBY_MOBILE_CODE2|MOBILE_SAFE_API_KEY)/,
  );
  const gate = build.indexOf('id: public_app');
  const upload = build.indexOf('id: app_artifact');
  assert.ok(gate >= 0 && upload > gate);
  assert.match(
    build.slice(gate, upload),
    /if: always\(\)[\s\S]*public-artifact\.mjs "\$EVIDENCE_ROOT\/build" "\$GITHUB_SHA"/,
  );
  assert.match(
    build.slice(upload),
    /if: \$\{\{ always\(\) && steps\.public_app\.outputs\.allowed == 'true' \}\}/,
  );
  const paths = build.slice(upload).matchAll(/^            (.+)$/gm);
  assert.deepEqual(
    Array.from(paths, match => match[1]),
    [
      '${{ env.EVIDENCE_ROOT }}/build/RabbyMobile-simulator.zip',
      '${{ env.EVIDENCE_ROOT }}/build/metadata.json',
      '${{ env.EVIDENCE_ROOT }}/build/source-changes.json',
      '${{ env.EVIDENCE_ROOT }}/build/macho-build.txt',
      '${{ env.EVIDENCE_ROOT }}/toolchain.json',
      '${{ env.EVIDENCE_ROOT }}/build-platform.json',
    ],
  );
});

test('S3 public relay verifies the original archive profile before upload and cannot run after failure', async () => {
  const resolve = job(await workflow('probe'), 'resolve');
  const relay = resolve.indexOf('id: relay');
  const gate = resolve.indexOf('probe.mjs verify-public');
  assert.ok(gate >= 0 && relay > gate);
  const gateStep = resolve.slice(resolve.lastIndexOf('      - ', gate), relay);
  assert.match(gateStep, /if: inputs\.source_type == 's3'/);
  assert.match(
    gateStep,
    /PROBE_SOURCE: \$\{\{ steps\.fetch\.outputs\.source \}\}/,
  );
  assert.match(gateStep, /verify-public "\$EVIDENCE_ROOT\/app"/);
  const relayStep = resolve.slice(relay);
  assert.match(relayStep, /if: inputs\.source_type == 's3'/);
  assert.doesNotMatch(
    gateStep + relayStep,
    /always\(|continue-on-error|failure\(|!cancelled\(/,
  );
});

test('local S3 archive is independent of startup and keeps the original build attempt on retry', async () => {
  const source = await workflow('startup');
  const archive = job(source, 'archive');
  assert.match(archive, /needs: build\n/);
  assert.match(archive, localTransferRunner);
  assert.match(archive, /!cancelled\(\).*artifact_id != ''/);
  assert.match(archive, /artifact-ids:.*needs.build.outputs.artifact_id/);
  assert.match(
    archive,
    /SOURCE_RUN_ATTEMPT:.*needs.build.outputs.source_run_attempt/,
  );
  assert.match(archive, /SOURCE_RUN_ID:.*github.run_id/);
  assert.match(archive, /SOURCE_COMMIT:.*github.sha/);
  assert.match(archive, /SOURCE_REF_NAME: \$\{\{ github.ref_name \}\}/);
  assert.match(archive, /SOURCE_ARTIFACT_ID:.*needs.build.outputs.artifact_id/);
  assert.doesNotMatch(archive, /SOURCE_RUN_ATTEMPT:.*github.run_attempt/);
  assert.match(
    job(source, 'build'),
    /source_run_attempt:.*steps.build_context.outputs.source_run_attempt/,
  );
  assert.match(job(source, 'startup'), /needs: \[matrix, build\]/);
  assert.match(job(source, 'summary'), /needs: \[matrix, build, startup\]/);
  assert.doesNotMatch(
    archive,
    /continue-on-error|deploy-ios|build-ios-simulator\.sh|yarn install|pod install/,
  );
});

test('manual S3 upload probe reuses exactly selected bytes and the automatic uploader', async () => {
  const automatic = job(await workflow('startup'), 'archive');
  const manual = await workflow('archive');
  assert.match(manual, /workflow_dispatch:/);
  assert.doesNotMatch(manual, /^  push:|workflow_run:|workflow_call:/m);
  assert.match(job(manual, 'archive'), localTransferRunner);
  assert.match(manual, /probe\.mjs resolve/);
  assert.match(manual, /artifact-ids:.*steps.select.outputs.artifact_id/);
  assert.match(manual, /run-id:.*steps.select.outputs.artifact_run_id/);
  assert.match(
    manual,
    /SOURCE_RUN_ATTEMPT:.*fromJSON\(steps.select.outputs.source\).runAttempt/,
  );
  assert.match(
    manual,
    /SOURCE_REF_NAME: \$\{\{ steps.select.outputs.source_ref_name \}\}/,
  );
  assert.doesNotMatch(manual, /SOURCE_REF_NAME:.*github\.(?:ref|head_ref)/);
  for (const [variable, field] of [
    ['SOURCE_RUN_ID', 'runId'],
    ['SOURCE_COMMIT', 'sourceCommit'],
    ['SOURCE_ARTIFACT_ID', 'artifactId'],
  ])
    assert.match(
      manual,
      new RegExp(
        `${variable}:.*fromJSON\\(steps.select.outputs.source\\).${field}`,
      ),
    );
  for (const source of [automatic, manual]) {
    assert.match(source, /archive\.mjs upload "\$EVIDENCE_ROOT\/app"/);
    assert.match(source, /ARCHIVE_NODE/);
    assert.match(source, /clean: false/);
    assert.doesNotMatch(
      source,
      /public-read|no-verify-ssl|configure-aws-credentials|AWS_SECRET_ACCESS_KEY|MATCH_PASSWORD/,
    );
  }
  assert.doesNotMatch(
    manual,
    /deploy-ios|build-ios-simulator\.sh|xcodebuild|pod install|yarn install/,
  );
});

test('each archive job captures its own UTC timestamp once before checkout', async () => {
  for (const name of ['startup', 'archive']) {
    const archive = job(await workflow(name), 'archive');
    const firstStep = archive.match(
      /^    steps:\n      - name: Capture archive job start \(UTC\)\n([\s\S]*?)(?=^      - )/m,
    );
    assert.ok(
      firstStep,
      `${name} must capture time in its first executable step`,
    );
    assert.match(
      firstStep[1],
      /^        working-directory: \$\{\{ github.workspace \}\}$/m,
    );
    assert.match(
      firstStep[1],
      /printf 'ARCHIVE_JOB_STARTED_AT=%s\\n' "\$\(date -u '\+%Y%m%d%H%M%S'\)" >> "\$GITHUB_ENV"/,
    );
    assert.doesNotMatch(firstStep[1], /^\s+if:/m);
    assert.equal(
      (archive.match(/\bARCHIVE_JOB_STARTED_AT\b/g) || []).length,
      1,
    );
    assert.equal((archive.match(/\bdate -u\b/g) || []).length, 1);
    // The archive namespace uses the actual uploader run; original producer
    // SOURCE_* bindings remain separate and must not replace GitHub's run ID.
    assert.doesNotMatch(archive, /^\s+GITHUB_RUN_ID:/m);
  }
  assert.doesNotMatch(
    job(await workflow('startup'), 'build'),
    /ARCHIVE_JOB_STARTED_AT/,
  );
  assert.doesNotMatch(
    job(await workflow('probe'), 'resolve'),
    /ARCHIVE_JOB_STARTED_AT/,
  );
});

test('S3 startup probe never asks the expired original artifact for transport', async () => {
  const source = await workflow('probe');
  const resolve = job(source, 'resolve');
  const runner = resolve.match(
    /runs-on: \$\{\{ inputs.source_type == 's3' && fromJSON\('(\[[^\n]*\])'\) \|\| 'ubuntu-latest' \}\}/,
  );
  assert.ok(
    runner,
    'S3 must select local labels and artifact-only resolution must stay on Ubuntu',
  );
  assert.deepEqual(JSON.parse(runner[1]), localTransferLabels);
  assert.match(resolve, /artifact_id:.*steps.relay.outputs.artifact-id/);
  assert.match(
    resolve,
    /artifact_run_id:.*steps.relay.outputs.artifact-id && github.run_id/,
  );
  assert.match(resolve, /archive\.mjs fetch/);
  assert.match(resolve, /if: inputs.source_type != 's3'/);
  for (const consumer of ['startup', 'summary']) {
    const selected = job(source, consumer);
    assert.match(selected, /artifact-ids:.*needs.resolve.outputs.artifact_id/);
    assert.match(selected, /run-id:.*needs.resolve.outputs.artifact_run_id/);
    assert.doesNotMatch(
      selected,
      /artifact-ids:.*fromJSON|run-id:.*fromJSON|RABBY_MOBILE_BUILD_BUCKET|archive\.mjs fetch/,
    );
  }
});

test('all S3 transfer jobs use the local default profile without login shells or embedded AWS credentials', async () => {
  for (const [name, jobName] of [
    ['startup', 'archive'],
    ['archive', 'archive'],
    ['probe', 'resolve'],
  ]) {
    const source = await workflow(name);
    const transfer = job(source, jobName);
    const environment = transfer.match(/^    env:\n([\s\S]*?)(?=^    \w+:)/m);
    assert.ok(
      environment,
      `${name}/${jobName} needs explicit AWS profile selection`,
    );
    assert.match(environment[1], /^      AWS_PROFILE: ['"]?default['"]?$/m);
    assert.match(
      environment[1],
      /^      AWS_EC2_METADATA_DISABLED: ['"]true['"]$/m,
    );
    assert.doesNotMatch(
      transfer.slice(transfer.indexOf('    steps:')),
      /^\s+(?:AWS_PROFILE|AWS_EC2_METADATA_DISABLED):/m,
    );
    assert.match(
      source,
      /^defaults:\n  run:\n    shell: bash --noprofile --norc -eo pipefail \{0\}$/m,
    );
    for (const [, shell] of transfer.matchAll(/^\s+shell:\s*(.+)$/gm))
      assert.equal(shell, 'bash --noprofile --norc -eo pipefail {0}');
    assert.doesNotMatch(
      transfer,
      /mobile-aws|configure-aws-credentials|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|AWS_SECURITY_TOKEN/,
    );
    assert.match(
      transfer,
      /RABBY_MOBILE_BUILD_BUCKET: \$\{\{ secrets.RABBY_MOBILE_BUILD_BUCKET \}\}/,
    );
  }
});

test('private S3 transfers keep exact locators instead of public URLs, presigning or hardcoded buckets', async () => {
  for (const [name, jobName] of [
    ['startup', 'archive'],
    ['archive', 'archive'],
    ['probe', 'resolve'],
  ]) {
    const transfer = job(await workflow(name), jobName);
    assert.doesNotMatch(
      transfer,
      /debank-(?:app-)?build-artifacts|download\.rabby\.io|\.s3[.-]|public-read|--acl|presign|no-verify-ssl|cloudfront/,
    );
  }
  const resolve = job(await workflow('probe'), 'resolve');
  assert.match(resolve, /S3_ARCHIVE_KEY: \$\{\{ inputs.s3_archive_key \}\}/);
  assert.match(
    resolve,
    /archive\.mjs fetch "\$S3_ARCHIVE_KEY" "\$EVIDENCE_ROOT\/app"/,
  );
  assert.doesNotMatch(resolve, /\bcurl\b|\bwget\b/);
});
