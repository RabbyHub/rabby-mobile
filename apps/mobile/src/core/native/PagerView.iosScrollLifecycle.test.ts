import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';

// Source-contract coverage for the installed Yarn patch, not UIKit execution.
// Home suppresses row presses until PagerView reports idle. UIKit does not
// call didEndDecelerating when didEndDragging reports willDecelerate=NO.
const packageRoot = dirname(
  require.resolve('react-native-pager-view/package.json'),
);

function methodBody(source: string, signature: string) {
  const methodStart = source.indexOf(signature);
  if (methodStart < 0) {
    throw new Error(`Missing PagerView delegate: ${signature}`);
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
    throw new Error(`Unbalanced delegate: ${signature}`);
  }
  return source.slice(bodyStart + 1, index - 1);
}

describe.each([
  [
    'Fabric',
    'ios/Fabric/RNCPagerViewComponentView.mm',
    'PageScrollState::Idle',
  ],
  ['Paper', 'ios/RNCPagerView.m', 'state:@"idle"'],
])('PagerView %s iOS scroll lifecycle source contract', (_arch, file, idle) => {
  const source = readFileSync(resolve(packageRoot, file), 'utf8');

  it('emits idle when a drag ends without deceleration', () => {
    const body = methodBody(
      source,
      '- (void)scrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate',
    );
    expect(body).toMatch(/if\s*\(!decelerate\)\s*\{/);
    const noDecelerationBody = methodBody(body, 'if (!decelerate)');
    expect(noDecelerationBody).toContain(idle);
    // Keep the idle emission inside the stopped branch: a real settling
    // animation must continue suppressing presses until deceleration ends.
    expect(body.split(idle)).toHaveLength(2);
    expect(body.replace(noDecelerationBody, '')).not.toContain(idle);
  });

  it('still emits idle at the end of a decelerating drag', () => {
    expect(
      methodBody(source, '- (void)scrollViewDidEndDecelerating:'),
    ).toContain(idle);
  });
});
