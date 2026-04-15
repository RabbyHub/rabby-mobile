module.exports = {
  root: true,
  extends: ['@metamask/eslint-config'],
  ignorePatterns: ['!.eslintrc.cjs', 'dist/'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      extends: ['@metamask/eslint-config-typescript'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
      rules: {
        '@typescript-eslint/promise-function-async': 'off',
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        'jsdoc/require-jsdoc': 'off',
        'no-negated-condition': 'off',
        'prefer-destructuring': 'off',
        'consistent-return': 'off',
      },
    },
    {
      files: ['*.js', '*.cjs'],
      extends: ['@metamask/eslint-config-nodejs'],
      parserOptions: {
        sourceType: 'script',
      },
      rules: {
        'no-restricted-globals': 'off',
      },
    },
  ],
  rules: {
    'import/no-anonymous-default-export': 'off',
    'import/no-unassigned-import': 'off',
    'no-restricted-globals': 'off',
  },
};
