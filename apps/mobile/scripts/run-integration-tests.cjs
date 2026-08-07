const { spawnSync } = require('node:child_process');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const jestPackageRoot = path.dirname(require.resolve('jest/package.json'));
const jestBin = path.join(jestPackageRoot, 'bin/jest.js');
const jestConfig = path.join(mobileRoot, 'jest.integration.config.js');
const coldStartTest = path.join(
  mobileRoot,
  'src/startup/appStateBootstrap.coldStart.integration.test.ts',
);
const coldStartScenarios = ['manual-unlock', 'valid-session'];
const forwardedJestArgs = process.argv.slice(2);

function runJest(args, extraEnv = {}) {
  const result = spawnSync(
    process.execPath,
    [
      jestBin,
      '--config',
      jestConfig,
      '--runInBand',
      ...forwardedJestArgs,
      ...args,
    ],
    {
      cwd: mobileRoot,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runJest([
  '--testPathIgnorePatterns=appStateBootstrap\\.coldStart\\.integration\\.test\\.ts$',
]);

for (const scenario of coldStartScenarios) {
  console.log(`\nRunning isolated app-state cold start: ${scenario}`);
  runJest([
    '--runTestsByPath',
    coldStartTest,
    '--testNamePattern',
    `app-state cold start integration: ${scenario}`,
  ]);
}
