export default {
  '*.{,js,jsx}': 'eslint --fix --quiet',
  '*.{,ts,tsx}': 'eslint --fix --quiet',
  '*': 'prettier --write --ignore-unknown',
};
