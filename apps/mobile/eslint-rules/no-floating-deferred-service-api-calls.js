const DEFERRED_SERVICE_APIS = new Map([
  ['autoConnect', 'autoConnectServiceApi'],
  ['bridge', 'bridgeServiceApi'],
  ['browser', 'browserServiceApi'],
  ['contact', 'contactServiceApi'],
  ['currency', 'currencyServiceApi'],
  ['customRPC', 'customRPCServiceApi'],
  ['customTestnet', 'customTestnetServiceApi'],
  ['dapp', 'dappServiceApi'],
  ['gasAccount', 'gasAccountServiceApi'],
  ['hdKeyring', 'hdKeyringServiceApi'],
  ['keyring', 'keyringServiceApi'],
  ['lending', 'lendingServiceApi'],
  ['metamaskMode', 'metamaskModeServiceApi'],
  ['notification', 'notificationServiceApi'],
  ['offlineChain', 'offlineChainServiceApi'],
  ['perps', 'perpsServiceApi'],
  ['preference', 'preferenceServiceApi'],
  ['rabbyPoints', 'rabbyPointsServiceApi'],
  ['securityEngine', 'securityEngineServiceApi'],
  ['session', 'sessionServiceApi'],
  ['swap', 'swapServiceApi'],
  ['syncChain', 'syncChainServiceApi'],
  ['transactionBroadcastWatcher', 'transactionBroadcastWatcherServiceApi'],
  ['transactionHistory', 'transactionHistoryServiceApi'],
  ['transactionWatcher', 'transactionWatcherServiceApi'],
  ['whitelist', 'whitelistServiceApi'],
]);

const FUNCTION_NODES = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
]);

function getDeferredServiceApiName(importSource) {
  if (typeof importSource !== 'string') {
    return null;
  }

  const match = importSource.match(/(?:^|\/)core\/serviceApi\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return DEFERRED_SERVICE_APIS.get(match[1]) || null;
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
    },
  },
  create(context) {
    const deferredServiceBindings = new Set();

    return {
      ImportDeclaration(node) {
        const expectedApiName = getDeferredServiceApiName(node.source.value);
        if (!expectedApiName || node.importKind === 'type') {
          return;
        }

        node.specifiers.forEach(specifier => {
          if (
            specifier.type !== 'ImportSpecifier' ||
            specifier.importKind === 'type' ||
            specifier.imported.name !== expectedApiName
          ) {
            return;
          }

          deferredServiceBindings.add(specifier.local.name);
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
