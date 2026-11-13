#!/usr/bin/env node
/**
 * Generates the screen registry from the navigators that actually register
 * screens.
 *
 * The registry is the single place that answers "which screens exist, under
 * which navigator, and what is the route chain to open them". It is derived
 * from code, never hand-maintained, so a screen added to a navigator shows up
 * here on the next run (and `--check` turns a stale registry into a CI error).
 *
 * Sources scanned:
 *   - src/AppNavigation.tsx           (root stack)
 *   - src/screens/Navigators/*.tsx    (nested stacks)
 *
 * usage:
 *   node scripts/gen-screen-registry.mjs [--check]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const outFile = path.join(
  appRoot,
  'src/devtools/screenRegistry/screens.gen.ts',
);

const navigatorFiles = [
  path.join(appRoot, 'src/AppNavigation.tsx'),
  ...fs
    .readdirSync(path.join(appRoot, 'src/screens/Navigators'))
    .filter(name => name.endsWith('.tsx') && !name.includes('.test.'))
    .map(name => path.join(appRoot, 'src/screens/Navigators', name)),
];

/** `export function FooNavigator(` / `const FooNavigator =` */
function navigatorExportName(source, file) {
  const fn = source.match(/export\s+(?:default\s+)?function\s+(\w+)\s*\(/);
  if (fn) return fn[1];
  const varDecl = source.match(/export\s+const\s+(\w+)\s*[:=]/);
  if (varDecl) return varDecl[1];
  return path.basename(file, '.tsx');
}

/**
 * Extracts `<Something.Screen ... />` entries. Handles both
 * `name={RootNames.Foo}` and `name="Foo"`, `component={Bar}` and
 * `getComponent={() => Bar}`.
 */
function extractScreens(source) {
  const screens = [];
  const screenRe = /<([A-Za-z_$][\w$]*)\.Screen\b([\s\S]*?)\/>/g;
  let match;
  while ((match = screenRe.exec(source))) {
    const [, stackName, body] = match;
    const nameMatch =
      body.match(/name=\{RootNames\.(\w+)\}/) ||
      body.match(/name="(\w+)"/) ||
      body.match(/name='(\w+)'/);
    if (!nameMatch) continue;
    const componentMatch =
      // `component={Foo}` or `component={withScreenPropsInjection(Foo)}`
      body.match(
        /component=\{(?:withScreenPropsInjection\()?([A-Za-z_$][\w$]*)/,
      ) || body.match(/getComponent=\{\(\)\s*=>\s*([A-Za-z_$][\w$]*)/);
    screens.push({
      id: nameMatch[1],
      stack: stackName,
      component: componentMatch ? componentMatch[1] : null,
    });
  }
  return screens;
}

/**
 * Parses `export type XxxParamsList = { [RootNames.Route]: {...} }` blocks and
 * returns, per route: the top-level param keys and which of them are required.
 * Only the shape of the entry matters here, not the param types.
 */
function extractParamLists(source) {
  const result = new Map(); // route -> { required, optional }
  const listRe = /export\s+type\s+(\w+ParamsList)\s*=\s*\{/g;
  let listMatch;
  while ((listMatch = listRe.exec(source))) {
    const bodyStart = listMatch.index + listMatch[0].length - 1;
    const body = sliceBalanced(source, bodyStart);
    if (!body) continue;
    for (const entry of splitTopLevel(body)) {
      const head = entry.match(
        /^\s*(?:\[RootNames\.(\w+)\]|(\w+))\s*(\?)?\s*:/,
      );
      if (!head) continue;
      const route = head[1] || head[2];
      const entryOptional = Boolean(head[3]);
      const valueBody = entry.slice(head[0].length);
      const keys = entryOptional
        ? { required: [], optional: [] }
        : topLevelKeys(valueBody);
      result.set(route, keys);
    }
  }
  return result;
}

/** Returns the substring from an opening brace to its match (inclusive). */
function sliceBalanced(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, index + 1);
    }
  }
  return null;
}

/** Splits a `{...}` body into depth-0 entries (separated by `;` or newline). */
function splitTopLevel(body) {
  const entries = [];
  let depth = 0;
  let current = '';
  const inner = body.slice(1, -1);
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if ('{(['.includes(char)) depth += 1;
    else if ('})]'.includes(char)) depth -= 1;
    if (depth === 0 && (char === ';' || char === '\n')) {
      if (current.trim()) entries.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) entries.push(current);
  return entries;
}

/** Top-level keys of an object type body: required vs optional. */
function topLevelKeys(valueBody) {
  const required = [];
  const optional = [];
  const braceIndex = valueBody.indexOf('{');
  if (braceIndex === -1) return { required, optional };
  const body = sliceBalanced(valueBody, braceIndex);
  if (!body) return { required, optional };
  let depth = 0;
  for (let index = 1; index < body.length - 1; index += 1) {
    const char = body[index];
    if ('{(['.includes(char)) {
      depth += 1;
      continue;
    }
    if ('})]'.includes(char)) {
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    const match = body.slice(index).match(/^(\w+)(\?)?\s*:/);
    if (!match) continue;
    if (match[2]) optional.push(match[1]);
    else required.push(match[1]);
    index += match[0].length - 1;
  }
  return { required, optional };
}

/** Maps the component identifiers imported by a navigator file to source files. */
function importMapFor(file, source) {
  const map = new Map();
  const importRe =
    /import\s+(?:type\s+)?(?:([\w$]+)\s*,?\s*)?(?:\{([\s\S]*?)\})?\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRe.exec(source))) {
    const [, defaultName, namedRaw, spec] = match;
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    const resolved = resolveImport(file, spec);
    if (!resolved) continue;
    if (defaultName) map.set(defaultName.trim(), resolved);
    if (namedRaw) {
      for (const part of namedRaw.split(',')) {
        const named = part.trim().split(/\s+as\s+/);
        if (!named.length) continue;
        const imported = named[0].trim();
        const local = (named[1] || named[0]).trim();
        if (imported) map.set(local, resolved);
      }
    }
  }
  return map;
}

/** Follows `export { X } from '...'` / `export const X =` barrels one level. */
function followBarrel(file, exportName) {
  if (!file) return file;
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    return file;
  }
  const reExport = source.match(
    new RegExp(
      `export\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`,
    ),
  );
  if (reExport) {
    const next = resolveImport(file, reExport[1]);
    if (next && next !== file) return next;
  }
  return file;
}

