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

function jobCondition(block) {
  const expression = block.match(/^    if: \$\{\{ (.+) \}\}$/m)?.[1];
  assert.ok(expression, 'Missing explicit job condition');
  return expression;
}

// Interpret only this lane's reviewed conjunction/equality grammar, not general
// GitHub expressions. These fixtures guard the source policy, not scheduling.
function evaluateStartupCondition(expression, { cancelled = false, needs }) {
  return expression
    .split(' && ')
    .map(term => {
      if (term === '!cancelled()') return !cancelled;
      const match = term.match(
        /^needs\.([a-z_]+(?:\.[a-z_]+)*) (==|!=) '([^']*)'$/,
      );
      assert.ok(match, `Unsupported condition term: ${term}`);
      const [, selector, operator, expected] = match;
      const value = selector
        .split('.')
        .reduce((node, key) => node?.[key], needs);
      const actual = value ?? '';
      return operator === '==' ? actual === expected : actual !== expected;
    })
    .every(Boolean);
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

test('manual startup exposes nine inputs with only iOS 27 selected by default', async () => {
  const source = await workflow('startup');
  const dispatch = source.match(
    /^  workflow_dispatch:\n([\s\S]*?)(?=^\S)/m,
  )?.[1];
  assert.ok(dispatch, 'Missing manual startup trigger');
  const inputs = Object.fromEntries(
    [
      ...dispatch.matchAll(
        /^      (\w+):\n([\s\S]*?)(?=^      \w+:|$(?![\s\S]))/gm,
      ),
    ].map(([, name, declaration]) => [name, declaration]),
  );
  assert.deepEqual(Object.keys(inputs), [
    'execution_environment',
    'build_xcode',
    'ios_16',
    'ios_17',
    'ios_18',
    'ios_26',
    'ios_27',
    'build_only',
    'SKIP_NOTIFY_LARK',
  ]);
  for (const name of [
    'ios_16',
    'ios_17',
    'ios_18',
    'ios_26',
    'ios_27',
    'build_only',
    'SKIP_NOTIFY_LARK',
  ]) {
    assert.match(inputs[name], /^        type: boolean$/m);
    assert.equal(
      inputs[name].match(/^        default: (.+)$/m)?.[1],
      name === 'ios_27' ? 'true' : 'false',
    );
  }
  assert.match(
    inputs.execution_environment,
    /^        default: 'mobile-local'$/m,
  );
  assert.match(inputs.build_xcode, /^        default: '27.1'$/m);
  assert.doesNotMatch(
    source,
    /inputs\.ios_majors|inputs\.build_only|inputs\.ios_(?:16|17|18|26|27)/,
  );
  assert.match(source, /^  push:\n    branches:\n      - 'publish\/\*'$/m);
});

test('one effective selection policy supplies the matrix and every downstream consumer', async () => {
  const source = await workflow('startup');
  const matrix = job(source, 'matrix');
  assert.match(
    matrix,
    /id: selection\n[\s\S]*?SIMULATOR_INPUTS: \$\{\{ toJSON\(inputs\) \}\}[\s\S]*?run: node scripts\/ios-startup-smoke\/selection\.mjs/,
  );
  assert.ok(matrix.indexOf('selection.mjs') < matrix.indexOf('- id: matrix'));
  assert.match(
    matrix,
    /^      requested_majors: \$\{\{ steps.selection.outputs.requested_majors \}\}$/m,
  );
  assert.match(
    matrix,
    /^      build_only: \$\{\{ steps.selection.outputs.build_only \}\}$/m,
  );
  assert.match(
    matrix,
    /^          REQUESTED_MAJORS: \$\{\{ steps.selection.outputs.requested_majors \}\}$/m,
  );
  for (const name of ['archive', 'startup'])
    assert.match(
      job(source, name),
      /needs.matrix.outputs.build_only == 'false'/,
    );
  const startup = job(source, 'startup');
  assert.match(
    startup,
    /^      matrix: \$\{\{ fromJSON\(needs.matrix.outputs.matrix\) \}\}$/m,
  );
  const summary = job(source, 'summary');
  assert.match(
    summary,
    /^          REQUESTED_MAJORS: \$\{\{ needs.matrix.outputs.requested_majors \}\}$/m,
  );
  assert.equal(
    [...summary.matchAll(/needs.matrix.outputs.build_only == 'false'/g)].length,
    3,
  );
  assert.match(
    summary,
    /^        if: needs.matrix.outputs.build_only == 'true'$/m,
  );
  const notify = job(source, 'notify');
  assert.match(
    notify,
    /^      requested_majors: \$\{\{ needs.matrix.outputs.requested_majors \|\| 'invalid' \}\}$/m,
  );
  assert.match(
    notify,
    /^      build_only: \$\{\{ needs.matrix.outputs.build_only == 'true' \}\}$/m,
  );
  assert.doesNotMatch(source, /16,17,18,26,27/);
});

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
  assert.match(
    job(source, 'startup'),
    /if:.*needs.matrix.outputs.build_only == 'false'/,
  );
  assert.match(
    job(source, 'archive'),
    /if:.*needs.matrix.outputs.build_only == 'false'/,
  );
  assert.match(job(source, 'summary'), /Build only — no startup qualification/);
  assert.match(
    job(source, 'summary'),
    /if: always\(\) && needs.matrix.outputs.build_only == 'false'/,
  );
});

