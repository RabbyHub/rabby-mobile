const PERSIST_STORE_PACKAGE = '@rabby-wallet/persist-store';
const MUTATING_METHODS = new Set([
  'add',
  'clear',
  'copyWithin',
  'delete',
  'fill',
  'pop',
  'push',
  'reverse',
  'set',
  'shift',
  'sort',
  'splice',
  'unshift',
]);

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

function isStoreRoot(node) {
  const current = unwrap(node);
  return Boolean(
    current &&
      current.type === 'MemberExpression' &&
      unwrap(current.object)?.type === 'ThisExpression' &&
      propertyName(current) === 'store',
  );
}

function isStorePath(node) {
  const current = unwrap(node);
  if (isStoreRoot(current)) {
    return true;
  }

  return Boolean(
    current &&
      current.type === 'MemberExpression' &&
      isStorePath(current.object),
  );
}

function containsStoreMember(node) {
  const current = unwrap(node);
  if (!current) {
    return false;
  }

  if (current.type === 'MemberExpression') {
    return (
      propertyName(current) === 'store' || containsStoreMember(current.object)
    );
  }

  if (current.type === 'CallExpression') {
    return containsStoreMember(current.callee);
  }

  return false;
}

function isPersistStoreImport(node) {
  return (
    node.type === 'ImportDeclaration' &&
    node.source.value === PERSIST_STORE_PACKAGE &&
    node.importKind !== 'type' &&
    node.specifiers.some(specifier => specifier.importKind !== 'type')
  );
}

function isAnyOrUnknownAssertion(node) {
  return (
    (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') &&
    (node.typeAnnotation.type === 'TSAnyKeyword' ||
      node.typeAnnotation.type === 'TSUnknownKeyword')
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require persistent store snapshots to be updated through mutateStore transactions.',
    },
    schema: [],
    messages: {
      directMutation:
        'Persistent store snapshots are immutable. Use mutateStore(draft => ...) instead.',
      unsafeAssertion:
        'Do not bypass persistent store immutability with an any/unknown assertion.',
    },
  },
  create(context) {
    let usesPersistStore = false;

    function reportMutation(node) {
      if (usesPersistStore && isStorePath(node)) {
        context.report({ node, messageId: 'directMutation' });
      }
    }

    return {
      ImportDeclaration(node) {
        if (isPersistStoreImport(node)) {
          usesPersistStore = true;
        }
      },
      AssignmentExpression(node) {
        reportMutation(node.left);
      },
      UpdateExpression(node) {
        reportMutation(node.argument);
      },
      UnaryExpression(node) {
        if (node.operator === 'delete') {
          reportMutation(node.argument);
        }
      },
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (
          !usesPersistStore ||
          !callee ||
          callee.type !== 'MemberExpression' ||
          !MUTATING_METHODS.has(propertyName(callee)) ||
          !isStorePath(callee.object)
        ) {
          return;
        }

        context.report({ node, messageId: 'directMutation' });
      },
      TSAsExpression(node) {
        if (
          isAnyOrUnknownAssertion(node) &&
          containsStoreMember(node.expression)
        ) {
          context.report({ node, messageId: 'unsafeAssertion' });
        }
      },
      TSTypeAssertion(node) {
        if (
          isAnyOrUnknownAssertion(node) &&
          containsStoreMember(node.expression)
        ) {
          context.report({ node, messageId: 'unsafeAssertion' });
        }
      },
    };
  },
};
