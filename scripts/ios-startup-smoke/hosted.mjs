import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { parseMajors, requiredMajors } from './run.mjs';
import { testXcodeVersion } from './toolchain.mjs';
import { writeNotificationReport } from './notification-report.mjs';

export const hostedTargets = [
  { major: 16, runtime: '16.4', xcode: '26.3', runner: 'macos-26' },
  { major: 17, runtime: '17.5', xcode: '26.3', runner: 'macos-26' },
  { major: 18, runtime: '18.5', xcode: '26.3', runner: 'macos-26' },
  { major: 26, runtime: '26.2', xcode: '26.3', runner: 'macos-26' },
  { major: 27, runtime: '27.0', xcode: '27.1', runner: 'xcode-27' },
];

export const localRunner = [
  'self-hosted',
  'macOS',
  'ARM64',
  'mobile-local',
  'mobile-ios-simulator',
];

export function buildRunner(compiler, environment = 'mobile-local') {
  if (!['mobile-local', 'hosted'].includes(environment))
    throw new Error('Choose mobile-local or hosted explicitly');
  if (!['26.3', '27.1'].includes(compiler))
    throw new Error('Unsupported app compiler');
  if (environment === 'mobile-local') {
    if (compiler !== '27.1')
      throw new Error(
        'mobile-local requires Xcode 27.1; choose hosted for 26.3',
      );
    return [...localRunner];
  }
  return compiler === '27.1' ? 'xcode-27' : 'macos-26';
}

export function matrix(
  majors,
  compiler = '27.1',
  environment = 'mobile-local',
) {
  buildRunner(compiler, environment);
  return {
    include: parseMajors(majors).map(major => {
      const target = hostedTargets.find(target => target.major === major);
      return environment === 'hosted'
        ? { ...target, environment }
        : {
            ...target,
            // Explicit local representative, not a fallback after 18.5 fails.
            runtime: major === 18 ? '18.3.1' : target.runtime,
            xcode: testXcodeVersion(major, environment),
            runner: [...localRunner],
            environment,
          };
    }),
  };
}

export function validateReceipt(
  metadata,
  commit,
  { probe = false, producer } = {},
) {
  const provenance = metadata?.sourceProvenance;
  if (
    metadata?.schemaVersion !== 2 ||
    !/^[a-f0-9]{40}$/.test(commit) ||
    metadata.sourceCommit !== commit ||
    metadata.archive?.file !== 'RabbyMobile-simulator.zip' ||
    !Number.isSafeInteger(metadata.archive.bytes) ||
    metadata.archive.bytes <= 0 ||
    !/^[a-f0-9]{64}$/.test(metadata.archive.sha256) ||
    !/^[a-f0-9]{64}$/.test(metadata.executableSha256) ||
    !/^[a-f0-9]{64}$/.test(metadata.jsBundleSha256) ||
    metadata.platform !== 'iphonesimulator' ||
    metadata.configuration !== 'Regression' ||
    JSON.stringify(metadata.architectures) !== '["arm64"]' ||
    !['clean', 'modified'].includes(provenance?.status) ||
    !/^[a-f0-9]{40}$/.test(provenance?.headCommit) ||
    !Array.isArray(provenance?.changedFiles) ||
    !provenance.changedFiles.every(
      file => typeof file === 'string' && file.length > 0,
    )
  )
    throw new Error('Unexpected simulator build receipt');
  const clean =
    provenance.headCommit === commit && provenance.changedFiles.length === 0;
  if ((provenance.status === 'clean') !== clean)
    throw new Error('Inconsistent source provenance');
  if (!probe && provenance.status !== 'clean')
    throw new Error(
      'Modified source artifact is diagnostic-only; use the explicit probe',
    );
  if (
    producer &&
    ['repository', 'runId', 'runAttempt'].some(
      key => metadata.producer?.[key] !== producer[key],
    )
  )
    throw new Error(
      'Artifact producer does not match the selected workflow run',
    );
  return metadata;
}

export async function verifyArchive(directory, commit, options) {
  const metadata = JSON.parse(
    await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'),
  );
  validateReceipt(metadata, commit, options);
  const archive = path.join(directory, metadata.archive.file);
  const stat = await fs.lstat(archive);
  if (!stat.isFile()) throw new Error('Expected a regular simulator archive');
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(archive)) digest.update(chunk);
  if (
    stat.size !== metadata.archive.bytes ||
    digest.digest('hex') !== metadata.archive.sha256
  )
    throw new Error('Simulator archive does not match its build receipt');
  return metadata;
}

