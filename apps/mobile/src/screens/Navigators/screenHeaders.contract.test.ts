import fs from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

// Header governance contract (see the Lark layout doc `顶栏 Header` and
// codex-rabby/plans/rabby-mobile-header-governance-20261127.md):
//
//  1. A route declares its header once. Installing or swapping the header type
//     after mount (`setNavigationOptions` / `navigation.setOptions`) makes iOS
//     animate the previous native header out as a copied ghost ("header flies
//     up", QA 2467).
//  2. The lint rule `no-dynamic-header-options` enforces it, with an explicit
//     migration allowlist in `.eslintrc.js`.
//
// This contract test keeps the allowlist honest: it must match the files that
// still contain a header swap, so a migrated screen cannot leave a stale entry
// behind and a new swap cannot slip in with the rule disabled inline.

const MOBILE_ROOT = path.resolve(__dirname, '../../../'); // apps/mobile
const SRC_ROOT = path.join(MOBILE_ROOT, 'src');
const ESLINTRC = path.resolve(MOBILE_ROOT, '.eslintrc.js');
const RULE_PATH = path.resolve(
  MOBILE_ROOT,
  'eslint-rules/no-dynamic-header-options.js',
);

const HEADER_KEYS = new Set([
  'header',
  'headerTitle',
  'title',
  'headerLeft',
  'unstable_headerLeftItems',
]);

function walkFiles(dir: string, out: string[] = []): string[] {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      return;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  });
  return out;
}

function walkAst(node: any, visit: (node: any) => void) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (typeof node.type === 'string') {
    visit(node);
  }
  Object.keys(node).forEach(key => {
    const value = (node as any)[key];
    if (!value || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(child => walkAst(child, visit));
      return;
    }
    walkAst(value, visit);
  });
}

function propertyName(property: any): string | null {
  if (
    !property ||
    (property.type !== 'Property' && property.type !== 'ObjectProperty')
  ) {
    return null;
  }
  if (!property.computed && property.key?.type === 'Identifier') {
    return property.key.name;
  }
  if (property.key?.type === 'Literal') {
    return String(property.key.value);
  }
  return null;
}

function collectHeaderObjects(node: any): any[] {
  if (!node) {
    return [];
  }
  if (node.type === 'ObjectExpression') {
    return [node];
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'Object' &&
    node.callee.property?.name === 'assign'
  ) {
    return node.arguments.filter((arg: any) => arg.type === 'ObjectExpression');
  }
  return [];
}

function findHeaderSwaps(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  if (
    !source.includes('setNavigationOptions') &&
    !source.includes('.setOptions(')
  ) {
    return [];
  }

  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  const keys: string[] = [];
  walkAst(ast, node => {
    if (node.type !== 'CallExpression') {
      return;
    }
    const callee = node.callee;
    const isSetNavigationOptions =
      callee?.type === 'Identifier' && callee.name === 'setNavigationOptions';
    const isNavigationSetOptions =
      callee?.type === 'MemberExpression' &&
      !callee.computed &&
      callee.property?.type === 'Identifier' &&
      callee.property.name === 'setOptions';

    if (!isSetNavigationOptions && !isNavigationSetOptions) {
      return;
    }

    collectHeaderObjects(node.arguments?.[0]).forEach(objectExpression => {
      objectExpression.properties.forEach((property: any) => {
        const name = propertyName(property);
        if (name && HEADER_KEYS.has(name)) {
          keys.push(name);
        }
      });
    });
  });

  return keys;
}

function readAllowlist(): string[] {
  const config = require(ESLINTRC);
  const ruleConfig = config.rules?.['no-dynamic-header-options'];
  const options = Array.isArray(ruleConfig) ? ruleConfig[1] : undefined;
  return [...(options?.allowFiles || [])].map(file =>
    String(file).replace(/\\/g, '/'),
  );
}

describe('header governance contract', () => {
  it('keeps the migration allowlist equal to the files that still swap headers', () => {
    const offenders = walkFiles(SRC_ROOT)
      .map(file => ({
        file: path.relative(MOBILE_ROOT, file).replace(/\\/g, '/'),
        keys: findHeaderSwaps(file),
      }))
      .filter(entry => entry.keys.length > 0);

    const offenderFiles = offenders.map(entry => entry.file).sort();
    const allowlist = readAllowlist().sort();

    expect(offenderFiles).toEqual(allowlist);
  });

  it('reports header swaps but leaves headerRight alone', () => {
    const rule = require(RULE_PATH);
    const reports: any[] = [];
    const visitor = rule.create({
      options: [],
      getFilename: () => '/fixture/new-screen.tsx',
      report: (descriptor: any) => reports.push(descriptor),
    });

    // ESTree shape (what the eslint rule sees).
    const callNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'setNavigationOptions' },
      arguments: [
        {
          type: 'ObjectExpression',
          properties: [
            {
              type: 'Property',
              computed: false,
              key: { type: 'Identifier', name: 'headerTitle' },
            },
            {
              type: 'Property',
              computed: false,
              key: { type: 'Identifier', name: 'headerRight' },
            },
          ],
        },
      ],
    };
    visitor.CallExpression?.(callNode as any);

    expect(reports).toHaveLength(1);
    expect(reports[0].data.key).toBe('headerTitle');
  });
});
