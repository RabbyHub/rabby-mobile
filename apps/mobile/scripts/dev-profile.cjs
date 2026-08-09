const DEV_PROFILES = Object.freeze({
  lean: Object.freeze({
    moduleLoadingMode: 'lazy',
    maxOldSpaceSizeMb: 8192,
    rozeniteEnabled: false,
  }),
  inspect: Object.freeze({
    moduleLoadingMode: 'lazy',
    maxOldSpaceSizeMb: 16384,
    rozeniteEnabled: true,
  }),
  'eager-audit': Object.freeze({
    moduleLoadingMode: 'eager',
    maxOldSpaceSizeMb: 16384,
    rozeniteEnabled: false,
  }),
});

function resolveDevProfile(profileName) {
  const profile = DEV_PROFILES[profileName];
  if (!profile) {
    throw new Error(
      `Unsupported dev profile "${profileName}". Expected one of: ${Object.keys(
        DEV_PROFILES,
      ).join(', ')}`,
    );
  }
  return profile;
}

function createDevEnvironment(profileName, baseEnvironment = process.env) {
  const profile = resolveDevProfile(profileName);
  const nodeOptions = (baseEnvironment.NODE_OPTIONS || '')
    .split(/\s+/)
    .filter(
      option =>
        option && !/^--max[-_]old[-_]space[-_]size(?:=|$)/i.test(option),
    );

  nodeOptions.push(`--max_old_space_size=${profile.maxOldSpaceSizeMb}`);

  return {
    ...baseEnvironment,
    BABEL_ENV: 'development',
    NODE_ENV: 'development',
    NODE_OPTIONS: nodeOptions.join(' '),
    RABBY_MOBILE_DEV_PROFILE: profileName,
    RABBY_MOBILE_MODULE_LOADING_MODE: profile.moduleLoadingMode,
    WITH_ROZENITE: profile.rozeniteEnabled ? 'true' : 'false',
  };
}

module.exports = {
  DEV_PROFILES,
  createDevEnvironment,
  resolveDevProfile,
};
