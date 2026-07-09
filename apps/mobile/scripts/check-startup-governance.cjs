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
