module.exports = {
  root: true,
  // extends: '@react-native',
  extends: '@react-native-community',
  plugins: ['import'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
    'import/no-cycle': [
      'warn',
      {
        maxDepth: 12,
        ignoreExternal: true,
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-use',
            message:
              "Please import the specific function from react-use instead of the whole library (e.g. import useTimeout from 'react-use/lib/useTimeout')",
          },
          {
            name: 'react-native-animateable-text',
            message:
              "Please import AnimateableText from '@/components/Typography' instead",
          },
          {
            name: 'react-native',
            importNames: ['Text', 'TextInput'],
            message:
              "Please import Text/TextInput from '@/components/Typography' instead",
          },
          {
            name: 'react-native',
            importNames: ['Modal'],
            message:
              "Please import TrackedModal from '@/components/Modal/TrackedModal' instead of importing Modal directly from react-native",
          },
          {
            name: 'react-native-gesture-handler',
            importNames: ['Text', 'TextInput'],
            message:
              "Please import RNGHText/RNGHTextInput from '@/components/Typography' instead",
          },
          {
            name: '@rneui/base',
            importNames: ['Text'],
            message:
              "Please import RNEUIText from '@/components/Typography' instead",
          },
          {
            name: '@rneui/themed',
            importNames: ['Text'],
            message:
              "Please import RNEUIText from '@/components/Typography' instead",
          },
        ],
      },
    ],
  },
  settings: {
    'import/resolver': {
      typescript: {},
    },
  },
};
