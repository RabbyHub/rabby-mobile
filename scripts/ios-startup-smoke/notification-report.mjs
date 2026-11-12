import fs from 'node:fs/promises';

// Both summary owners export the same bounded, non-secret notification contract.
// Export before their failing exit so the final job can report missing evidence.
export async function writeNotificationReport(result, env = process.env) {
  if (!env.GITHUB_OUTPUT) return;
  const report = {
    commit: result.commit,
    harnessCommit: result.harnessCommit,
    mode: result.mode,
    environment: result.environment,
    fullCoverage: result.fullCoverage,
    passed: result.passed,
    qualificationPassed: result.qualificationPassed,
    rows: result.rows.map(({ major, runtime, xcode, status }) => ({
      major,
      runtime,
      xcode,
      status,
    })),
    ...(result.mode === 'probe'
      ? { artifactSource: result.artifactSource, buildXcode: result.buildXcode }
      : {}),
  };
  const value = JSON.stringify({
    schemaVersion: 1,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    report,
  });
  if (Buffer.byteLength(value) > 16384)
    throw new Error('Notification evidence exceeds the output limit');
  await fs.appendFile(env.GITHUB_OUTPUT, `notification_report=${value}\n`);
}
