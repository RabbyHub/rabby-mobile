/**
 * Reject installing or swapping a navigation header from an effect.
 *
 * `setNavigationOptions({ header | headerTitle | title | headerLeft })` runs
 * after the screen mounted, which means the route starts with one header type
 * (usually the native one) and switches mid-push. On iOS that animates the old
 * header out as a duplicated copy — the "header flies up" defect — and it also
 * breaks the first-frame contract on the Duo outer screen, where the header is
 * a JS replica.
 *
 * Declare the header on the route instead:
 *
 * ```tsx
 * options={({ route }) => mergeScreenOptions({
 *   header: renderAppStackHeader(() => ({ title: t('…') })),
 * })}
 * ```
 *
 * `headerRight` stays allowed: updating a trailing action does not change the
 * header type or its layout.
 *
 * Migration: files that still need the old pattern are listed in the rule's
 * `allowFiles` option (`.eslintrc.js`). Shrink that list as each screen moves
 * to a route-level header; do not add new entries.
 */

const HEADER_KEYS = new Set([
  'header',
  'headerTitle',
  'title',
  'headerLeft',
  'unstable_headerLeftItems',
]);

function isSetNavigationOptionsCall(node) {
  if (node.type !== 'CallExpression') {
    return false;
  }

  const { callee } = node;

  if (callee.type === 'Identifier') {
    return callee.name === 'setNavigationOptions';
  }

  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name === 'setOptions';
  }

  return false;
}

function collectHeaderObjects(node) {
  if (!node) {
    return [];
  }

  if (node.type === 'ObjectExpression') {
    return [node];
  }

  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'Object' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'assign'
  ) {
    return node.arguments.filter(
      argument => argument.type === 'ObjectExpression',
    );
  }

  return [];
}

function propertyName(property) {
  if (property.type !== 'Property') {
    return null;
  }

  if (!property.computed && property.key.type === 'Identifier') {
    return property.key.name;
  }

  if (property.key.type === 'Literal') {
    return String(property.key.value);
  }

  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow changing the navigation header type after mount (use a route-level header).',
    },
    messages: {
      dynamicHeader:
        'Do not install "{{key}}" from an effect: it swaps the header type after mount and makes iOS animate a duplicated header out. Declare the header on the route instead (header: renderAppStackHeader(...)).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowFiles: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {};
    const allowFiles = new Set(
      (options.allowFiles || []).map(file => file.replace(/\\/g, '/')),
    );
    const filename = (context.getFilename() || '').replace(/\\/g, '/');
    const isAllowed = [...allowFiles].some(file => filename.endsWith(file));

    if (isAllowed) {
      return {};
    }

    return {
      CallExpression(node) {
        if (!isSetNavigationOptionsCall(node)) {
          return;
        }

        const objects = collectHeaderObjects(node.arguments[0]);

        objects.forEach(objectExpression => {
          objectExpression.properties.forEach(property => {
            const name = propertyName(property);
            if (!name || !HEADER_KEYS.has(name)) {
              return;
            }

            context.report({
              node: property.key || property,
              messageId: 'dynamicHeader',
              data: { key: name },
            });
          });
        });
      },
    };
  },
};
