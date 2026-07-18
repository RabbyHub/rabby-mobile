const mockTraceAndroidInstant = jest.fn();
const mockMarkStartupRuntimePhase = jest.fn();

jest.mock('./androidTrace', () => ({
  traceAndroidInstant: (...args: unknown[]) => mockTraceAndroidInstant(...args),
}));

jest.mock('@/startup/runtimeDiagnostics', () => ({
  markStartupRuntimePhase: (...args: unknown[]) =>
    mockMarkStartupRuntimePhase(...args),
}));

import {
  getHomeContentReady,
  getHomeEntryReady,
  markHomeContentReady,
  markHomeEntryReady,
  resetHomeStartupMilestonesForTests,
  runAfterHomeContentReady,
  runAfterHomeEntryReady,
} from './homeStartupMilestones';

describe('home startup milestones', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetHomeStartupMilestonesForTests();
    mockTraceAndroidInstant.mockClear();
    mockMarkStartupRuntimePhase.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('releases waiting and late home entry tasks exactly once', () => {
    const waiting = jest.fn();
    const late = jest.fn();

    runAfterHomeEntryReady(waiting);
    expect(getHomeEntryReady()).toBe(false);

    expect(markHomeEntryReady('bootstrap_session_ready')).toBe(true);
    expect(markHomeEntryReady('wallet_auth_unlocked')).toBe(false);
    runAfterHomeEntryReady(late);

    expect(waiting).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
    expect(getHomeEntryReady()).toBe(true);
    expect(mockMarkStartupRuntimePhase).toHaveBeenCalledWith(
      'home',
      'entry-ready',
      'bootstrap_session_ready',
    );
  });

  it('keeps content tasks pending until content settles', () => {
    const callback = jest.fn();
    runAfterHomeContentReady(callback);

    markHomeEntryReady('wallet_auth_unlocked');
    expect(callback).not.toHaveBeenCalled();

    markHomeContentReady('portfolio_content_settled');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(getHomeContentReady()).toBe(true);
  });

  it('runs a content task registered after the milestone immediately', () => {
    const callback = jest.fn();
    markHomeContentReady('portfolio_content_settled');

    expect(() =>
      runAfterHomeContentReady(callback, { fallbackMs: 5000 }),
    ).not.toThrow();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('starts a content fallback only after Home entry is ready', () => {
    const callback = jest.fn();
    runAfterHomeContentReady(callback, { fallbackMs: 5000 });

    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();

    markHomeEntryReady('bootstrap_session_ready');
    jest.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(getHomeContentReady()).toBe(false);
  });
});
