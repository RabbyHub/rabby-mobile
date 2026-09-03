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

const resolveReactNativeArchitecture = (environment = process.env) => {
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
  ].filter(([, value]) => value !== undefined);

  const architectureEnabled = candidates[0]?.[1] ?? false;
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

module.exports = {
  resolveReactNativeArchitecture,
  isLegacyReactNativeArchitecture: environment =>
    resolveReactNativeArchitecture(environment) === 'legacy',
};
