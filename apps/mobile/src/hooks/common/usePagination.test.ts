import { act, renderHook } from '@testing-library/react-native';

import { usePsudoPagination } from './usePagination';

describe('usePsudoPagination', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('paginates the list locally and clamps page navigation into range', () => {
    const { result } = renderHook(() => usePsudoPagination([1, 2, 3, 4, 5], 2));

    expect(result.current.currentPageList).toEqual([1, 2]);
    expect(result.current.fallList).toEqual([1, 2]);
    expect(result.current.total).toBe(5);
    expect(result.current.isReachTheEnd).toBe(false);

    act(() => {
      result.current.goToPage(99);
    });

    expect(result.current.currentPageList).toEqual([5]);
    expect(result.current.isReachTheEnd).toBe(true);

    act(() => {
      result.current.goToPage(0);
    });

    expect(result.current.currentPageList).toEqual([1, 2]);
  });

  it('goes to the next page and resets back to the first page', () => {
    const { result } = renderHook(() =>
      usePsudoPagination([1, 2, 3, 4, 5], { pageSize: 2 }),
    );

    act(() => {
      result.current.goToNextPage();
    });

    expect(result.current.currentPageList).toEqual([3, 4]);
    expect(result.current.fallList).toEqual([1, 2, 3, 4]);

    act(() => {
      result.current.resetPage();
    });

    expect(result.current.currentPageList).toEqual([1, 2]);
  });

  it('simulateLoadNext toggles fetching state around the delayed page advance', async () => {
    const { result } = renderHook(() =>
      usePsudoPagination([1, 2, 3, 4], { pageSize: 2 }),
    );

    let promise: Promise<void>;
    act(() => {
      promise = result.current.simulateLoadNext(20);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isFetchingNextPage).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20);
      await promise!;
    });

    expect(result.current.currentPageList).toEqual([3, 4]);
    expect(result.current.isFetchingNextPage).toBe(false);
  });
});
