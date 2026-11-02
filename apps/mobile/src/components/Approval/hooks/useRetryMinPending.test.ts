import { renderHook } from '@testing-library/react-native';

import { RETRY_MIN_PENDING_MS, useRetryMinPending } from './useRetryMinPending';

describe('useRetryMinPending', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows a failure at once when no retry is in flight', () => {
    const { result } = renderHook(() => useRetryMinPending());
    const show = jest.fn();

    result.current.afterMinPending(show);

    expect(show).toHaveBeenCalledTimes(1);
  });

  it('holds a failure that follows a retry until the minimum has passed', () => {
    const { result } = renderHook(() => useRetryMinPending());
    const show = jest.fn();

    result.current.markRetryStarted();
    jest.advanceTimersByTime(100);
    result.current.afterMinPending(show);

    jest.advanceTimersByTime(RETRY_MIN_PENDING_MS - 101);
    expect(show).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('drops a held failure when another retry starts', () => {
    const { result } = renderHook(() => useRetryMinPending());
    const stale = jest.fn();

    result.current.markRetryStarted();
    result.current.afterMinPending(stale);
    result.current.markRetryStarted();
    jest.advanceTimersByTime(RETRY_MIN_PENDING_MS);

    expect(stale).not.toHaveBeenCalled();
  });

  it('does not fire after unmount', () => {
    const { result, unmount } = renderHook(() => useRetryMinPending());
    const show = jest.fn();

    result.current.markRetryStarted();
    result.current.afterMinPending(show);
    unmount();
    jest.advanceTimersByTime(RETRY_MIN_PENDING_MS);

    expect(show).not.toHaveBeenCalled();
  });
});
