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
      body.match(/component=\{([A-Za-z_$][\w$]*)/) ||
      body.match(/getComponent=\{\(\)\s*=>\s*([A-Za-z_$][\w$]*)/);
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
      const head = entry.match(/^\s*(?:\[RootNames\.(\w+)\]|(\w+))\s*(\?)?\s*:/);
      if (!head) continue;
      const route = head[1] || head[2];
      const entryOptional = Boolean(head[3]);
      const valueBody = entry.slice(head[0].length);
      const keys = entryOptional ? { required: [], optional: [] } : topLevelKeys(valueBody);
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
  navigators.set(name, {
    file: path.relative(appRoot, file),
    screens,
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

const rendered = `${body}`;
const checkOnly = process.argv.includes('--check');
const existing = fs.existsSync(outFile)
  ? fs.readFileSync(outFile, 'utf8')
  : null;

if (checkOnly) {
  if (existing !== rendered) {
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
console.log(
  `[screen-registry] wrote ${sorted.length} screens to ${path.relative(
    appRoot,
    outFile,
  )}`,
);
