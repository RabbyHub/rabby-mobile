import { renderHook } from '@testing-library/react-native';

import { useScrollToTopOnChainChange } from './useScrollToTopOnChainChange';

const mockScrollTo = jest.fn();

jest.mock('react-native-collapsible-tab-view/src/hooks', () => ({
  useScroller: () => mockScrollTo,
  useTabNameContext: () => 'token',
  useTabsContext: () => ({ refMap: { token: {} } }),
}));
jest.mock('react-native-reanimated', () => ({
  runOnUI:
    (fn: (...args: unknown[]) => void) =>
    (...args: unknown[]) =>
      fn(...args),
}));

const flushFrames = () =>
  new Promise<void>(resolve => setTimeout(resolve, 350));

describe('useScrollToTopOnChainChange', () => {
  beforeEach(() => mockScrollTo.mockClear());

  it('scrolls to top when the chain changes on the current tab', async () => {
    const { rerender } = renderHook(
      props => useScrollToTopOnChainChange(props),
      { initialProps: { chain: undefined, isCurrentTab: true } },
    );

    rerender({ chain: 'eth', isCurrentTab: true });
    await flushFrames();

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenCalledWith(
      {},
      0,
      0,
      false,
      expect.any(String),
    );
  });

  it('defers the scroll while the tab is not current and runs on refocus', async () => {
    const { rerender } = renderHook(
      props => useScrollToTopOnChainChange(props),
      { initialProps: { chain: undefined, isCurrentTab: true } },
    );

    rerender({ chain: 'eth', isCurrentTab: false });
    await flushFrames();
    expect(mockScrollTo).not.toHaveBeenCalled();

    rerender({ chain: 'eth', isCurrentTab: true });
    await flushFrames();
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });
});
