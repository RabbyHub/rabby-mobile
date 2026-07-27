const contractCatalog = require('../src/core/serviceApi/serviceContractCatalog.json');

const DEFERRED_SERVICE_APIS = new Map(
  Object.entries(contractCatalog.services)
    .filter(([, definition]) => definition.apiModule && definition.apiExport)
    .map(([serviceName, definition]) => [
      definition.apiModule,
      {
        apiExport: definition.apiExport,
        serviceName,
      },
    ]),
);

const FUNCTION_NODES = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
]);

function getDeferredServiceDefinition(importSource) {
  if (typeof importSource !== 'string') {
    return null;
  }

  const match = importSource.match(/(?:^|\/)core\/serviceApi\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return DEFERRED_SERVICE_APIS.get(match[1]) || null;
}

function matchesMethodPrefix(method, prefix) {
  if (method === prefix) {
    return true;
  }

  if (!method.startsWith(prefix)) {
    return false;
  }

  const nextCharacter = method[prefix.length];
  return nextCharacter === '_' || /[A-Z]/.test(nextCharacter || '');
}

function getMethodSemantic(serviceName, method) {
  const overridden = contractCatalog.methodOverrides[serviceName]?.[method];
  if (overridden) {
    return overridden;
  }

  for (const semantic of ['subscription', 'query', 'command']) {
    if (
      contractCatalog.methodPrefixes[semantic].some(prefix =>
        matchesMethodPrefix(method, prefix),
      )
    ) {
      return semantic;
    }
  }

  return null;
}

function getPropertyName(memberExpression) {
  if (
    !memberExpression.computed &&
    memberExpression.property.type === 'Identifier'
  ) {
    return memberExpression.property.name;
  }

  if (
    memberExpression.computed &&
    memberExpression.property.type === 'Literal' &&
    typeof memberExpression.property.value === 'string'
  ) {
    return memberExpression.property.value;
  }

  return null;
}

function isPromiseMethodCall(node, methodName) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    getPropertyName(node.callee) === methodName
  );
}

function hasRejectionHandler(argument) {
  return Boolean(
    argument &&
      !(argument.type === 'Identifier' && argument.name === 'undefined') &&
      !(argument.type === 'Literal' && argument.value == null),
  );
}

function isPromiseStaticCall(node, methodNames) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'Promise' &&
    methodNames.has(getPropertyName(node.callee))
  );
}

function isConsumedOrHandled(serviceCall) {
  let current = serviceCall;

  while (current.parent) {
    const parent = current.parent;

    if (
      parent.type === 'AwaitExpression' ||
      parent.type === 'ReturnStatement' ||
      parent.type === 'YieldExpression'
    ) {
      return true;
    }

    if (
      parent.type === 'VariableDeclarator' ||
      parent.type === 'AssignmentExpression' ||
      parent.type === 'PropertyDefinition'
    ) {
      return true;
    }

    if (
      parent.type === 'CallExpression' &&
      parent.callee === current &&
      isPromiseMethodCall(parent, 'catch') &&
      hasRejectionHandler(parent.arguments[0])
    ) {
      return true;
    }

    if (
      parent.type === 'CallExpression' &&
      parent.callee === current &&
      isPromiseMethodCall(parent, 'then') &&
      hasRejectionHandler(parent.arguments[1])
    ) {
      return true;
    }

    if (
      parent.type === 'CallExpression' &&
      parent.arguments.includes(current)
    ) {
      if (isPromiseStaticCall(parent, new Set(['allSettled']))) {
        return true;
      }

      if (
        !isPromiseStaticCall(
          parent,
          new Set(['all', 'any', 'race', 'resolve', 'reject']),
        )
      ) {
        // Ownership is transferred to another API. Its contract determines how
        // the Promise is consumed, which this narrow rule cannot infer.
        return true;
      }
    }

    if (
      FUNCTION_NODES.has(parent.type) &&
      parent.type === 'ArrowFunctionExpression' &&
      parent.body === current
    ) {
      return true;
    }

    if (FUNCTION_NODES.has(parent.type)) {
      return false;
    }

    if (parent.type === 'ExpressionStatement') {
      return false;
    }

    current = parent;
  }

  return true;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require discarded deferred service API calls to handle Promise rejection.',
    },
    schema: [],
    messages: {
      floatingCall:
        'Deferred service API calls must be awaited, returned, transferred to an explicit consumer, or handle rejection before being discarded.',
      unclassifiedMethod:
        'Deferred service API method "{{serviceName}}.{{method}}" has no query, command, or subscription semantic in serviceContractCatalog.json.',
    },
  },
  create(context) {
    const deferredServiceBindings = new Map();

    return {
      ImportDeclaration(node) {
        const definition = getDeferredServiceDefinition(node.source.value);
        if (!definition || node.importKind === 'type') {
          return;
        }

        node.specifiers.forEach(specifier => {
          if (
            specifier.type !== 'ImportSpecifier' ||
            specifier.importKind === 'type' ||
            specifier.imported.name !== definition.apiExport
          ) {
            return;
          }

          deferredServiceBindings.set(
            specifier.local.name,
            definition.serviceName,
          );
        });
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          !deferredServiceBindings.has(node.callee.object.name)
        ) {
          return;
        }

        const serviceName = deferredServiceBindings.get(
          node.callee.object.name,
        );
        const method = getPropertyName(node.callee);
        if (!method || !getMethodSemantic(serviceName, method)) {
          context.report({
            node,
            messageId: 'unclassifiedMethod',
            data: {
              serviceName,
              method: method || '<dynamic>',
            },
          });
          return;
        }

        if (!isConsumedOrHandled(node)) {
          context.report({
            node,
            messageId: 'floatingCall',
          });
        }
      },
    };
  },
};
