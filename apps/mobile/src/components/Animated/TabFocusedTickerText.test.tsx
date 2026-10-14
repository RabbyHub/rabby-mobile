import React from 'react';
import { act, render } from '@testing-library/react-native';

import { RenderActivityBoundary } from '@/hooks/storeActivity/RenderActivityBoundary';
import TabFocusedTickerText from './TabFocusedTickerText';

let mockFocusedTab = 'overview';
let mockIsScreenFocused = true;
const mockFocusListeners = new Set<() => void>();
const mockSubscribeToFocus = (listener: () => void) => {
  mockFocusListeners.add(listener);
  return () => mockFocusListeners.delete(listener);
};
const mockTickerMount = jest.fn();
const mockTickerUnmount = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () =>
    require('react').useSyncExternalStore(
      mockSubscribeToFocus,
      () => mockIsScreenFocused,
      () => mockIsScreenFocused,
    ),
}));
jest.mock('react-native-collapsible-tab-view', () => ({
  useFocusedTab: () =>
    require('react').useSyncExternalStore(
      mockSubscribeToFocus,
      () => mockFocusedTab,
      () => mockFocusedTab,
    ),
}));
jest.mock('./RefreshNudgedTickerText', () => {
  const ReactModule = require('react');
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: function MockRefreshTicker(props: object) {
      ReactModule.useEffect(() => {
        mockTickerMount();
        return () => mockTickerUnmount();
      }, []);
      return ReactModule.createElement(View, {
        ...props,
        testID: 'refresh-ticker',
      });
    },
  };
});

function updateFocus({
  tabName = mockFocusedTab,
  screenFocused = mockIsScreenFocused,
}: {
  tabName?: string;
  screenFocused?: boolean;
}) {
  act(() => {
    mockFocusedTab = tabName;
    mockIsScreenFocused = screenFocused;
    [...mockFocusListeners].forEach(listener => listener());
  });
}

// Component contracts: focus hooks are reactive native-boundary fakes, and the
// inner ticker is a prop boundary. These do not prove native animation or timing.
describe('TabFocusedTickerText', () => {
  beforeEach(() => {
    mockFocusedTab = 'overview';
    mockIsScreenFocused = true;
    mockTickerMount.mockClear();
    mockTickerUnmount.mockClear();
  });

  it('updates its leaf through a frozen render gate without rerendering the memo parent', () => {
    const parentRender = jest.fn();
    const MemoParent = React.memo(({ value }: { value: string }) => {
      parentRender(value);
      return (
        <TabFocusedTickerText
          tabName="overview"
          value={{ value }}
          lineHeight={42}
          fitWidth
        />
      );
    });
    const tree = (active: boolean, value: string) => (
      <RenderActivityBoundary active={active} label="tab-ticker-test">
        <MemoParent value={value} />
      </RenderActivityBoundary>
    );
    const view = render(tree(true, '$12.34'));
    const ticker = view.getByTestId('refresh-ticker');
    expect(ticker.props.animate).toBe(true);

    view.rerender(tree(false, '$56.78'));
    const frozenParentRenderCount = parentRender.mock.calls.length;
    view.rerender(tree(false, '$90.12'));
    expect(parentRender).toHaveBeenCalledTimes(frozenParentRenderCount);
    expect(ticker.props.value.value).toBe('$56.78');

    updateFocus({ tabName: 'token' });
    expect(ticker.props.animate).toBe(false);
    updateFocus({ tabName: 'overview' });
    expect(ticker.props.animate).toBe(true);
    expect(parentRender).toHaveBeenCalledTimes(frozenParentRenderCount);
    expect(ticker.props.value.value).toBe('$56.78');
    expect(ticker.props.fitWidth).toBe(true);
    expect(ticker.props.lineHeight).toBe(42);
    expect(ticker.props.tabName).toBeUndefined();
    expect(view.getByTestId('refresh-ticker')).toBe(ticker);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();

    view.rerender(tree(true, '$90.12'));
    expect(ticker.props.value.value).toBe('$90.12');
    expect(ticker.props.animate).toBe(true);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(mockTickerUnmount).toHaveBeenCalledTimes(1);
    expect(mockFocusListeners.size).toBe(0);
  });

  it('disables on screen blur and restores on refocus only for the matching tab', () => {
    const view = render(
      <TabFocusedTickerText
        tabName="overview"
        value={{ value: '$12.34' }}
        lineHeight={42}
      />,
    );
    const ticker = view.getByTestId('refresh-ticker');
    expect(ticker.props.animate).toBe(true);

    updateFocus({ screenFocused: false });
    expect(ticker.props.animate).toBe(false);
    updateFocus({ screenFocused: true });
    expect(ticker.props.animate).toBe(true);
    updateFocus({ tabName: 'token', screenFocused: false });
    expect(ticker.props.animate).toBe(false);
    updateFocus({ screenFocused: true });
    expect(ticker.props.animate).toBe(false);
    updateFocus({ tabName: 'overview' });
    expect(ticker.props.animate).toBe(true);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });

  it('honors caller animate=false across tab and screen focus changes', () => {
    const view = render(
      <TabFocusedTickerText
        tabName="overview"
        animate={false}
        value={{ value: '$12.34' }}
        lineHeight={42}
      />,
    );
    const ticker = view.getByTestId('refresh-ticker');
    expect(ticker.props.animate).toBe(false);
    updateFocus({ tabName: 'token', screenFocused: false });
    expect(ticker.props.animate).toBe(false);
    updateFocus({ tabName: 'overview', screenFocused: true });
    expect(ticker.props.animate).toBe(false);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });
});
