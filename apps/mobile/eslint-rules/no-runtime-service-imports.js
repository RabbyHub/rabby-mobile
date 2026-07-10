const path = require('path');

const srcRoot = path.resolve(__dirname, '../src');
const servicesRoot = path.join(srcRoot, 'core/services');
const serviceApiRoot = path.join(srcRoot, 'core/serviceApi');

function normalizePath(filePath) {
  return path.resolve(filePath);
}

function isSameOrInside(filePath, dirPath) {
  const relative = path.relative(dirPath, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isAllowedFile(filePath) {
  if (!filePath || filePath.startsWith('<')) {
    return false;
  }

  const normalized = normalizePath(filePath);
  return (
    isSameOrInside(normalized, servicesRoot) ||
    isSameOrInside(normalized, serviceApiRoot)
  );
}

function resolveImportSource(importSource, filePath) {
  if (typeof importSource !== 'string') {
    return null;
  }

  if (importSource === '@/core/services' || importSource.startsWith('@/core/services/')) {
    return path.join(srcRoot, importSource.slice('@/'.length));
  }

  if (importSource.startsWith('@/')) {
    return path.join(srcRoot, importSource.slice('@/'.length));
  }

  if (importSource.startsWith('.')) {
    return path.resolve(path.dirname(filePath), importSource);
  }

  return null;
}

function isCoreServiceSource(importSource, filePath) {
  const resolved = resolveImportSource(importSource, filePath);
  if (!resolved) {
    return false;
  }

  return isSameOrInside(resolved, servicesRoot);
}

function getStaticSourceValue(sourceNode) {
  if (!sourceNode) {
    return null;
  }

  if (typeof sourceNode.value === 'string') {
    return sourceNode.value;
  }

  return null;
}

function isTypeOnlyImport(node) {
  if (node.importKind === 'type') {
    return true;
  }

  return (
    node.specifiers.length > 0 &&
    node.specifiers.every(specifier => specifier.importKind === 'type')
  );
}

function isTypeOnlyExport(node) {
  if (node.exportKind === 'type') {
    return true;
  }

  return (
    node.specifiers?.length > 0 &&
    node.specifiers.every(specifier => specifier.exportKind === 'type')
  );
}

function reportRuntimeServiceImport(context, node, importSource) {
  context.report({
    node,
    message:
      'Do not access core services directly at runtime from "{{importSource}}". Use @/core/serviceApi contracts.',
    data: {
      importSource,
    },
  });
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow runtime imports of core services outside service internals and service API contracts.',
    },
    schema: [],
  },
  create(context) {
    const filePath = context.getFilename();
    if (isAllowedFile(filePath)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const importSource = getStaticSourceValue(node.source);
        if (
          importSource &&
          isCoreServiceSource(importSource, filePath) &&
          !isTypeOnlyImport(node)
        ) {
          reportRuntimeServiceImport(context, node.source, importSource);
        }
      },
      ExportNamedDeclaration(node) {
        const importSource = getStaticSourceValue(node.source);
        if (
          importSource &&
          isCoreServiceSource(importSource, filePath) &&
          !isTypeOnlyExport(node)
        ) {
          reportRuntimeServiceImport(context, node.source, importSource);
        }
      },
      ExportAllDeclaration(node) {
        const importSource = getStaticSourceValue(node.source);
        if (
          importSource &&
          isCoreServiceSource(importSource, filePath) &&
          node.exportKind !== 'type'
        ) {
          reportRuntimeServiceImport(context, node.source, importSource);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'require' ||
          !node.arguments.length
        ) {
          return;
        }

        const importSource = getStaticSourceValue(node.arguments[0]);
        if (importSource && isCoreServiceSource(importSource, filePath)) {
          reportRuntimeServiceImport(context, node.arguments[0], importSource);
        }
      },
      ImportExpression(node) {
        const importSource = getStaticSourceValue(node.source);
        if (importSource && isCoreServiceSource(importSource, filePath)) {
          reportRuntimeServiceImport(context, node.source, importSource);
        }
      },
    };
  },
};
