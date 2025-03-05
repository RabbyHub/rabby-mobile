module.exports = {
  root: true,
  // extends: '@react-native',
  extends: '@react-native-community',
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-restricted-imports': [
      'error',
      {
        name: 'react-use',
        message:
          "Please import the specific function from react-use instead of the whole library (e.g. import useTimeout from 'react-use/lib/useTimeout')",
      },
    ],
  },
};
