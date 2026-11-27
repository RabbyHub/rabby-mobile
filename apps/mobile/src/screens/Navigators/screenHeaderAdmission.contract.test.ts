import fs from 'node:fs';
import path from 'node:path';

// Header admission contract (see the Lark layout doc `顶栏 Header` and
// codex-rabby/plans/rabby-mobile-header-governance-20261127.md).
//
// Two rules are enforced here:
//
//  1. `headerShown: false` routes draw their own header. They must be
//     registered below so a new page is consciously checked against the
//     content-column inset contract (SafeWindowFrame / useSystemColumnInset).
//  2. Routes that keep the native header must only use options the Duo outer
//     screen replica (`FoldableStackHeader`) can reproduce. Large titles,
//     search bars and custom backgrounds are not supported there.

const MOBILE_ROOT = path.resolve(__dirname, '../../../'); // apps/mobile
const NAV_DIR = path.join(MOBILE_ROOT, 'src/screens/Navigators');

/** Routes that intentionally render their own header. */
const PAGE_DRAWN_ROUTES = [
  'rootNavigator.tsx::Home',
  'rootNavigator.tsx::DappWebViewStubOnHome',
  'DappsNavigator.tsx::Dapps',
  'HomeNonTabNavigator.tsx::Search',
  'SettingsNavigator.tsx::CustomTestnet',
  'TransactionNavigator.tsx::Perps',
  'TransactionNavigator.tsx::PerpsSearch',
  'AddressNavigator.tsx::SyncExtensionAccountSuccess',
];

/** Navigators whose whole stack is page-drawn. */
const PAGE_DRAWN_NAVIGATORS = [
  'GetStartedNavigator.tsx',
  'TestkitsNavigator.tsx',
];

/** Native-header options that the Duo replica cannot reproduce. */
const REPLICA_UNSUPPORTED_KEYS = [
  'headerLargeTitle',
  'headerSearchBarOptions',
  'headerBackground',
  'headerBackTitle',
  'headerBackTitleVisible',
];

function listNavigatorFiles() {
  return fs
    .readdirSync(NAV_DIR)
    .filter(file => file.endsWith('.tsx') && !file.endsWith('.test.tsx'));
}

type ScreenBlock = { route: string; block: string };

function readScreenBlocks(file: string): ScreenBlock[] {
  const source = fs.readFileSync(path.join(NAV_DIR, file), 'utf8');
  const starts = [...source.matchAll(/<(?:[A-Za-z0-9_]+\.)?Screen\b/g)].map(
    match => match.index ?? 0,
  );

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? source.length;
    const block = source.slice(start, end);
    const name = /name=\{?([^\s}]+)\}?/.exec(block.slice(0, 300))?.[1] ?? '?';
    return {
      route: `${file}::${name.replace('RootNames.', '')}`,
      block,
    };
  });
}

describe('header admission contract', () => {
  it('registers every page-drawn header route', () => {
    const found = listNavigatorFiles()
      .flatMap(readScreenBlocks)
      .filter(({ block }) => /headerShown:\s*false/.test(block))
      .map(({ route }) => route)
      .sort();

    expect(found).toEqual([...PAGE_DRAWN_ROUTES].sort());
  });

  it('keeps navigator-level page-drawn stacks registered', () => {
    const found = listNavigatorFiles()
      .filter(file => {
        const source = fs.readFileSync(path.join(NAV_DIR, file), 'utf8');
        const navigatorStart = source.indexOf('<');
        const screenOptions = source.slice(
          navigatorStart,
          navigatorStart + 600,
        );
        return /screenOptions=\{[^}]*headerShown:\s*false/.test(screenOptions);
      })
      .sort();

    expect(found).toEqual([...PAGE_DRAWN_NAVIGATORS].sort());
  });

  it('keeps native headers inside the Duo replica option contract', () => {
    const offenders = listNavigatorFiles()
      .flatMap(readScreenBlocks)
      .filter(({ block }) => {
        // A route-level JS header replaces the native header entirely.
        if (/\bheader:\s*[\(\{A-Za-z_]/.test(block)) {
          return false;
        }
        return REPLICA_UNSUPPORTED_KEYS.some(key =>
          new RegExp(`\\b${key}\\b`).test(block),
        );
      })
      .map(({ route }) => route);

    expect(offenders).toEqual([]);
  });
});
