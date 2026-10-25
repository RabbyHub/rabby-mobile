// Reuse one immutable simulator artifact. This module never builds the app.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { matrix, summarize, verifyArchive } from './hosted.mjs';

const repository = 'RabbyHub/rabby-mobile';
const workflowPath = '.github/workflows/ios_simulator_startup.yml';

function id(value) {
  if (
    !/^[1-9][0-9]*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    String(Number(value)) !== String(value)
  )
    throw new Error('Expected a positive GitHub run/artifact ID');
  return String(value);
}

export function selectSource(artifact, run, runId, artifactId) {
  runId = id(runId);
  artifactId = id(artifactId);
  const sha = run?.head_sha;
  const suffix = artifact?.name?.match(
    /^ios-startup-app-([a-f0-9]{40})-([1-9][0-9]*)$/,
  );
  if (
    String(run?.id) !== runId ||
    String(artifact?.id) !== artifactId ||
    artifact.expired !== false ||
    run.status !== 'completed' ||
    run.repository?.full_name !== repository ||
    run.head_repository?.full_name !== repository ||
    run.path !== workflowPath ||
    !['push', 'workflow_dispatch'].includes(run.event) ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    !suffix ||
    suffix[1] !== sha ||
    String(artifact.workflow_run?.id) !== runId ||
    artifact.workflow_run?.head_sha !== sha ||
    !Number.isSafeInteger(run.repository.id) ||
    run.head_repository.id !== run.repository.id ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1 ||
    artifact.workflow_run.repository_id !== run.repository.id ||
    artifact.workflow_run.head_repository_id !== run.repository.id ||
    Number(suffix[2]) > run.run_attempt
  )
    throw new Error(
      'Artifact is not an available app from the selected same-repository simulator build',
    );
  return {
    repository,
    runId,
    artifactId,
    runAttempt: id(suffix[2]),
    sourceCommit: sha,
    artifactName: artifact.name,
    runConclusion: run.conclusion,
  };
}

async function github(endpoint) {
  if (!process.env.GITHUB_TOKEN)
    throw new Error('GitHub Actions read token is required');
  const response = await fetch(
    `https://api.github.com/repos/${repository}/${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    },
  );
  if (!response.ok)
    throw new Error(
      `GitHub artifact metadata request failed (${response.status})`,
    );
  return response.json();
}

function sourceFromEnvironment() {
  const source = JSON.parse(process.env.PROBE_SOURCE || 'null');
  if (
    source?.repository !== repository ||
    !/^[a-f0-9]{40}$/.test(source?.sourceCommit)
  )
    throw new Error('Missing resolved artifact selection');
  id(source.runId);
  id(source.artifactId);
  id(source.runAttempt);
  return source;
}

export async function verifyProbeArchive(directory, source) {
  return verifyArchive(directory, source.sourceCommit, {
    probe: true,
    producer: {
      repository: source.repository,
      runId: source.runId,
      runAttempt: source.runAttempt,
    },
  });
}

async function main([action, ...args]) {
  if (action === 'resolve') {
    const runId = id(process.env.SOURCE_RUN_ID);
    const artifactId = id(process.env.SOURCE_ARTIFACT_ID);
    const [artifact, run] = await Promise.all([
      github(`actions/artifacts/${artifactId}`),
      github(`actions/runs/${runId}`),
    ]);
    const source = selectSource(artifact, run, runId, artifactId);
    const selected = matrix(
      process.env.REQUESTED_MAJORS || '16,17,18,26,27',
      '26.3',
    );
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `source=${JSON.stringify(source)}\nmatrix=${JSON.stringify(selected)}\n`,
    );
    console.log(JSON.stringify(source, null, 2));
    return;
  }
  const source = sourceFromEnvironment();
  if (action === 'verify') {
    const metadata = await verifyProbeArchive(args[0], source);
    await fs.writeFile(
      path.join(args[0], 'probe-source.json'),
      JSON.stringify(source, null, 2) + '\n',
    );
    console.log(
      `Diagnostic artifact verified: ${source.artifactId}; source ${source.sourceCommit}; provenance ${metadata.sourceProvenance.status}`,
    );
    return;
  }
  if (action === 'summary') {
    const [directory, majors, harnessCommit] = args;
    const metadata = await verifyProbeArchive(
      path.join(directory, 'ios-startup-app-receipt'),
      source,
    );
    const reports = [];
    for (const entry of await fs.readdir(directory)) {
      if (!entry.startsWith('ios-startup-probe-test-')) continue;
      try {
        reports.push(
          JSON.parse(
            await fs.readFile(
              path.join(directory, entry, 'tests/results.json'),
              'utf8',
            ),
          ),
        );
      } catch {
        /* A missing/invalid report stays a failed row. */
      }
    }
    const result = {
      ...summarize(majors, source.sourceCommit, metadata, reports, {
        probe: true,
        harnessCommit,
      }),
      artifactSource: source,
    };
    const markdown = [
      '# iOS Simulator artifact probe — diagnostic only',
      '',
      `Artifact: ${source.artifactId}; build run: ${source.runId}; attempt: ${source.runAttempt}`,
      `App source: ${source.sourceCommit}; test harness: ${harnessCommit}`,
      `Source provenance: ${metadata.sourceProvenance.status}; original run: ${source.runConclusion}`,
      '',
      '**This reuses an existing app. It does not qualify the current source or repair the original build result.**',
      result.fullCoverage
        ? 'Full declared matrix requested.'
        : '**Partial matrix requested.**',
      '',
      '| iOS | Probe result |',
      '| --- | --- |',
      ...result.rows.map(row => `| ${row.runtime} | ${row.status} |`),
      '',
    ].join('\n');
    await fs.writeFile(
      path.join(directory, 'summary.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    await fs.writeFile(path.join(directory, 'summary.md'), markdown);
    if (process.env.GITHUB_STEP_SUMMARY)
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
    console.log(markdown);
    if (!result.passed || process.env.STARTUP_RESULT !== 'success')
      throw new Error(
        'Incomplete or failed artifact probe; see per-runtime evidence',
      );
    return;
  }
  throw new Error('Use resolve, verify or summary');
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
