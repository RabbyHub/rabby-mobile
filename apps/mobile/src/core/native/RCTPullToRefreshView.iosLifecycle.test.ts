import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';

// Source-contract coverage for the installed Yarn patch, not UIKit execution.
// UIKit starts refreshing before onRefresh. The controlled JS true prop must
// acknowledge that native state without reserving the indicator's space twice.
const packageRoot = dirname(require.resolve('react-native/package.json'));
const source = readFileSync(
  resolve(
    packageRoot,
    'React/Fabric/Mounting/ComponentViews/ScrollView/RCTPullToRefreshViewComponentView.mm',
  ),
  'utf8',
);

function methodBody(signature: string) {
  const methodStart = source.indexOf(signature);
  if (methodStart < 0) {
    throw new Error(`Missing native refresh method: ${signature}`);
  }
  const bodyStart = source.indexOf('{', methodStart);
  let depth = 1;
  let index = bodyStart + 1;
  for (; index < source.length && depth > 0; index++) {
    if (source[index] === '{') {
      depth++;
    }
    if (source[index] === '}') {
      depth--;
    }
  }
  if (depth !== 0) {
    throw new Error(`Unbalanced native refresh method: ${signature}`);
  }
  return source.slice(bodyStart + 1, index - 1);
}

describe('Fabric iOS refresh lifecycle source contract', () => {
  it('ignores active or detached refreshes before moving the list', () => {
    const body = methodBody('- (void)beginRefreshingProgrammatically');
    const guard = body.match(
      /if \(!_scrollViewComponentView \|\| _refreshControl\.isRefreshing\)\s*\{\s*return;\s*\}/,
    );
    expect(guard).not.toBeNull();
    expect(guard!.index).toBeLessThan(body.indexOf('CGPoint offset'));
    expect(guard!.index).toBeLessThan(
      body.indexOf('[scrollView setContentOffset:offset]'),
    );
    expect(guard!.index).toBeLessThan(
      body.indexOf('[_refreshControl beginRefreshing]'),
    );
  });

  it('still reserves indicator space when starting an inactive programmatic refresh', () => {
    const body = methodBody('- (void)beginRefreshingProgrammatically');
    expect(body).toContain(
      'scrollView.contentOffset.y - _refreshControl.frame.size.height',
    );
    expect(body.split('[scrollView setContentOffset:offset]')).toHaveLength(2);
    expect(body.split('[_refreshControl beginRefreshing]')).toHaveLength(2);
    expect(body.indexOf('[scrollView setContentOffset:offset]')).toBeLessThan(
      body.indexOf('[_refreshControl beginRefreshing]'),
    );
  });

  it('routes prop and command starts through the same guard while preserving completion', () => {
    for (const selector of [
      '- (void)updateProps:',
      '- (void)setNativeRefreshing:',
    ]) {
      const body = methodBody(selector);
      expect(body).toContain('[self beginRefreshingProgrammatically]');
      expect(body).toContain('[_refreshControl endRefreshing]');
    }
    expect(methodBody('- (void)setRefreshing:')).toContain(
      '[self setNativeRefreshing:refreshing]',
    );
    expect(methodBody('- (void)handleUIControlEventValueChanged')).toContain(
      '.onRefresh({})',
    );
  });
});
