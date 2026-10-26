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

test('AWS archive is independent of startup and keeps the original build attempt on retry', async () => {
  const source = await workflow('startup');
  const archive = job(source, 'archive');
  assert.match(archive, /needs: build\n/);
  assert.match(archive, /runs-on: \[self-hosted, macOS, ARM64, mobile-aws\]/);
  assert.match(archive, /!cancelled\(\).*artifact_id != ''/);
  assert.match(archive, /artifact-ids:.*needs.build.outputs.artifact_id/);
  assert.match(
    archive,
    /SOURCE_RUN_ATTEMPT:.*needs.build.outputs.source_run_attempt/,
  );
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
  assert.match(manual, /runs-on: \[self-hosted, macOS, ARM64, mobile-aws\]/);
  assert.match(manual, /probe\.mjs resolve/);
  assert.match(manual, /artifact-ids:.*steps.select.outputs.artifact_id/);
  assert.match(manual, /run-id:.*steps.select.outputs.artifact_run_id/);
  assert.match(
    manual,
    /SOURCE_RUN_ATTEMPT:.*fromJSON\(steps.select.outputs.source\).runAttempt/,
  );
  for (const source of [automatic, manual]) {
    assert.match(source, /archive\.mjs upload "\$EVIDENCE_ROOT\/app"/);
    assert.match(source, /shell: bash -ieol pipefail \{0\}/);
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

test('S3 startup probe never asks the expired original artifact for transport', async () => {
  const source = await workflow('probe');
  const resolve = job(source, 'resolve');
  assert.match(resolve, /inputs.source_type == 's3'.*mobile-aws/);
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
