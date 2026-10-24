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

  it('does not create an extra host pan or override its axis arbitration', () => {
    // This checks the installed native source policy, not UIKit recognizer
    // arbitration. Physical vertical/horizontal/diagonal drags remain required.
    expect(
      /\[\s*UIPanGestureRecognizer\s+(?:new|alloc)\s*\]/.test(source),
    ).toBe(false);
    expect(/@property[^\n]*\bpanGestureRecognizer\b/.test(source)).toBe(false);
    expect(source.includes('self.panGestureRecognizer')).toBe(false);
    expect(source.includes('gestureRecognizerShouldBegin:')).toBe(false);
  });

  it('does not negotiate back gestures by changing the internal scroll pan', () => {
    expect(
      source.includes('shouldRecognizeSimultaneouslyWithGestureRecognizer:'),
    ).toBe(false);
    expect(source.includes('@"RNSPanGestureRecognizer"')).toBe(false);
    expect(
      /panGestureRecognizer\s*\.\s*(?:enabled|delegate)\s*=/.test(source),
    ).toBe(false);
  });
});

describe('PagerView Fabric passive trace source contract', () => {
  const source = readFileSync(
    resolve(packageRoot, 'ios/Fabric/RNCPagerViewComponentView.mm'),
    'utf8',
  );
  const attach = methodBody(source, '- (void)rabbyAttachTraceObserver {');
  const detach = methodBody(source, '- (void)rabbyDetachTraceObserver {');
  const trace = methodBody(
    source,
    '- (void)rabbyTraceEvent:(NSString *)event index:(NSInteger)index {',
  );
  const observe = methodBody(
    source,
    '- (void)rabbyTracePanState:(UIPanGestureRecognizer *)recognizer {',
  );

  it('guards trace state and implementation with DEBUG and leaves the release macro inert', () => {
    // Inspect the installed guards, not a simulated compiler or UIKit runtime.
    const outsideDebug = source.replace(/^#if DEBUG\n[\s\S]*?^#endif/gm, '');
    expect(
      /RabbyPagerTraceEnabled|rabby(?:Trace|Attach|Detach)|_rabby(?:ObservedPan|LastPanState|GestureGeneration)|NSLog/.test(
        outsideDebug,
      ),
    ).toBe(false);
    expect(
      /#else\s*#define RABBY_PAGER_TRACE\([^\n)]+\) do \{\} while \(0\)\s*#endif/.test(
        source,
      ),
    ).toBe(true);
  });

  it('requires exact launch opt-in before observing or emitting bounded trace output', () => {
    const enabled = methodBody(source, 'static BOOL RabbyPagerTraceEnabled()');
    expect(enabled).toContain('dispatch_once(&onceToken, ^{');
    expect(enabled).toContain(
      'enabled = [[[NSProcessInfo processInfo] environment][@"RABBY_PAGER_TRACE"] isEqualToString:@"1"];',
    );
    expect(enabled.trim().endsWith('return enabled;')).toBe(true);
    for (const [body, operation] of [
      [attach, 'addTarget:'],
      [trace, 'NSLog('],
    ]) {
      const guard = 'if (!RabbyPagerTraceEnabled())';
      expect(methodBody(body, guard).trim()).toBe('return;');
      expect(body.indexOf(guard)).toBeLessThan(body.indexOf(operation));
    }
    expect(methodBody(trace, 'if (sequence >= 2048)').trim()).toBe('return;');
    expect(trace.indexOf('if (sequence >= 2048)')).toBeLessThan(
      trace.indexOf('NSLog('),
    );
  });

  it('only observes the existing pan and removes its own target on replacement or teardown', () => {
    expect(source).toContain(
      '__weak UIPanGestureRecognizer *_rabbyObservedPan;',
    );
    expect(attach).toContain(
      '_rabbyObservedPan = scrollView.panGestureRecognizer;',
    );
    expect(attach).toContain(
      '[_rabbyObservedPan addTarget:self action:@selector(rabbyTracePanState:)];',
    );
    expect(attach.indexOf('[self rabbyDetachTraceObserver]')).toBeLessThan(
      attach.indexOf('addTarget:'),
    );
    expect(detach).toContain(
      '[_rabbyObservedPan removeTarget:self action:@selector(rabbyTracePanState:)];',
    );
    expect(detach).toContain('_rabbyObservedPan = nil;');
    expect(observe).toContain('if (recognizer.state != _rabbyLastPanState)');
    const observerBodies = [attach, detach, observe, trace].join('\n');
    expect(observerBodies).not.toMatch(
      /\.(?:enabled|delegate|state|contentOffset|userInteractionEnabled)\s*=(?!=)|setEnabled:|setDelegate:|setState:|setContentOffset:|requireGestureRecognizerToFail:|setPage:|scrollTo|sendEvent:|onPageSelected\(/,
    );
    for (const signature of [
      '- (void)initializeNativePageViewController {',
      '-(void)prepareForRecycle {',
      '- (void)dealloc {',
    ]) {
      expect(methodBody(source, signature)).toContain(
        '[self rabbyDetachTraceObserver];',
      );
    }
    const move = methodBody(
      source,
      '- (void)willMoveToSuperview:(UIView *)newSuperview {',
    );
    expect(methodBody(move, 'if (newSuperview == nil)')).toContain(
      '[self rabbyDetachTraceObserver];',
    );
  });
});