test('startup readiness depends on native verification and required App transport, not auxiliary job results', async () => {
  const source = await workflow('startup');
  const build = job(source, 'build');
  for (const [name, value] of [
    ['native_result', 'steps.native_build.outcome'],
    ['public_app_allowed', 'steps.public_app.outputs.allowed'],
    ['artifact_result', 'steps.app_artifact.outcome'],
    ['artifact_id', 'steps.app_artifact.outputs.artifact-id'],
  ])
    assert.ok(build.includes(`      ${name}: \$\{\{ ${value} \}\}`));
  const nativeStep = build.match(
    /      - name: Build one unsigned Regression Simulator app\n([\s\S]*?)(?=^      - )/m,
  )?.[1];
  assert.ok(nativeStep, 'Missing native build step');
  assert.match(nativeStep, /^        id: native_build$/m);
  assert.match(
    nativeStep,
    /run: bash apps\/mobile\/scripts\/ci\/build-ios-simulator\.sh --output-dir "\$EVIDENCE_ROOT\/build"/,
  );
  assert.doesNotMatch(build, /continue-on-error/);

  const expression = jobCondition(job(source, 'startup'));
  assert.equal(
    expression,
    [
      '!cancelled()',
      "needs.matrix.result == 'success'",
      "needs.matrix.outputs.build_only == 'false'",
      "needs.build.outputs.native_result == 'success'",
      "needs.build.outputs.public_app_allowed == 'true'",
      "needs.build.outputs.artifact_result == 'success'",
      "needs.build.outputs.artifact_id != ''",
    ].join(' && '),
  );
  const ready = {
    cancelled: false,
    needs: {
      matrix: { result: 'success', outputs: { build_only: 'false' } },
      build: {
        result: 'success',
        outputs: {
          native_result: 'success',
          public_app_allowed: 'true',
          artifact_result: 'success',
          artifact_id: '12345',
        },
      },
      archive: { result: 'success' },
    },
  };
  for (const [label, modify, expected] of [
    ['all required inputs ready', () => {}, true],
    [
      'sibling S3 archive failure',
      value => {
        value.needs.archive.result = 'failure';
      },
      true,
    ],
    [
      'failed auxiliary build evidence upload',
      value => {
        value.needs.build.result = 'failure';
      },
      true,
    ],
    [
      'both auxiliary failures',
      value => {
        value.needs.build.result = 'failure';
        value.needs.archive.result = 'failure';
      },
      true,
    ],
    [
      'failed native build',
      value => {
        value.needs.build.outputs.native_result = 'failure';
        value.needs.build.outputs.artifact_id = '';
      },
      false,
    ],
    // A provenance failure may retain a public diagnostic artifact. It is not
    // a successful clean-source build and must not enter qualification.
    [
      'modified source with a retained public App',
      value => {
        value.needs.build.outputs.native_result = 'failure';
      },
      false,
    ],
    [
      'skipped native build',
      value => {
        value.needs.build.outputs.native_result = 'skipped';
      },
      false,
    ],
    [
      'invalid public gate',
      value => {
        value.needs.build.outputs.public_app_allowed = 'false';
      },
      false,
    ],
    [
      'missing public gate',
      value => {
        delete value.needs.build.outputs.public_app_allowed;
      },
      false,
    ],
    [
      'missing artifact ID',
      value => {
        delete value.needs.build.outputs.artifact_id;
      },
      false,
    ],
    [
      'empty artifact ID',
      value => {
        value.needs.build.outputs.artifact_id = '';
      },
      false,
    ],
    [
      'failed required transport despite an ID',
      value => {
        value.needs.build.outputs.artifact_result = 'failure';
      },
      false,
    ],
    [
      'skipped required transport',
      value => {
        value.needs.build.outputs.artifact_result = 'skipped';
      },
      false,
    ],
    [
      'cancelled workflow',
      value => {
        value.cancelled = true;
      },
      false,
    ],
    [
      'failed matrix',
      value => {
        value.needs.matrix.result = 'failure';
      },
      false,
    ],
    [
      'skipped matrix',
      value => {
        value.needs.matrix.result = 'skipped';
      },
      false,
    ],
    [
      'effective build-only request',
      value => {
        value.needs.matrix.outputs.build_only = 'true';
      },
      false,
    ],
    [
      'missing effective policy',
      value => {
        delete value.needs.matrix.outputs.build_only;
      },
      false,
    ],
  ]) {
    const fixture = structuredClone(ready);
    modify(fixture);
    assert.equal(
      evaluateStartupCondition(expression, fixture),
      expected,
      label,
    );
  }
  // Only execution is unblocked: the aggregate summary retains genuine failures.
  assert.match(
    job(source, 'summary'),
    /^          BUILD_RESULT: \$\{\{ needs.build.result \}\}$/m,
  );
  assert.match(
    job(source, 'summary'),
    /^          STARTUP_RESULT: \$\{\{ needs.startup.result \}\}$/m,
  );
});

test('one runtime failure cannot cancel the other requested runtime jobs', async () => {
  for (const name of ['startup', 'probe']) {
    const startup = job(await workflow(name), 'startup');
    assert.match(startup, /^      fail-fast: false$/m);
    assert.match(
      startup,
      /^      max-parallel: \$\{\{ inputs.execution_environment != 'hosted' && 1 \|\| 5 \}\}$/m,
    );
    assert.match(startup, /^      cancel-in-progress: false$/m);
    assert.match(startup, /^      queue: max$/m);
    assert.doesNotMatch(startup, /continue-on-error/);
  }
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
  assert.match(archive, /needs: \[matrix, build\]\n/);
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
