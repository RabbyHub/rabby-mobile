const TAILWIND_THEME_V4_FILE = 'src/styles/tailwind-theme-v4.css';

const shouldSkipPrettier = file =>
  file === TAILWIND_THEME_V4_FILE ||
  file.endsWith(`/${TAILWIND_THEME_V4_FILE}`);

export default {
  '*.{,js,jsx}': 'eslint --fix --quiet',
  '*.{,ts,tsx}': 'eslint --fix --quiet',
  '*': files => {
    const formatTargets = files.filter(file => !shouldSkipPrettier(file));

    if (!formatTargets.length) {
      return [];
    }

    return `prettier --write --ignore-unknown ${formatTargets
      .map(file => JSON.stringify(file))
      .join(' ')}`;
  },
};
