#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const madge = require('madge');

const APP_DIR = path.resolve(__dirname, '..');
const PERF_DIR = __dirname;
const GENERATED_DIR = path.join(PERF_DIR, 'generated');
const DEFAULT_ENTRY = 'index.js';
const DEFAULT_FOCUS_NODES = [
  'index.js',
  'src/App.tsx',
  'src/AppNavigation.tsx',
  'src/screens/Navigators/index.eager.ts',
  'src/screens/Navigators/rootNavigator.tsx',
];

function ensurePosix(input) {
  return input.split(path.sep).join('/');
}

function normalizeEntry(input) {
  const absolute = path.resolve(APP_DIR, input || DEFAULT_ENTRY);
  return ensurePosix(path.relative(APP_DIR, absolute));
}

function readMadgeRc() {
  const rcPath = path.join(APP_DIR, '.madgerc');
  try {
    return JSON.parse(fs.readFileSync(rcPath, 'utf8'));
  } catch {
    return {};
  }
}

function classifyNode(node) {
  if (
    node === 'index.js' ||
    node === 'app.json' ||
    node === 'global.ts' ||
    node === 'ReactotronConfig.ts' ||
    node.startsWith('src/')
  ) {
    return 'app';
  }

  if (node.startsWith('../../packages/')) {
    return 'workspace';
  }

  return 'external';
}

function createReachableCollector(graph) {
  const memo = new Map();

  function collect(node, stack = new Set()) {
    if (memo.has(node)) {
      return memo.get(node);
    }

    if (stack.has(node)) {
      return new Set();
    }

    const nextStack = new Set(stack);
    nextStack.add(node);

    const acc = new Set();
    const deps = graph[node] || [];

    for (const dep of deps) {
      acc.add(dep);
      const nested = collect(dep, nextStack);
      for (const item of nested) {
        acc.add(item);
      }
    }

    memo.set(node, acc);
    return acc;
  }

  return collect;
}

function summarizeNode(node, graph, collectReachable) {
  const deps = graph[node] || [];
  const reachable = collectReachable(node);
  const counts = {
    app: 0,
    workspace: 0,
    external: 0,
  };

  for (const item of reachable) {
    counts[classifyNode(item)] += 1;
  }

  return {
    node,
    type: classifyNode(node),
    directDeps: deps.length,
    reachableDeps: reachable.size,
    reachableAppDeps: counts.app,
    reachableWorkspaceDeps: counts.workspace,
    reachableExternalDeps: counts.external,
  };
}

function formatSummaryLine(summary) {
  return [
    `${summary.node}`,
    `[${summary.type}]`,
    `direct=${summary.directDeps}`,
    `reachable=${summary.reachableDeps}`,
    `app=${summary.reachableAppDeps}`,
    `workspace=${summary.reachableWorkspaceDeps}`,
    `external=${summary.reachableExternalDeps}`,
  ].join(' ');
}

function renderTree(entryFile, graph, collectReachable) {
  const lines = [];
  const expanded = new Set();

  function visit(node, prefix = '', isLast = true, ancestors = new Set()) {
    const isRoot = prefix === '' && ancestors.size === 0;
    const branch = isRoot ? '' : isLast ? '└─ ' : '├─ ';
    const summary = summarizeNode(node, graph, collectReachable);
    const line = `${prefix}${branch}${formatSummaryLine(summary)}`;

    if (ancestors.has(node)) {
      lines.push(`${line} [cycle]`);
      return;
    }

    if (expanded.has(node)) {
      lines.push(`${line} [shared]`);
      return;
    }

    lines.push(line);
    expanded.add(node);

    const deps = [...(graph[node] || [])].sort((left, right) => {
      const leftType = classifyNode(left);
      const rightType = classifyNode(right);
      if (leftType !== rightType) {
        return leftType.localeCompare(rightType);
      }
      return left.localeCompare(right);
    });

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(node);

    deps.forEach((dep, index) => {
      const nextPrefix = isRoot ? '' : `${prefix}${isLast ? '   ' : '│  '}`;
      visit(dep, nextPrefix, index === deps.length - 1, nextAncestors);
    });
  }

  visit(entryFile);
  return lines.join('\n');
}

function buildOutputBasename(entryFile) {
  return entryFile.replace(/[\/\\]/g, '__').replace(/\./g, '_');
}

function buildRunId(entryFile, generatedAt) {
  const timestamp = generatedAt.replace(/[:.]/g, '-');
  return `${timestamp}__${buildOutputBasename(entryFile)}`;
}

async function main() {
  const entryFile = normalizeEntry(process.argv[2]);
  const madgeRc = readMadgeRc();

  const result = await madge(entryFile, {
    baseDir: APP_DIR,
    fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    tsConfig: path.join(APP_DIR, 'tsconfig.json'),
    detectiveOptions: madgeRc.detectiveOptions || {},
    excludeRegExp: ['(^\\.\\./\\.\\./packages/.*/dist|\\.d\\.ts$)', '^perf/'],
  });

  const graph = result.obj();

  if (!graph[entryFile]) {
    throw new Error(`Entry file not found in graph: ${entryFile}`);
  }

  const collectReachable = createReachableCollector(graph);
  const generatedAt = new Date().toISOString();
  const runId = buildRunId(entryFile, generatedAt);
  const outputDir = path.join(GENERATED_DIR, runId);

  fs.mkdirSync(outputDir, { recursive: true });

  const focus = DEFAULT_FOCUS_NODES.filter(
    node => node === entryFile || graph[node],
  )
    .map(node => summarizeNode(node, graph, collectReachable))
    .sort((left, right) => right.reachableDeps - left.reachableDeps);

  const topLevel = (graph[entryFile] || [])
    .map(node => summarizeNode(node, graph, collectReachable))
    .sort((left, right) => right.reachableDeps - left.reachableDeps);

  const summary = {
    generatedAt,
    runId,
    ignoredPattern: '^perf/',
    entryFile,
    outputDir: ensurePosix(path.relative(APP_DIR, outputDir)),
    totalGraphNodes: Object.keys(graph).length,
    topLevel,
    focus,
  };

  const treeText = renderTree(entryFile, graph, collectReachable);
  const graphPath = path.join(outputDir, 'graph.json');
  const treePath = path.join(outputDir, 'tree.txt');
  const summaryPath = path.join(outputDir, 'summary.json');

  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  fs.writeFileSync(treePath, `${treeText}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(
    `Entry artifacts written to ${path.relative(APP_DIR, outputDir)}`,
  );
  console.log(`- graph: ${path.relative(APP_DIR, graphPath)}`);
  console.log(`- tree: ${path.relative(APP_DIR, treePath)}`);
  console.log(`- summary: ${path.relative(APP_DIR, summaryPath)}`);
  console.log('');
  console.log('Top-level dependency fan-out:');
  for (const item of topLevel.slice(0, 12)) {
    console.log(`- ${formatSummaryLine(item)}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