function resolveImport(fromFile, spec) {
  const base = spec.startsWith('@/')
    ? path.join(appRoot, 'src', spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** Params a screen actually reads: `params.x`, `route.params.x`, destructuring. */
function usedParamsIn(file) {
  if (!file) return [];
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const used = new Set();
  for (const match of source.matchAll(/params\s*\.\s*([A-Za-z_]\w*)/g)) {
    used.add(match[1]);
  }
  for (const match of source.matchAll(
    /(?:const|let)\s*\{([^}]*)\}\s*=\s*[\w.()\s]*params\b/g,
  )) {
    for (const part of match[1].split(',')) {
      const key = part.trim().split(':')[0].trim();
      if (/^[A-Za-z_]\w*$/.test(key)) used.add(key);
    }
  }
  used.delete('params');
  return [...used];
}

const navigationTypesSource = fs.readFileSync(
  path.join(appRoot, 'src/navigation-type.ts'),
  'utf8',
);
const routeParams = extractParamLists(navigationTypesSource);

const navigators = new Map(); // navigatorName -> { file, screens }
for (const file of navigatorFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const name = navigatorExportName(source, file);
  const screens = extractScreens(source);
  if (!screens.length) continue;
  const imports = importMapFor(file, source);
  navigators.set(name, {
    file: path.relative(appRoot, file),
    screens: screens.map(screen => ({
      ...screen,
      sourceFile: screen.component
        ? followBarrel(imports.get(screen.component) || null, screen.component)
        : null,
    })),
  });
}

// A screen component that is itself a navigator becomes the parent of that
// navigator's screens, which is how the route chain is built.
const byComponent = new Map();
for (const [name, entry] of navigators) byComponent.set(name, entry);

const roots = [];
for (const [name, entry] of navigators) {
  const isChild = [...navigators.values()].some(other =>
    other.screens.some(screen => screen.component === name),
  );
  if (!isChild) roots.push(name);
}

const registry = new Map();

function walk(navigatorName, chain) {
  const entry = navigators.get(navigatorName);
  if (!entry) return;
  for (const screen of entry.screens) {
    const nextChain = [...chain, { name: navigatorName, route: screen.id }];
    const usedParams = usedParamsIn(screen.sourceFile);
    const existing = registry.get(screen.id);
    if (!existing || nextChain.length < existing.chain.length) {
      registry.set(screen.id, {
        id: screen.id,
        route: screen.id,
        navigator: navigatorName,
        file: entry.file,
        chain: nextChain.map(item => item.route),
        chainNavigators: nextChain.map(item => item.name),
        params: routeParams.get(screen.id)?.required ?? [],
        optionalParams: routeParams.get(screen.id)?.optional ?? [],
        usedParams,
        // Params the screen dereferences that the route type marks optional (or
        // does not declare at all): passing them is what keeps such a screen
        // from throwing on `undefined`.
        riskyParams: usedParams.filter(
          key => !(routeParams.get(screen.id)?.required ?? []).includes(key),
        ),
        sourceFile: screen.sourceFile
          ? path.relative(appRoot, screen.sourceFile)
          : null,
      });
    }
    if (screen.component && byComponent.has(screen.component)) {
      walk(screen.component, nextChain);
    }
  }
}

for (const root of roots) walk(root, []);

const sorted = [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));

