const NATIVE_HELPERS_MODULE = '@/core/native/RNHelpers';
const NATIVE_SYNC_METHOD = 'startNativeTokenChains';
const EXECUTOR_FILE_SUFFIX = '/src/store/tokenChainSyncExecutor.ts';

function unwrap(node) {
  let current = node;
  while (
    current &&
    [
      'ChainExpression',
      'TSAsExpression',
      'TSNonNullExpression',
      'TSTypeAssertion',
    ].includes(current.type)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node) {
  if (!node || node.type !== 'MemberExpression') {
    return null;
  }
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  if (
    node.computed &&
    node.property.type === 'Literal' &&
    typeof node.property.value === 'string'
  ) {
    return node.property.value;
  }
  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Route native token-chain synchronization through the store executor.',
    },
    schema: [],
    messages: {
      directCall:
        'Call executeTokenChainSync instead of invoking RNHelpers.startNativeTokenChains directly.',
    },
  },
  create(context) {
    const nativeHelperNames = new Set();
    const nativeSyncFunctionNames = new Set();
    const filename = context.getFilename().replaceAll('\\', '/');
    const isExecutor = filename.endsWith(EXECUTOR_FILE_SUFFIX);

    return {
      ImportDeclaration(node) {
        if (node.source.value !== NATIVE_HELPERS_MODULE) {
          return;
        }
        node.specifiers.forEach(specifier => {
          if (specifier.type === 'ImportDefaultSpecifier') {
            nativeHelperNames.add(specifier.local.name);
          }
        });
      },
      VariableDeclarator(node) {
        const init = unwrap(node.init);
        if (
          !init ||
          init.type !== 'Identifier' ||
          !nativeHelperNames.has(init.name) ||
          node.id.type !== 'ObjectPattern'
        ) {
          return;
        }
        node.id.properties.forEach(property => {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === NATIVE_SYNC_METHOD &&
            property.value.type === 'Identifier'
          ) {
            nativeSyncFunctionNames.add(property.value.name);
          }
        });
      },
      CallExpression(node) {
        if (isExecutor) {
          return;
        }
        const callee = unwrap(node.callee);
        const isDirectMemberCall =
          callee?.type === 'MemberExpression' &&
          unwrap(callee.object)?.type === 'Identifier' &&
          nativeHelperNames.has(unwrap(callee.object).name) &&
          propertyName(callee) === NATIVE_SYNC_METHOD;
        const isDestructuredCall =
          callee?.type === 'Identifier' &&
          nativeSyncFunctionNames.has(callee.name);

        if (isDirectMemberCall || isDestructuredCall) {
          context.report({ node, messageId: 'directCall' });
        }
      },
    };
  },
};
