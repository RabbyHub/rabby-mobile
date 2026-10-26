// Static workflow contracts only: no GitHub scheduling, credentials or Lark I/O.
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

function job(source, name) {
  const match = source.match(
    new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  \\w+:|$(?![\\s\\S]))`, 'm'),
  );
  assert.ok(match, `Missing job ${name}`);
  return match[1];
}

function steps(block) {
  const offset = block.indexOf('    steps:\n');
  assert.notEqual(offset, -1, 'Missing steps');
  return block
    .slice(offset + '    steps:\n'.length)
    .split(/(?=^      - )/m)
    .filter(step => step.trim());
}

function needs(block) {
  const match = block.match(/^    needs: (.+)$/m);
  assert.ok(match, 'Missing needs');
  return match[1]
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(name => name.trim());
}

function binding(block, key, expression, indent = 6) {
  const line = block.match(new RegExp(`^ {${indent}}${key}: (.+)$`, 'm'));
  assert.ok(line, `Missing ${key}`);
  assert.equal(line[1], '${{ ' + expression + ' }}');
}

test('startup and probe each have one opt-out finalizer calling the same workflow', async () => {
  for (const name of ['startup', 'probe']) {
    const source = await workflow(name);
    const input = source.match(
      /^      SKIP_NOTIFY_LARK:\n([\s\S]*?)(?=^      \w+:|^\S)/m,
    );
    assert.ok(input, 'Missing SKIP_NOTIFY_LARK dispatch input');
    assert.match(input[1], /^        type: boolean$/m);
    assert.match(input[1], /^        default: false$/m);
    assert.equal([...source.matchAll(/^  notify:$/gm)].length, 1);
    const notify = job(source, 'notify');
    assert.deepEqual(
      needs(notify),
      name === 'startup'
        ? ['matrix', 'build', 'startup', 'archive', 'summary']
        : ['resolve', 'startup', 'summary'],
    );
    const condition = notify
      .match(/^    if: (.+)$/m)?.[1]
      .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
      .trim();
    assert.equal(
      condition,
      "always() && github.repository == 'RabbyHub/rabby-mobile' && !inputs.SKIP_NOTIFY_LARK" +
        (name === 'startup'
          ? " && (github.event_name != 'push' || github.event.deleted != true)"
          : ''),
    );
    // Relative reuse pins the called workflow to this caller's exact commit.
    assert.match(
      notify,
      /^    uses: \.\/\.github\/workflows\/ios_simulator_notify\.yml$/m,
    );
    assert.doesNotMatch(
      notify,
      /^    (?:runs-on|steps|strategy|env):|continue-on-error|secrets: inherit/m,
    );
    assert.doesNotMatch(source, /notify\.mjs|notify-lark\.js/);
  }
});

test('notification preserves original startup, probe and archive dependency boundaries', async () => {
  const startup = await workflow('startup');
  for (const [name, expected] of [
    ['build', ['matrix']],
    ['archive', ['build']],
    ['startup', ['matrix', 'build']],
    ['summary', ['matrix', 'build', 'startup']],
  ])
    assert.deepEqual(needs(job(startup, name)), expected);
  const probe = await workflow('probe');
  assert.deepEqual(needs(job(probe, 'startup')), ['resolve']);
  assert.deepEqual(needs(job(probe, 'summary')), ['resolve', 'startup']);
  for (const [source, names] of [
    [startup, ['matrix', 'build', 'archive', 'startup', 'summary']],
    [probe, ['resolve', 'startup', 'summary']],
  ])
    for (const name of names)
      assert.doesNotMatch(
        job(source, name),
        /inputs\.SKIP_NOTIFY_LARK|notify\.mjs|ios_simulator_notify|continue-on-error/,
      );
});

test('shared notification accepts only workflow_call with the bounded typed contract', async () => {
  const source = await workflow('notify');
  const triggers = source.match(/^on:\n([\s\S]*?)(?=^\S)/m)?.[1];
  assert.ok(triggers, 'Missing reusable workflow trigger');
  assert.deepEqual(
    [...triggers.matchAll(/^  (\w+):/gm)].map(m => m[1]),
    ['workflow_call'],
  );
  const inputs = triggers.match(
    /^    inputs:\n([\s\S]*?)(?=^    secrets:)/m,
  )?.[1];
  assert.ok(inputs, 'Missing shared inputs');
  const declarations = Object.fromEntries(
    [
      ...inputs.matchAll(
        /^      (\w+):\n([\s\S]*?)(?=^      \w+:|$(?![\s\S]))/gm,
      ),
    ].map(([, name, value]) => [name, value]),
  );
  assert.deepEqual(Object.keys(declarations), [
    'mode',
    'needs_json',
    'notification_report',
    'source_json',
    'requested_majors',
    'execution_environment',
    'build_only',
    'build_xcode',
  ]);
  const defaults = {
    notification_report: "''",
    source_json: "''",
    requested_majors: "'16,17,18,26,27'",
    execution_environment: "'mobile-local'",
    build_only: 'false',
    build_xcode: "'27.1'",
  };
  for (const [name, value] of Object.entries(declarations)) {
    assert.match(
      value,
      new RegExp(
        `^        type: ${name === 'build_only' ? 'boolean' : 'string'}$`,
        'm',
      ),
    );
    if (['mode', 'needs_json'].includes(name)) {
      assert.match(value, /^        required: true$/m);
      assert.doesNotMatch(value, /^        default:/m);
    } else {
      assert.doesNotMatch(value, /^        required: true$/m);
      assert.equal(
        value.match(/^        default: (.+)$/m)?.[1],
        defaults[name],
      );
    }
  }
  const secrets = triggers.match(/^    secrets:\n([\s\S]*)/m)?.[1];
  assert.ok(secrets, 'Missing shared secrets');
  assert.deepEqual(
    [...secrets.matchAll(/^      (\w+):\n        required: true$/gm)].map(
      m => m[1],
    ),
    ['RABBY_MOBILE_LARK_CHAT_URL', 'RABBY_MOBILE_LARK_CHAT_SECRET'],
  );
  assert.match(source, /^permissions:\n  contents: read\n/m);
  assert.equal([...source.split('\njobs:')[1].matchAll(/^  \w+:/gm)].length, 1);
});

test('shared notification checks out the caller SHA and performs one dependency-free send', async () => {
  const notify = job(await workflow('notify'), 'notify');
  assert.match(notify, /^    runs-on: ubuntu-latest$/m);
  assert.match(notify, /^    timeout-minutes: 5$/m);
  assert.equal(steps(notify).length, 3);
  const actions = [...notify.matchAll(/^\s+(?:- )?uses: ([^\s]+).*$/gm)].map(
    match => match[1],
  );
  assert.equal(actions.length, 2);
  assert.match(actions[0], /^actions\/checkout@[a-f0-9]{40}$/);
  assert.match(actions[1], /^actions\/setup-node@[a-f0-9]{40}$/);
  assert.match(notify, /^          ref: \$\{\{ github.sha \}\}$/m);
  assert.match(notify, /^          node-version: ['"]?22['"]?$/m);
  assert.match(notify, /^          persist-credentials: false$/m);
  const sends = steps(notify).filter(step =>
    /node scripts\/ios-startup-smoke\/notify\.mjs send\b/.test(step),
  );
  assert.equal(sends.length, 1);
  assert.equal(
    [...notify.matchAll(/node scripts\/ios-startup-smoke\/notify\.mjs send\b/g)]
      .length,
    1,
  );
  assert.doesNotMatch(
    notify,
    /(?:yarn|npm|pnpm|corepack|bundle|pod)\s+(?:install|add|enable)|xcodebuild|simctl|build-ios-simulator|archive\.mjs|probe\.mjs|\baws\s|deploy-ios|notify-lark\.js|lark-notification\.js|download-artifact|upload-artifact|--retry|nick-fields\/retry/,
  );
  assert.doesNotMatch(sends[0], /--dry-run|\|\|\s*true|continue-on-error/);
});

test('callers pass only the existing webhook pair and only the shared send receives it', async () => {
  for (const name of ['startup', 'probe']) {
    const source = await workflow(name);
    const notify = job(source, 'notify');
    for (const suffix of ['URL', 'SECRET'])
      binding(
        notify,
        `RABBY_MOBILE_LARK_CHAT_${suffix}`,
        `secrets.RABBY_MOBILE_LARK_CHAT_${suffix} || secrets.LARK_CHAT_${suffix}`,
      );
    const secretBlock = notify.match(/^    secrets:\n([\s\S]*)/m)?.[1];
    assert.ok(secretBlock, 'Missing explicit caller secrets');
    assert.deepEqual(
      [...secretBlock.matchAll(/^      (\w+):/gm)].map(m => m[1]),
      ['RABBY_MOBILE_LARK_CHAT_URL', 'RABBY_MOBILE_LARK_CHAT_SECRET'],
    );
    assert.doesNotMatch(source.replace(notify, ''), /LARK_CHAT_(?:URL|SECRET)/);
  }
  const source = await workflow('notify');
  const notify = job(source, 'notify');
  const send = steps(notify).find(step => /notify\.mjs send\b/.test(step));
  assert.ok(send, 'Missing shared notification send step');
  for (const suffix of ['URL', 'SECRET'])
    binding(
      send,
      `RABBY_MOBILE_LARK_CHAT_${suffix}`,
      `secrets.RABBY_MOBILE_LARK_CHAT_${suffix}`,
      10,
    );
  assert.doesNotMatch(
    notify.replace(send, ''),
    /LARK_CHAT_(?:URL|SECRET)|\bsecrets\./,
  );
  assert.deepEqual(
    [...source.matchAll(/\bsecrets\.(\w+)/g)].map(m => m[1]),
    ['RABBY_MOBILE_LARK_CHAT_URL', 'RABBY_MOBILE_LARK_CHAT_SECRET'],
  );
  assert.doesNotMatch(
    source,
    /RABBY_ROBOT_LARK_APP|AWS_|RABBY_MOBILE_BUILD_BUCKET|MATCH_PASSWORD|RABBY_MOBILE_CODE|RABBY_MOBILE_KR_PWD|MOBILE_SAFE_API_KEY|bash -[a-z]*[il]|secrets: inherit/,
  );
});

test('callers bind current results and probe source to the common sender inputs', async () => {
  for (const name of ['startup', 'probe']) {
    const notify = job(await workflow(name), 'notify');
    assert.match(notify, new RegExp(`^      mode: ${name}$`, 'm'));
    for (const [key, expression] of [
      ['needs_json', 'toJSON(needs)'],
      ['notification_report', 'needs.summary.outputs.notification_report'],
      ['requested_majors', "inputs.ios_majors || '16,17,18,26,27'"],
      [
        'execution_environment',
        "inputs.execution_environment || 'mobile-local'",
      ],
    ])
      binding(notify, key, expression);
    if (name === 'startup') {
      binding(notify, 'build_only', 'inputs.build_only == true');
      binding(notify, 'build_xcode', "inputs.build_xcode || '27.1'");
      assert.doesNotMatch(notify, /^      source_json:/m);
    } else {
      binding(notify, 'source_json', 'needs.resolve.outputs.source');
      assert.doesNotMatch(notify, /^      build_(?:only|xcode):/m);
    }
  }
  const notify = job(await workflow('notify'), 'notify');
  for (const [key, expression] of [
    ['NOTIFICATION_MODE', 'inputs.mode'],
    ['STARTUP_NEEDS', 'inputs.needs_json'],
    ['STARTUP_REPORT', 'inputs.notification_report'],
    ['PROBE_SOURCE', 'inputs.source_json'],
    ['REQUESTED_MAJORS', 'inputs.requested_majors'],
    ['EXECUTION_ENVIRONMENT', 'inputs.execution_environment'],
    ['BUILD_ONLY', "inputs.build_only && 'true' || 'false'"],
    ['BUILD_XCODE', 'inputs.build_xcode'],
  ])
    binding(notify, key, expression, 10);
});

test('both summary owners expose their compact report even on a failed result', async () => {
  for (const name of ['startup', 'probe']) {
    const summary = job(await workflow(name), 'summary');
    binding(
      summary,
      'notification_report',
      'steps.report.outputs.notification_report',
    );
    const report = steps(summary).find(step =>
      /^\s+(?:- )?id: report$/m.test(step),
    );
    assert.ok(report, `${name} summary must expose its report step`);
    assert.match(
      report,
      new RegExp(`${name === 'startup' ? 'hosted' : 'probe'}\\.mjs summary`),
    );
    assert.match(
      report,
      name === 'startup'
        ? /if: always\(\) && !inputs\.build_only/
        : /if: always\(\)/,
    );
  }
  const archive = job(await workflow('startup'), 'archive');
  binding(archive, 'archive_key', 'steps.publish.outputs.archive_key');
  const publish = steps(archive).find(step =>
    /^\s+(?:- )?id: publish$/m.test(step),
  );
  assert.ok(publish, 'Archive must expose the upload step output');
  assert.match(publish, /archive\.mjs upload/);
});

test('manual archive does not notify or invoke the shared notification workflow', async () => {
  const source = await workflow('archive');
  assert.doesNotMatch(
    source,
    /^  notify:|notify\.mjs|ios_simulator_notify|LARK_CHAT_(?:URL|SECRET)/m,
  );
});
