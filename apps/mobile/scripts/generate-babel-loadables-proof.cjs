#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const generatedLoadableAliases = require('./loadables-aliases.generated.cjs');

const APP_DIR = path.resolve(__dirname, '..');
const GENERATED_DIR = path.resolve(APP_DIR, 'perf/generated-babel-loadables');
const LOADABLES_ALIAS_PREFIX = '@/perfs/loadables/';
const PROOF_FILENAME = path.join(
  APP_DIR,
  'src/__perf__/babel-loadables-proof.ts',
);

function ensurePosix(input) {
  return input.split(path.sep).join('/');
}

function buildRunId(generatedAt) {
  return generatedAt.replace(/[:.]/g, '-');
}

function normalizeModuleSpecifier(input) {
  const normalized = ensurePosix(input);
  if (
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    normalized.startsWith('/')
  ) {
    return normalized;
  }
  return `./${normalized}`;
}

function createProofSource(aliasKey) {
  return `import * as LoadableModule from '${aliasKey}';\nexport default LoadableModule;\n`;
}

function transformAliasImport({ aliasKey, mode }) {
  const result = babel.transformSync(createProofSource(aliasKey), {
    cwd: APP_DIR,
    filename: PROOF_FILENAME,
    configFile: path.join(APP_DIR, 'babel.config.js'),
    babelrc: false,
    sourceType: 'module',
    caller: {
      name: 'perf-babel-loadables',
      dev: mode === 'dev',
    },
  });

  const transformedCode = result?.code || '';
  const requireMatch = transformedCode.match(/require\(["']([^"']+)["']\)/);

  if (!requireMatch) {
    throw new Error(
      `Transformed code for ${aliasKey} (${mode}) does not contain a resolvable require(...) call`,
    );
  }

  return {
    transformedCode,
    resolvedSpecifier: requireMatch[1],
  };
}

function getExpectedResolvedSpecifier({ aliasTarget }) {
  const fromDir = path.dirname(PROOF_FILENAME);
  const targetAbs = path.resolve(APP_DIR, aliasTarget);
  const relativePath = path.relative(fromDir, targetAbs);
  return normalizeModuleSpecifier(relativePath);
}

function summarizeMode(mode) {
  const expectedAliases = Object.fromEntries(
    Object.entries(generatedLoadableAliases[mode] || {}).sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  );
  const checks = Object.entries(expectedAliases)
    .filter(([aliasKey]) => aliasKey.startsWith(LOADABLES_ALIAS_PREFIX))
    .map(([aliasKey, aliasTarget]) => {
      const { transformedCode, resolvedSpecifier } = transformAliasImport({
        aliasKey,
        mode,
      });
      const expectedResolvedSpecifier = getExpectedResolvedSpecifier({
        aliasTarget,
      });

      return {
        aliasKey,
        aliasTarget,
        expectedResolvedSpecifier,
        resolvedSpecifier,
        hasExpectedSuffix: resolvedSpecifier.endsWith(`.${mode}`),
        matchesExpectedResolvedSpecifier:
          resolvedSpecifier === expectedResolvedSpecifier,
        transformedCode,
      };
    });

  return {
    mode,
    aliasCount: checks.length,
    allHaveExpectedSuffix: checks.every(item => item.hasExpectedSuffix),
    allMatchExpectedResolvedSpecifier: checks.every(
      item => item.matchesExpectedResolvedSpecifier,
    ),
    checks,
  };
}

function main() {
  const generatedAt = new Date().toISOString();
  const runId = buildRunId(generatedAt);
  const outputDir = path.join(GENERATED_DIR, runId);

  fs.mkdirSync(outputDir, { recursive: true });

  const devSummary = summarizeMode('dev');
  const prodSummary = summarizeMode('prod');

  const summary = {
    generatedAt,
    runId,
    outputDir: ensurePosix(path.relative(APP_DIR, outputDir)),
    dev: {
      aliasCount: devSummary.aliasCount,
      allHaveExpectedSuffix: devSummary.allHaveExpectedSuffix,
      allMatchExpectedResolvedSpecifier:
        devSummary.allMatchExpectedResolvedSpecifier,
    },
    prod: {
      aliasCount: prodSummary.aliasCount,
      allHaveExpectedSuffix: prodSummary.allHaveExpectedSuffix,
      allMatchExpectedResolvedSpecifier:
        prodSummary.allMatchExpectedResolvedSpecifier,
    },
  };

  const devPath = path.join(outputDir, 'babel-loadables.dev.json');
  const prodPath = path.join(outputDir, 'babel-loadables.prod.json');
  const summaryPath = path.join(outputDir, 'summary.json');

  fs.writeFileSync(devPath, `${JSON.stringify(devSummary, null, 2)}\n`);
  fs.writeFileSync(prodPath, `${JSON.stringify(prodSummary, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(
    `Babel loadables proof written to ${path.relative(APP_DIR, outputDir)}`,
  );
  console.log(`- dev: ${path.relative(APP_DIR, devPath)}`);
  console.log(`- prod: ${path.relative(APP_DIR, prodPath)}`);
  console.log(`- summary: ${path.relative(APP_DIR, summaryPath)}`);

  if (
    !devSummary.allHaveExpectedSuffix ||
    !devSummary.allMatchExpectedResolvedSpecifier ||
    !prodSummary.allHaveExpectedSuffix ||
    !prodSummary.allMatchExpectedResolvedSpecifier
  ) {
    process.exitCode = 1;
  }
}

main();