export function summarize(
  majors,
  commit,
  metadata,
  reports,
  { probe = false, harnessCommit = commit, environment = 'mobile-local' } = {},
) {
  const targets = matrix(majors, '27.1', environment).include;
  let receiptValid = true;
  try {
    validateReceipt(metadata, commit, { probe });
  } catch {
    receiptValid = false;
  }
  const rows = targets.map(target => {
    const matches = reports.filter(report =>
      report.results?.some(result => result.major === target.major),
    );
    const report = matches[0];
    const result = report?.results?.[0];
    const valid =
      matches.length === 1 &&
      receiptValid &&
      report.mode === (probe ? 'probe' : 'qualification') &&
      report.environment === environment &&
      report.harnessCommit === harnessCommit &&
      report.commit === commit &&
      report.sourceCommit === commit &&
      isDeepStrictEqual(report.buildMetadata, metadata) &&
      (!probe || report.qualificationPassed === false) &&
      metadata?.sourceCommit === commit &&
      report.appHash === metadata.executableSha256 &&
      report.jsHash === metadata.jsBundleSha256 &&
      report.results.length === 1 &&
      report.passed === true &&
      result.major === target.major &&
      result.version === target.runtime &&
      result.testXcode?.version === target.xcode &&
      result.status === 'passed';
    return {
      ...target,
      status: valid ? 'passed' : 'failed-or-missing',
    };
  });
  return {
    commit,
    harnessCommit,
    mode: probe ? 'probe' : 'qualification',
    environment,
    sourceProvenance: metadata?.sourceProvenance,
    fullCoverage: targets.length === requiredMajors.length,
    passed: rows.every(row => row.status === 'passed'),
    qualificationPassed:
      !probe &&
      targets.length === requiredMajors.length &&
      rows.every(row => row.status === 'passed'),
    rows,
  };
}

async function main([action, ...args]) {
  if (action === 'matrix') {
    const [majors, compiler = '27.1', environment = 'mobile-local'] = args;
    const selected = matrix(majors, compiler, environment);
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      'matrix=' +
        JSON.stringify(selected) +
        '\n' +
        'build_runner=' +
        JSON.stringify(buildRunner(compiler, environment)) +
        '\n',
    );
    return;
  }
  if (action === 'verify-archive') {
    await verifyArchive(args[0], args[1]);
    return;
  }
  if (action === 'summary') {
    const [directory, majors, commit] = args;
    const reports = [];
    let metadata;
    for (const entry of await fs.readdir(directory)) {
      const root = path.join(directory, entry);
      try {
        if (entry.startsWith('ios-startup-app-')) {
          metadata = JSON.parse(
            await fs.readFile(path.join(root, 'metadata.json'), 'utf8'),
          );
        } else if (entry.startsWith('ios-startup-test-')) {
          reports.push(
            JSON.parse(
              await fs.readFile(path.join(root, 'tests/results.json'), 'utf8'),
            ),
          );
        }
      } catch {
        // Missing receipts are failed rows, never silently omitted coverage.
      }
    }
    const result = summarize(majors, commit, metadata, reports, {
      environment: process.env.EXECUTION_ENVIRONMENT || 'mobile-local',
    });
    const markdown = [
      '# iOS Simulator startup coverage',
      '',
      'Commit: ' + commit,
      '',
      result.fullCoverage
        ? 'Full declared matrix requested.'
        : '**Manual subset; NOT full coverage.**',
      '',
      '| iOS | Runner | Test Xcode | Result |',
      '| --- | --- | --- | --- |',
      ...result.rows.map(
        row =>
          '| ' +
          [
            row.runtime,
            Array.isArray(row.runner) ? row.runner.join(', ') : row.runner,
            row.xcode,
            row.status,
          ].join(' | ') +
          ' |',
      ),
      '',
      'All passed rows must match the same build receipt and executable/JS hashes.',
      '',
    ].join('\n');
    await fs.writeFile(
      path.join(directory, 'summary.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    if (process.env.GITHUB_STEP_SUMMARY)
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
    console.log(markdown);
    await writeNotificationReport(result);
    if (
      !result.passed ||
      process.env.BUILD_RESULT !== 'success' ||
      process.env.STARTUP_RESULT !== 'success'
    )
      throw new Error('Incomplete or failed Simulator startup coverage/jobs');
    return;
  }
  throw new Error('Use matrix, verify-archive or summary');
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
