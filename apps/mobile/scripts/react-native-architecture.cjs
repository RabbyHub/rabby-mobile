const BOOLEAN_ENV_VALUES = new Map([
  ['1', true],
  ['true', true],
  ['yes', true],
  ['on', true],
  ['0', false],
  ['false', false],
  ['no', false],
  ['off', false],
]);

const DEFAULT_NEW_ARCH_ENABLED = true;

const parseArchitectureFlag = (name, value) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  const normalizedValue = String(value).toLowerCase();
  const parsedValue = BOOLEAN_ENV_VALUES.get(normalizedValue);

  if (parsedValue === undefined) {
    throw new Error(
      `[react-native-architecture] ${name} must be one of true/false or 1/0. Received: ${value}`,
    );
  }

  return parsedValue;
};

const resolveArchitecture = ({
  environment = process.env,
  projectProperty,
} = {}) => {
  const candidates = [
    [
      'RCT_NEW_ARCH_ENABLED',
      parseArchitectureFlag(
        'RCT_NEW_ARCH_ENABLED',
        environment.RCT_NEW_ARCH_ENABLED,
      ),
    ],
    [
      'ORG_GRADLE_PROJECT_newArchEnabled',
      parseArchitectureFlag(
        'ORG_GRADLE_PROJECT_newArchEnabled',
        environment.ORG_GRADLE_PROJECT_newArchEnabled,
      ),
    ],
    [
      'newArchEnabled',
      parseArchitectureFlag('newArchEnabled', projectProperty),
    ],
  ].filter(([, value]) => value !== undefined);

  const architectureEnabled = candidates[0]?.[1] ?? DEFAULT_NEW_ARCH_ENABLED;
  const mismatch = candidates.find(
    ([, value]) => value !== architectureEnabled,
  );

  if (mismatch) {
    throw new Error(
      `[react-native-architecture] ${candidates
        .map(([name, value]) => `${name}=${value}`)
        .join(
          ', ',
        )} resolve to different architectures. Use one consistent value for this build.`,
    );
  }

  return architectureEnabled ? 'new' : 'legacy';
};

const resolveReactNativeArchitecture = (environment = process.env) =>
  resolveArchitecture({ environment });

const resolveGradleReactNativeArchitecture = ({
  environment = process.env,
  projectProperty,
} = {}) => resolveArchitecture({ environment, projectProperty });

const resolveStartupProfilerWorkerDeferral = (environment = process.env) =>
  parseArchitectureFlag(
    'RABBY_STARTUP_PROFILER_DEFER_WORKER',
    environment.RABBY_STARTUP_PROFILER_DEFER_WORKER,
  ) ?? false;

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (
      args.length !== 0 &&
      (args.length !== 2 || args[0] !== '--gradle-project-new-arch')
    ) {
      throw new Error(
        '[react-native-architecture] expected --gradle-project-new-arch <value>',
      );
    }
    process.stdout.write(
      `${resolveGradleReactNativeArchitecture({ projectProperty: args[1] })}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  resolveGradleReactNativeArchitecture,
  resolveReactNativeArchitecture,
  resolveStartupProfilerWorkerDeferral,
  isLegacyReactNativeArchitecture: environment =>
    resolveReactNativeArchitecture(environment) === 'legacy',
};
