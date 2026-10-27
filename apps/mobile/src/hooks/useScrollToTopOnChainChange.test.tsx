import { renderHook } from '@testing-library/react-native';

import { useScrollToTopOnChainChange } from './useScrollToTopOnChainChange';

const mockScrollTo = jest.fn();
const mockNativeScrollTo = jest.fn();
const mockTabsContext: {
  refMap: {
    token: {
      current?: {
        getScrollResponder: () => { scrollTo: typeof mockNativeScrollTo };
      } | null;
    };
  };
  contentInset: { value: number };
} = {
  refMap: { token: {} },
  contentInset: { value: 0 },
};

jest.mock('react-native-collapsible-tab-view/src/hooks', () => ({
  useScroller: () => mockScrollTo,
  useTabNameContext: () => 'token',
  useTabsContext: () => mockTabsContext,
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
  beforeEach(() => {
    mockScrollTo.mockClear();
    mockNativeScrollTo.mockClear();
    mockTabsContext.refMap.token = {};
    mockTabsContext.contentInset.value = 0;
  });

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

  it('scrolls to the visual top instead of the first row', async () => {
    mockTabsContext.contentInset.value = 36;
    mockTabsContext.refMap.token = {
      current: {
        getScrollResponder: () => ({ scrollTo: mockNativeScrollTo }),
      },
    };
    const { rerender } = renderHook(
      props => useScrollToTopOnChainChange(props),
      { initialProps: { chain: undefined, isCurrentTab: true } },
    );

    rerender({ chain: 'eth', isCurrentTab: true });
    await flushFrames();

    expect(mockNativeScrollTo).toHaveBeenCalledWith({
      x: 0,
      y: -36,
      animated: false,
    });
    expect(mockScrollTo).not.toHaveBeenCalled();
  });
});
