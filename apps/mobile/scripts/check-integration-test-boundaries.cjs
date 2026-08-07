const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(mobileRoot, '../..');
const sourceRoot = path.join(mobileRoot, 'src');
const integrationTestPattern = /\.integration\.test\.[jt]sx?$/;
const forbiddenModuleMethods = new Set([
  'doMock',
  'mock',
  'requireMock',
  'setMock',
  'unstable_mockModule',
]);
const forbiddenIsolationMethods = new Set([
  'isolateModules',
  'isolateModulesAsync',
  'resetModules',
]);

function collectFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (integrationTestPattern.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectWorkspacePackageNames() {
  const names = new Set();

  for (const workspaceDirectory of ['apps', 'packages']) {
    const workspaceRoot = path.join(repositoryRoot, workspaceDirectory);
    if (!fs.existsSync(workspaceRoot)) {
      continue;
    }

    for (const entry of fs.readdirSync(workspaceRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(workspaceRoot, entry.name, 'package.json');
      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (typeof manifest.name === 'string') {
        names.add(manifest.name);
      }
    }
  }

  return names;
}

function isWithin(parent, candidate) {
  const relativePath = path.relative(parent, candidate);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..')
  );
}

function isInternalModule(moduleName, testFile, workspacePackageNames) {
  if (moduleName.startsWith('@/')) {
    return true;
  }

  if (workspacePackageNames.has(moduleName)) {
    return true;
  }

  if (moduleName.startsWith('.')) {
    return isWithin(
      repositoryRoot,
      path.resolve(path.dirname(testFile), moduleName),
    );
  }

  return false;
}

function getJestMethod(node) {
  if (!ts.isCallExpression(node)) {
    return undefined;
  }

  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'jest'
  ) {
    return node.expression.name.text;
  }

  if (
    ts.isElementAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'jest' &&
    node.expression.argumentExpression &&
    ts.isStringLiteralLike(node.expression.argumentExpression)
  ) {
    return node.expression.argumentExpression.text;
  }

  return undefined;
}

function formatFailure(sourceFile, node, message) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const relativeFile = path.relative(repositoryRoot, sourceFile.fileName);
  return `${relativeFile}:${position.line + 1}:${
    position.character + 1
  } ${message}`;
}

const testFiles = collectFiles(sourceRoot);
if (testFiles.length === 0) {
  console.error(
    'No *.integration.test.* files were found under apps/mobile/src.',
  );
  process.exit(1);
}

const workspacePackageNames = collectWorkspacePackageNames();
const failures = [];

for (const testFile of testFiles) {
  const sourceText = fs.readFileSync(testFile, 'utf8');
  const scriptKind = testFile.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : testFile.endsWith('.ts')
    ? ts.ScriptKind.TS
    : testFile.endsWith('.jsx')
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(
    testFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  function visit(node) {
    const method = getJestMethod(node);
    if (method && forbiddenIsolationMethods.has(method)) {
      failures.push(
        formatFailure(
          sourceFile,
          node,
          `jest.${method}() is not allowed in integration tests because it creates alternate module or singleton lifecycles.`,
        ),
      );
    }

    if (method && forbiddenModuleMethods.has(method)) {
      const moduleArgument = node.arguments[0];
      if (!moduleArgument || !ts.isStringLiteralLike(moduleArgument)) {
        failures.push(
          formatFailure(
            sourceFile,
            node,
            `jest.${method}() must use a string literal so CI can verify the mocked boundary.`,
          ),
        );
      } else if (
        isInternalModule(moduleArgument.text, testFile, workspacePackageNames)
      ) {
        failures.push(
          formatFailure(
            sourceFile,
            node,
            `jest.${method}('${moduleArgument.text}') mocks repository code; integration tests must compose real internal modules.`,
          ),
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (failures.length > 0) {
  console.error('Integration test boundary violations:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Validated ${testFiles.length} integration test files: repository modules remain real.`,
);
