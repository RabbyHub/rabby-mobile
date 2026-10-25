import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseMajors, requiredMajors } from './run.mjs';

export const hostedTargets = [
  { major: 16, runtime: '16.4', xcode: '26.3', runner: 'macos-26' },
  { major: 17, runtime: '17.5', xcode: '26.3', runner: 'macos-26' },
  { major: 18, runtime: '18.5', xcode: '26.3', runner: 'macos-26' },
  { major: 26, runtime: '26.2', xcode: '26.3', runner: 'macos-26' },
  { major: 27, runtime: '27.0', xcode: '27.1', runner: 'xcode-27' },
];

export function matrix(majors, compiler) {
  if (!['26.3', '27.1'].includes(compiler))
    throw new Error('Unsupported app compiler');
  return {
    include: parseMajors(majors).map(major =>
      hostedTargets.find(target => target.major === major),
    ),
  };
}

export async function verifyArchive(directory, commit) {
  const metadata = JSON.parse(
    await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'),
  );
  if (
    metadata.sourceCommit !== commit ||
    metadata.archive?.file !== 'RabbyMobile-simulator.zip' ||
    metadata.platform !== 'iphonesimulator' ||
    metadata.configuration !== 'Regression'
  )
    throw new Error('Unexpected simulator build receipt');
  const zip = await fs.readFile(path.join(directory, metadata.archive.file));
  if (
    zip.length !== metadata.archive.bytes ||
    createHash('sha256').update(zip).digest('hex') !== metadata.archive.sha256
  )
    throw new Error('Simulator archive does not match its build receipt');
  return metadata;
}

export function summarize(majors, commit, metadata, reports) {
  const targets = matrix(majors, '26.3').include;
  const rows = targets.map(target => {
    const matches = reports.filter(report =>
      report.results?.some(result => result.major === target.major),
    );
    const report = matches[0];
    const result = report?.results?.[0];
    const valid =
      matches.length === 1 &&
      report.commit === commit &&
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
    fullCoverage: targets.length === requiredMajors.length,
    passed: rows.every(row => row.status === 'passed'),
    rows,
  };
}

async function main([action, ...args]) {
  if (action === 'matrix') {
    const [majors, compiler] = args;
    const selected = matrix(majors, compiler);
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      'matrix=' +
        JSON.stringify(selected) +
        '\n' +
        'build_runner=' +
        (compiler === '27.1' ? 'xcode-27' : 'macos-26') +
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
    const result = summarize(majors, commit, metadata, reports);
    const markdown = [
      '# iOS Simulator startup coverage',
      '',
      'Commit: ' + commit,
      '',
      result.fullCoverage
        ? 'Full declared matrix requested.'
        : '**Manual subset; NOT full coverage.**',
      '',
      '| iOS | Hosted runner | Test Xcode | Result |',
      '| --- | --- | --- | --- |',
      ...result.rows.map(
        row =>
          '| ' +
          [row.runtime, row.runner, row.xcode, row.status].join(' | ') +
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
