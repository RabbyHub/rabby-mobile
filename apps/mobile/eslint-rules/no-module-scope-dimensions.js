/**
 * Reject layout-size reads at module scope.
 *
 * `getDimensionsSnapshot()` (and a direct `Dimensions.get()`) return whatever
 * the window measured when the module was first evaluated. On the iPhone Duo
 * outer screen that is the native 466pt width, not the usable 382pt the app
 * lays out in, and it never updates on a fold, rotation or split resize.
 * Read the value where it is used instead: `useWindowDimensions()` in render,
 * the snapshot inside a style factory or handler, or `svsLayout` in a worklet.
 */

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

function isInsideFunction(node) {
  let parent = node.parent;
  while (parent) {
    if (FUNCTION_TYPES.has(parent.type)) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function isSnapshotCall(callee) {
  if (callee.type === 'Identifier' && callee.name === 'getDimensionsSnapshot') {
    return true;
  }
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Dimensions' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'get'
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow reading window dimensions at module scope (frozen value).',
    },
    messages: {
      moduleScope:
        'Reads window dimensions at module scope and freezes the first value. Move it into render (useWindowDimensions), a style factory, a handler, or read svsLayout inside a worklet.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isSnapshotCall(node.callee) || isInsideFunction(node)) {
          return;
        }
        context.report({ node, messageId: 'moduleScope' });
      },
    };
  },
};
