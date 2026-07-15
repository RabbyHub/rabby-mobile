#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');
const strict = process.argv.includes('--strict');
const startupTaskModulesPath = path.join(
  srcRoot,
  'startup',
  'startupTaskModules.ts',
);

const ignoredFilePatterns = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.d\.ts$/,
];

const startupSensitivePathPatterns = [
  /\/src\/core\//,
  /\/src\/hooks\//,
  /\/src\/store\//,
  /\/src\/perfs\//,
  /\/src\/setup-/,
  /\/src\/AppNavigation\.tsx$/,
];

const allowedRequirePatterns = [
  /require\(['"]@\/utils\/logger['"]\)/,
  /require\(['"]\.\/startupDiagnostics['"]\)/,
  /require\(['"]react-native-reanimated['"]\)/,
  /require\(['"]p-queue\/dist['"]\)/,
];

const serviceRuntimeImportBoundaryPatterns = [
  /\/src\/core\/services\//,
  /\/src\/core\/services2024\//,
  /\/src\/core\/serviceApi\//,
];

const coreServiceLoaderRegistrationFiles = new Set([
  'src/core/serviceApi/serviceLoaderCatalog.ts',
  'src/core/services/serviceRegistry.ts',
]);

const setupRuntimeStaticImportSources = new Set([
  './core/utils/androidTrace',
  './core/utils/startupScheduler',
  './core/utils/startupTaskManifest',
]);

const heavyStartupRuntimeModules = [
  '@noble/curves',
  '@rabby-wallet/rabby-swap',
  '@op-engineering/op-sqlite',
  'typeorm/browser',
];

function isCoreServiceModule(source) {
  return (
    source === '@/core/services' ||
    source.startsWith('@/core/services/') ||
    source === '@/core/services2024' ||
    source.startsWith('@/core/services2024/')
  );
}

function isAppDatabaseOrmModule(source) {
  return source === '@/databases/orm' || source === './orm';
}

function isAllowedServiceRuntimeImportFile(filePath) {
  return serviceRuntimeImportBoundaryPatterns.some(pattern =>
    pattern.test(filePath),
  );
}

function isAllowedDatabaseOrmImportFile(relPath) {
  return (
    relPath === 'src/databases/register.ts' ||
    relPath === 'src/databases/orm.ts'
  );
}

function isHeavyStartupRuntimeModule(source) {
  return heavyStartupRuntimeModules.some(
    moduleName => source === moduleName || source.startsWith(`${moduleName}/`),
  );
}

function isAllowedHeavyStartupImportFile(filePath) {
  return (
    /\/src\/core\/databases\//.test(filePath) ||
    /\/src\/databases\//.test(filePath) ||
    /\/src\/core\/services\//.test(filePath) ||
    /\/src\/core\/utils\/typeorm\.ts$/.test(filePath)
  );
}

function isTypeOnlyImportClause(clause) {
  const normalized = clause.trim();
  if (normalized.startsWith('type ')) {
    return true;
  }

  if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
    return false;
  }

  const body = normalized.slice(1, -1).trim();
  if (!body) {
    return false;
  }

  return body
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .every(part => part.startsWith('type '));
}

function isTypeImportExpression(source, index) {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const linePrefix = source.slice(lineStart, index);
  return /:\s*$/.test(linePrefix) || /\bextends\s*$/.test(linePrefix);
}

function checkCoreServiceRuntimeImports(filePath, relPath, source) {
  if (isAllowedServiceRuntimeImportFile(filePath)) {
    return;
  }

  const staticImportPattern = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = staticImportPattern.exec(source))) {
    const [, importClause, importSource] = match;
    if (!isCoreServiceModule(importSource)) {
      continue;
    }

    if (isTypeOnlyImportClause(importClause)) {
      continue;
    }

    errors.push(
      `${relPath}:${getLineNumber(
        source,
        match.index,
      )} runtime service imports must go through core/serviceApi; use import type for service types`,
    );
  }

  const sideEffectImportPattern = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectImportPattern.exec(source))) {
    const [, importSource] = match;
    if (isCoreServiceModule(importSource)) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} service side-effect imports are only allowed inside core service boundaries`,
      );
    }
  }

  const dynamicImportPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportPattern.exec(source))) {
    const [, importSource] = match;
    if (isTypeImportExpression(source, match.index)) {
      continue;
    }

    if (isCoreServiceModule(importSource)) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} dynamic service imports must go through core/serviceApi or a service loader`,
      );
    }
  }

  const requirePattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requirePattern.exec(source))) {
    const [, importSource] = match;
    if (isCoreServiceModule(importSource)) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} service requires must go through core/serviceApi or a service loader`,
      );
    }
  }
}

function checkDatabaseGovernanceImports(filePath, relPath, source) {
  const staticImportPattern = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = staticImportPattern.exec(source))) {
    const [, importClause, importSource] = match;
    if (
      isAppDatabaseOrmModule(importSource) &&
      !isAllowedDatabaseOrmImportFile(relPath)
    ) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} database orm must be loaded through databases/register and the app data-source registry`,
      );
    }

    if (
      startupSensitivePathPatterns.some(pattern => pattern.test(filePath)) &&
      isHeavyStartupRuntimeModule(importSource) &&
      !isAllowedHeavyStartupImportFile(filePath) &&
      !isTypeOnlyImportClause(importClause)
    ) {
      warnings.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} startup-sensitive heavy package import should be behind a startup task, service loader, or explicit route-level demand`,
      );
    }
  }

  const dynamicImportPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportPattern.exec(source))) {
    const [, importSource] = match;
    if (
      isAppDatabaseOrmModule(importSource) &&
      !isAllowedDatabaseOrmImportFile(relPath)
    ) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} database orm dynamic imports must be isolated in databases/register`,
      );
    }
  }

  const requirePattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requirePattern.exec(source))) {
    const [, importSource] = match;
    if (
      isAppDatabaseOrmModule(importSource) &&
      !isAllowedDatabaseOrmImportFile(relPath)
    ) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} database orm requires must be isolated in databases/register`,
      );
    }
  }
}

function checkCoreServiceLoaderRegistration(relPath, source) {
  if (
    source.includes('registerCoreServiceLoader(') &&
    !coreServiceLoaderRegistrationFiles.has(relPath)
  ) {
    errors.push(
      `${relPath} core service loaders must be registered in src/core/serviceApi/serviceLoaderCatalog.ts`,
    );
  }
}

function checkSetupRuntimeImports(relPath, source) {
  const staticImportPattern = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = staticImportPattern.exec(source))) {
    const [, importClause, importSource] = match;
    if (isTypeOnlyImportClause(importClause)) {
      continue;
    }

    if (
      relPath === 'src/setup-app-before-render.runtime.ts' &&
      !setupRuntimeStaticImportSources.has(importSource)
    ) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} setup runtime must dynamically import deferred task owners`,
      );
    }

    if (importSource.includes('/startup/deferredTasks/')) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          match.index,
        )} deferred startup task owners must not be statically imported`,
      );
    }
  }
}

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, output);
      continue;
    }

    if (/\.[jt]sx?$/.test(entry.name)) {
      output.push(fullPath);
    }
  }

  return output;
}

function isIgnored(filePath) {
  return ignoredFilePatterns.some(pattern => pattern.test(filePath));
}

function findMatchingParen(source, openParenIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === '*' && nextChar === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && nextChar === '/') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

const errors = [];
const warnings = [];
const startupTaskCallFiles = new Set();

function readStartupTaskModuleFiles() {
  if (!fs.existsSync(startupTaskModulesPath)) {
    errors.push(
      'src/startup/startupTaskModules.ts is required to govern startup task registration files',
    );
    return new Set();
  }

  const manifestSource = fs.readFileSync(startupTaskModulesPath, 'utf8');
  const files = new Set();
  const fileLiteralPattern = /['"](src\/[^'"]+\.[jt]sx?)['"]/g;
  let match;
  while ((match = fileLiteralPattern.exec(manifestSource))) {
    files.add(match[1]);
  }

  return files;
}

function readStartupTaskModuleGroupFiles(groupName) {
  if (!fs.existsSync(startupTaskModulesPath)) {
    return new Set();
  }

  const manifestSource = fs.readFileSync(startupTaskModulesPath, 'utf8');
  const groupPattern = new RegExp(
    `export const ${groupName} = \\[([\\s\\S]*?)\\] as const`,
  );
  const groupMatch = manifestSource.match(groupPattern);
  if (!groupMatch) {
    errors.push(`src/startup/startupTaskModules.ts is missing ${groupName}`);
    return new Set();
  }

  const files = new Set();
  const fileLiteralPattern = /['"](src\/[^'"]+\.[jt]sx?)['"]/g;
  let match;
  while ((match = fileLiteralPattern.exec(groupMatch[1]))) {
    files.add(match[1]);
  }
  return files;
}

const governedStartupTaskModuleFiles = readStartupTaskModuleFiles();
const launchStartupTaskModuleFiles = readStartupTaskModuleGroupFiles(
  'STARTUP_LAUNCH_TASK_MODULE_FILES',
);

if (!launchStartupTaskModuleFiles.has('src/startup/launchTasks.ts')) {
  errors.push(
    'STARTUP_LAUNCH_TASK_MODULE_FILES must include src/startup/launchTasks.ts',
  );
}

for (const moduleFile of launchStartupTaskModuleFiles) {
  if (!moduleFile.startsWith('src/startup/')) {
    errors.push(
      `${moduleFile} launch work must be registered from src/startup instead of an incidental owner import`,
    );
  }
}

for (const filePath of walk(srcRoot)) {
  if (isIgnored(filePath)) {
    continue;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(appRoot, filePath);
  let searchIndex = 0;

  checkCoreServiceRuntimeImports(filePath, relPath, source);
  checkDatabaseGovernanceImports(filePath, relPath, source);
  checkCoreServiceLoaderRegistration(relPath, source);
  checkSetupRuntimeImports(relPath, source);

  while (true) {
    const callIndex = source.indexOf('runStartupTask(', searchIndex);
    if (callIndex === -1) {
      break;
    }

    const before = source.slice(Math.max(0, callIndex - 4), callIndex);
    if (/\/\/\s*$/.test(before)) {
      searchIndex = callIndex + 'runStartupTask('.length;
      continue;
    }

    const openParenIndex = callIndex + 'runStartupTask'.length;
    const closeParenIndex = findMatchingParen(source, openParenIndex);
    if (closeParenIndex === -1) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          callIndex,
        )} cannot parse runStartupTask call`,
      );
      break;
    }

    const callSource = source.slice(callIndex, closeParenIndex + 1);
    startupTaskCallFiles.add(relPath);

    if (!governedStartupTaskModuleFiles.has(relPath)) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          callIndex,
        )} runStartupTask files must be listed in src/startup/startupTaskModules.ts`,
      );
    }

    if (!/STARTUP_TASKS(?:\.|\[)/.test(callSource)) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          callIndex,
        )} runStartupTask must use STARTUP_TASKS metadata`,
      );
    }

    searchIndex = closeParenIndex + 1;
  }

  if (
    startupSensitivePathPatterns.some(pattern => pattern.test(filePath)) &&
    source.includes('require(')
  ) {
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('require(')) {
        return;
      }

      if (allowedRequirePatterns.some(pattern => pattern.test(line))) {
        return;
      }

      warnings.push(
        `${relPath}:${
          index + 1
        } startup-sensitive require should be justified or converted to import()/service registry`,
      );
    });
  }
}

for (const moduleFile of governedStartupTaskModuleFiles) {
  const modulePath = path.join(appRoot, moduleFile);
  if (!fs.existsSync(modulePath)) {
    errors.push(
      `src/startup/startupTaskModules.ts lists missing file: ${moduleFile}`,
    );
    continue;
  }

  if (!startupTaskCallFiles.has(moduleFile)) {
    warnings.push(
      `${moduleFile} is listed in startupTaskModules but has no active runStartupTask call`,
    );
  }
}

if (warnings.length) {
  console.warn('[startup-governance] warnings');
  warnings.forEach(warning => console.warn(`  - ${warning}`));
}

if (errors.length) {
  console.error('[startup-governance] errors');
  errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

if (strict && warnings.length) {
  process.exit(1);
}

console.log(
  `[startup-governance] ok (${warnings.length} warning${
    warnings.length === 1 ? '' : 's'
  })`,
);
