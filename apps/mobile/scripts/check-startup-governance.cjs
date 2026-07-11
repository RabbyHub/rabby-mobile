#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');
const strict = process.argv.includes('--strict');

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

function isCoreServiceModule(source) {
  return (
    source === '@/core/services' ||
    source.startsWith('@/core/services/') ||
    source === '@/core/services2024' ||
    source.startsWith('@/core/services2024/')
  );
}

function isAllowedServiceRuntimeImportFile(filePath) {
  return serviceRuntimeImportBoundaryPatterns.some(pattern =>
    pattern.test(filePath),
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

for (const filePath of walk(srcRoot)) {
  if (isIgnored(filePath)) {
    continue;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(appRoot, filePath);
  let searchIndex = 0;

  checkCoreServiceRuntimeImports(filePath, relPath, source);

  while (true) {
    const callIndex = source.indexOf('runIIFEFunc(', searchIndex);
    if (callIndex === -1) {
      break;
    }

    const before = source.slice(Math.max(0, callIndex - 4), callIndex);
    if (/\/\/\s*$/.test(before)) {
      searchIndex = callIndex + 'runIIFEFunc('.length;
      continue;
    }

    const openParenIndex = callIndex + 'runIIFEFunc'.length;
    const closeParenIndex = findMatchingParen(source, openParenIndex);
    if (closeParenIndex === -1) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          callIndex,
        )} cannot parse runIIFEFunc call`,
      );
      break;
    }

    const callSource = source.slice(callIndex, closeParenIndex + 1);
    if (!callSource.includes('STARTUP_TASKS.')) {
      errors.push(
        `${relPath}:${getLineNumber(
          source,
          callIndex,
        )} runIIFEFunc must use STARTUP_TASKS metadata`,
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
