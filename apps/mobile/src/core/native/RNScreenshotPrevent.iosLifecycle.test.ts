import { readFileSync } from 'fs';
import { resolve } from 'path';

// Source-contract tests, not native runtime tests. RN's Codegen EventEmitter
// subscribes without calling ObjC addListener:. Keep that separate lifecycle
// wired to NSNotificationCenter; UIKit delivery still requires device testing.
const source = readFileSync(
  resolve(__dirname, '../../../ios/RabbyMobile/RNScreenshotPrevent.mm'),
  'utf8',
);

function methodBody(signature: string) {
  const methodStart = source.indexOf(signature);
  if (methodStart < 0) {
    throw new Error(`Missing native lifecycle method: ${signature}`);
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
    throw new Error(`Unbalanced method body: ${signature}`);
  }
  return source.slice(bodyStart + 1, index - 1);
}

describe('iOS screenshot notification lifecycle source contract', () => {
  it('starts observation when the Codegen emitter is ready, independently of legacy addListener', () => {
    const body = methodBody('- (void)setEventEmitterCallback:');
    expect(body).toMatch(/@synchronized\s*\(self\)/);
    expect(body.indexOf('notificationObserversInvalidated')).toBeLessThan(
      body.indexOf('[super setEventEmitterCallback:'),
    );
    expect(body).toContain('[super setEventEmitterCallback:');
    expect(body).toContain('codegenEventEmitterReady = YES');
    expect(body.indexOf('[super setEventEmitterCallback:')).toBeLessThan(
      body.indexOf('codegenEventEmitterReady = YES'),
    );
    expect(body).toContain('[self synchronizeNotificationObservers]');
  });

  it('reconciles on the main queue from current state, so queued starts cannot revive invalidated modules', () => {
    const body = methodBody('- (void)synchronizeNotificationObservers');
    expect(body).toContain('__weak RNScreenshotPrevent *weakSelf = self');
    expect(body).toContain('RCTExecuteOnMainQueue(^{');
    expect(body).toContain('RNScreenshotPrevent *strongSelf = weakSelf');
    expect(body).toMatch(/@synchronized\s*\(strongSelf\)/);
    expect(body).toContain('!strongSelf->notificationObserversInvalidated');
    expect(body).toContain('strongSelf->legacyObservationRequested');
    expect(body).toContain('strongSelf->codegenEventEmitterReady');
    expect(body).toContain('[strongSelf startNotificationObserversIfNeeded]');
    expect(body).toContain('[strongSelf stopNotificationObservers]');
    expect(body).not.toContain('dispatch_sync');
  });

  it('keeps legacy listener demand independent from the Codegen lifetime', () => {
    const start = methodBody('- (void) startObserving');
    const stop = methodBody('- (void) stopObserving');
    expect(start).toContain('legacyObservationRequested = YES');
    expect(stop).toContain('legacyObservationRequested = NO');
    for (const body of [start, stop]) {
      expect(body).toContain('[self synchronizeNotificationObservers]');
      expect(body).not.toContain('codegenEventEmitterReady =');
      expect(body).not.toContain('NSNotificationCenter');
    }
  });

  it('registers idempotently without retaining the module in the screenshot observer', () => {
    const body = methodBody('- (void)startNotificationObserversIfNeeded');
    expect(body).toMatch(/if\s*\(hasListeners\)/);
    expect(body).toContain('__weak RNScreenshotPrevent *weakSelf = self');
    expect(body).toContain('RNScreenshotPrevent *strongSelf = weakSelf');
    expect(body).toContain('[strongSelf canHandleNotification]');
    expect(body).toContain('[strongSelf convertVisibleWindowsToImage]');
    expect(body).toContain('hasListeners = TRUE');
  });

  it('invalidates synchronously before queued cleanup and removes both observer forms on destruction', () => {
    const invalidate = methodBody('- (void)invalidate');
    expect(invalidate).toMatch(/@synchronized\s*\(self\)/);
    expect(
      invalidate.indexOf('notificationObserversInvalidated = YES'),
    ).toBeLessThan(
      invalidate.indexOf('[self synchronizeNotificationObservers]'),
    );
    expect(invalidate).toContain('[super invalidate]');
    expect(methodBody('- (void)dealloc')).toContain(
      '[self stopNotificationObservers]',
    );
    const cleanup = methodBody('- (void)stopNotificationObservers');
    expect(cleanup).toContain('removeObserver:self');
    expect(cleanup).toContain('removeObserver:screenshotObserver');
    expect(cleanup).toContain('screenshotObserver = nil');
  });

  it('serializes the emission gate with invalidation and callback setup', () => {
    const gate = methodBody('- (BOOL)canHandleNotification');
    expect(gate).toMatch(/@synchronized\s*\(self\)/);
    expect(gate).toContain('hasListeners && !notificationObserversInvalidated');
    for (const selector of [
      '- (BOOL)emitUserDidTakeScreenshotEvent:',
      '- (void)emitAppSwitcherBlurChangedEvent:',
      '- (void)emitScreenCapturedChangedEvent:',
      '- (void)emitPreventScreenshotChangedEvent:',
    ]) {
      const body = methodBody(selector);
      expect(body).toMatch(/@synchronized\s*\(self\)/);
      expect(body).toContain('if (![self canHandleNotification])');
    }
  });

  it('removes only the just-created screenshot if invalidation prevents handing it to JS cleanup', () => {
    const capture = methodBody('- (void)startNotificationObserversIfNeeded');
    const emit = methodBody('- (BOOL)emitUserDidTakeScreenshotEvent:');
    expect(capture).toContain(
      'BOOL emitted = [strongSelf emitUserDidTakeScreenshotEvent:result]',
    );
    expect(capture).toMatch(
      /if \(success && !emitted\)\s*\{[^}]*removeItemAtPath:filePath/s,
    );
    expect(emit).toMatch(
      /if \(!\[self canHandleNotification\]\)\s*\{\s*return NO;/,
    );
    expect(emit).toContain('return YES;');
  });

  it('requires explicit feedback demand before producing a file but preserves signal-only listeners', () => {
    const gate = methodBody('- (BOOL)canCaptureScreenshot');
    expect(gate).toContain('screenshotCaptureConsumers > 0 && !enabled');
    expect(gate).toContain('[self canHandleNotification]');
    const capture = methodBody('- (void)startNotificationObserversIfNeeded');
    expect(capture).toContain('if ([strongSelf canCaptureScreenshot])');
    expect(
      capture.indexOf('if ([strongSelf canCaptureScreenshot])'),
    ).toBeLessThan(
      capture.indexOf('[strongSelf convertVisibleWindowsToImage]'),
    );
    expect(capture).toMatch(
      /else\s*\{\s*\[strongSelf emitUserDidTakeScreenshotEvent:nil\]/,
    );
    expect(methodBody('- (void)setEventEmitterCallback:')).not.toContain(
      'screenshotCaptureConsumers',
    );
  });

  it('balances capture demand independently of the Codegen lifetime in both architectures', () => {
    expect(methodBody('- (void)beginScreenshotCapture:')).toContain(
      'screenshotCaptureConsumers += 1',
    );
    expect(methodBody('- (void)endScreenshotCapture:')).toMatch(
      /if \(screenshotCaptureConsumers > 0\)\s*\{\s*screenshotCaptureConsumers -= 1;/,
    );
    expect(methodBody('- (void)invalidate')).toContain(
      'screenshotCaptureConsumers = 0',
    );
    expect(source).toContain('RCT_EXPORT_METHOD(startScreenCaptureDetection:');
    expect(source).toContain('RCT_EXPORT_METHOD(stopScreenCaptureDetection:');
  });

  it('removes only its own blur view on main when invalidated or destroyed', () => {
    expect(methodBody('- (void)synchronizeNotificationObservers')).toMatch(
      /if \(strongSelf->notificationObserversInvalidated\)\s*\{\s*\[strongSelf clearOwnedObfuscatingView\]/,
    );
    expect(methodBody('- (void)dealloc')).toContain(
      '[self clearOwnedObfuscatingView]',
    );
    const cleanup = methodBody('- (void)clearOwnedObfuscatingView');
    expect(cleanup).toContain('UIImageView *view = obfuscatingView');
    expect(cleanup).toContain('obfuscatingView = nil');
    expect(cleanup).toMatch(
      /RCTExecuteOnMainQueue\(\^\{\s*\[view removeFromSuperview\]/,
    );
    expect(cleanup).not.toContain('self');
    expect(cleanup).not.toContain('secureField');
    expect(cleanup).not.toContain('ScreenShield');
  });
});
