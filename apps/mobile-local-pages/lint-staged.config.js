import path from 'node:path';

const TAILWIND_THEME_V4_FILE = 'src/styles/tailwind-theme-v4.css';
const NORMALIZED_TAILWIND_THEME_V4_FILE = path.posix.normalize(
  TAILWIND_THEME_V4_FILE,
);

const normalizeFilePath = file => {
  return path.posix.normalize(file.split(path.win32.sep).join(path.posix.sep));
};

const shouldSkipPrettier = file => {
  const normalizedFile = normalizeFilePath(file);

  return (
    normalizedFile === NORMALIZED_TAILWIND_THEME_V4_FILE ||
    normalizedFile.endsWith(`/${NORMALIZED_TAILWIND_THEME_V4_FILE}`)
  );
};

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