const banner = `// AUTO-GENERATED by scripts/gen-screen-registry.mjs - do not edit.
// Sources: src/AppNavigation.tsx and src/screens/Navigators/*.tsx
`;

const body = `${banner}
export type ScreenshotRegistryEntry = {
  /** Route name (matches RootNames). */
  id: string;
  route: string;
  /** Navigator that registers this screen. */
  navigator: string;
  /** Source file of that navigator. */
  file: string;
  /**
   * Route chain from the root navigator down to this screen. Opening the screen
   * means pushing the whole chain so the back stack stays meaningful.
   */
  chain: string[];
  chainNavigators: string[];
  /** Top-level route params the screen requires (from navigation-type.ts). */
  params: string[];
  /** Top-level route params that are optional. */
  optionalParams: string[];
  /** Params the screen source actually reads. */
  usedParams: string[];
  /** Read by the screen but declared optional: pass them to avoid crashes. */
  riskyParams: string[];
  /** Screen component source file, when it could be resolved. */
  sourceFile: string | null;
};

export const SCREEN_REGISTRY = {
${sorted
  .map(
    entry =>
      `  ${JSON.stringify(entry.id)}: ${JSON.stringify(entry, null, 2)
        .split('\n')
        .join('\n  ')},`,
  )
  .join('\n')}
} as const satisfies Record<string, ScreenshotRegistryEntry>;

export type RegisteredScreenId = keyof typeof SCREEN_REGISTRY;

export const REGISTERED_SCREEN_IDS = Object.keys(
  SCREEN_REGISTRY,
) as RegisteredScreenId[];
`;

function formatWithPrettier(content, targetPath) {
  try {
    execFileSync('npx', ['--no-install', 'prettier', '--write', targetPath], {
      cwd: appRoot,
      stdio: 'ignore',
    });
    return fs.readFileSync(targetPath, 'utf8');
  } catch {
    return content;
  }
}

const rendered = `${body}`;
if (process.argv.includes('--report')) {
  const risky = sorted.filter(entry => entry.riskyParams.length > 0);
  console.log(
    `[screen-registry] ${risky.length} screens read params the route type does not require:`,
  );
  for (const entry of risky) {
    console.log(
      `  ${entry.id.padEnd(26)} ${entry.riskyParams.join(', ')}  (${
        entry.sourceFile ?? 'unknown'
      })`,
    );
  }
  process.exit(0);
}

const checkOnly = process.argv.includes('--check');
const existing = fs.existsSync(outFile)
  ? fs.readFileSync(outFile, 'utf8')
  : null;

if (checkOnly) {
  const tmpFile = path.join(appRoot, '.screens.gen.tmp.ts');
  fs.writeFileSync(tmpFile, rendered);
  const formatted = formatWithPrettier(rendered, tmpFile);
  fs.rmSync(tmpFile, { force: true });
  if (existing !== formatted) {
    console.error(
      '[screen-registry] screens.gen.ts is out of date; run `node scripts/gen-screen-registry.mjs`',
    );
    process.exit(1);
  }
  console.log(`[screen-registry] up to date (${sorted.length} screens)`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, rendered);
formatWithPrettier(rendered, outFile);

// Keep the generated file prettier-clean so `--check` compares like-for-like
// even though lint-staged/formatters would rewrite it on commit.
try {
  execFileSync('npx', ['--no-install', 'prettier', '--write', outFile], {
    cwd: appRoot,
    stdio: 'ignore',
  });
} catch {
  // prettier is optional (for example when running outside the repo install)
}
console.log(
  `[screen-registry] wrote ${sorted.length} screens to ${path.relative(
    appRoot,
    outFile,
  )}`,
);
