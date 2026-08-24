module.exports = {
  root: true,
  // extends: '@react-native',
  extends: '@react-native-community',
  plugins: ['import'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-runtime-service-imports': 'error',
    'no-floating-deferred-service-api-calls': 'error',
    'no-persist-store-direct-mutation': 'error',
    'no-direct-native-token-chain-sync': 'error',
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
          {
            name: '@rabby-wallet/zeego/context-menu',
            message:
              "Use ContextMenuView from '@/components2024/ContextMenuView/ContextMenuView' so menu actions are resolved at open time",
          },
          {
            name: '@rabby-wallet/react-native-menu',
            message:
              "Use ContextMenuView from '@/components2024/ContextMenuView/ContextMenuView' instead of accessing the native context-menu package directly",
          },
          {
            name: 'zeego/context-menu',
            message:
              'Use the Rabby ContextMenuView boundary instead of importing an unscoped context-menu runtime',
          },
          {
            name: '@react-native-menu/menu',
            message:
              'Use the Rabby ContextMenuView boundary instead of importing an unscoped native menu runtime',
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
