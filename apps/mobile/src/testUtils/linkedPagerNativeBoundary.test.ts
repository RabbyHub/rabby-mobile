import {
  createReanimatedBoundary,
  nativeBoundary,
} from './linkedPagerNativeBoundary';

beforeEach(() => nativeBoundary.reset());
afterEach(() => nativeBoundary.reset());

describe('linked pager native boundary notification model', () => {
  it('keeps synchronous delivery as the existing test default', () => {
    const callback = jest.fn();
    createReanimatedBoundary().runOnJS(callback)('pro', 3);
    expect(callback).toHaveBeenCalledWith('pro', 3);
    expect(nativeBoundary.pendingJSCount()).toBe(0);
  });

  it('defers notifications without deferring UI actions, and flushes FIFO', () => {
    const boundary = createReanimatedBoundary();
    const events: string[] = [];
    const publish = boundary.runOnJS((key: string, epoch: number) => {
      events.push(`JS:${key}:${epoch}`);
    });
    nativeBoundary.setJSNotificationsDeferred(true);
    const uiAction = boundary.runOnUI(() => {
      events.push('UI:pro');
      publish('pro', 1);
      events.push('UI:simple');
      publish('simple', 2);
    }) as () => void;
    uiAction();
    expect(events).toEqual(['UI:pro', 'UI:simple']);
    expect(nativeBoundary.pendingJSCount()).toBe(2);

    nativeBoundary.flushNextJS();
    expect(events).toEqual(['UI:pro', 'UI:simple', 'JS:pro:1']);
    expect(nativeBoundary.pendingJSCount()).toBe(1);
    nativeBoundary.flushJS();
    expect(events).toEqual(['UI:pro', 'UI:simple', 'JS:pro:1', 'JS:simple:2']);
    expect(nativeBoundary.pendingJSCount()).toBe(0);
  });

  it('reset discards queued callbacks and restores synchronous delivery', () => {
    const publish = jest.fn();
    nativeBoundary.setJSNotificationsDeferred(true);
    const deliver = createReanimatedBoundary().runOnJS(publish);
    deliver('old');
    nativeBoundary.reset();
    nativeBoundary.flushJS();
    expect(publish).not.toHaveBeenCalled();
    deliver('new');
    expect(publish).toHaveBeenCalledWith('new');
  });
});
