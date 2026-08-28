import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockScrollTo = jest.fn();

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    ScrollView: ReactModule.forwardRef(
      (
        { children, ...props }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          scrollTo: mockScrollTo,
        }));
        return ReactModule.createElement(View, props, children);
      },
    ),
  };
});

import { PerpsProMarketTabs } from './PerpsProMarketTabs';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'layer-one', label: 'Layer 1' },
  { id: 'meme', label: 'Meme' },
  { id: 'last-category', label: 'Last category' },
] as const;

describe('PerpsProMarketTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('positions a restored trailing tab without animating its first mount', () => {
    const onChange = jest.fn();
    render(
      <PerpsProMarketTabs
        activeTab="last-category"
        onChange={onChange}
        tabs={tabs}
      />,
    );
    const strip = screen.getByTestId('perps-pro-market-tabs');
    const lastTab = screen.getByTestId('perps-pro-market-tab-last-category');

    act(() => {
      fireEvent(strip, 'layout', {
        nativeEvent: { layout: { height: 40, width: 200, x: 0, y: 0 } },
      });
      strip.props.onContentSizeChange(540, 40);
      fireEvent(lastTab, 'layout', {
        nativeEvent: { layout: { height: 40, width: 70, x: 450, y: 0 } },
      });
    });

    expect(mockScrollTo).toHaveBeenCalledWith({
      animated: false,
      x: 340,
    });
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(lastTab.props.accessibilityState).toEqual({ selected: true });
  });

  it('animates a later active-tab change after the initial position is ready', () => {
    const onChange = jest.fn();
    const view = render(
      <PerpsProMarketTabs activeTab="all" onChange={onChange} tabs={tabs} />,
    );
    const strip = screen.getByTestId('perps-pro-market-tabs');
    const allTab = screen.getByTestId('perps-pro-market-tab-all');
    const lastTab = screen.getByTestId('perps-pro-market-tab-last-category');

    act(() => {
      fireEvent(strip, 'layout', {
        nativeEvent: { layout: { height: 40, width: 200, x: 0, y: 0 } },
      });
      strip.props.onContentSizeChange(540, 40);
      fireEvent(allTab, 'layout', {
        nativeEvent: { layout: { height: 40, width: 50, x: 15, y: 0 } },
      });
      fireEvent(lastTab, 'layout', {
        nativeEvent: { layout: { height: 40, width: 70, x: 450, y: 0 } },
      });
    });

    expect(mockScrollTo).toHaveBeenLastCalledWith({
      animated: false,
      x: 0,
    });

    view.rerender(
      <PerpsProMarketTabs
        activeTab="last-category"
        onChange={onChange}
        tabs={tabs}
      />,
    );

    expect(mockScrollTo).toHaveBeenLastCalledWith({
      animated: true,
      x: 340,
    });
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
    expect(lastTab.props.accessibilityState).toEqual({ selected: true });
  });

  it('repositions the same active tab without animation when geometry changes', () => {
    render(
      <PerpsProMarketTabs
        activeTab="last-category"
        onChange={jest.fn()}
        tabs={tabs}
      />,
    );
    const strip = screen.getByTestId('perps-pro-market-tabs');
    const lastTab = screen.getByTestId('perps-pro-market-tab-last-category');

    act(() => {
      fireEvent(strip, 'layout', {
        nativeEvent: { layout: { height: 40, width: 200, x: 0, y: 0 } },
      });
      strip.props.onContentSizeChange(540, 40);
      fireEvent(lastTab, 'layout', {
        nativeEvent: { layout: { height: 40, width: 70, x: 450, y: 0 } },
      });
    });
    act(() => {
      fireEvent(strip, 'layout', {
        nativeEvent: { layout: { height: 40, width: 220, x: 0, y: 0 } },
      });
    });

    expect(mockScrollTo).toHaveBeenNthCalledWith(1, {
      animated: false,
      x: 340,
    });
    expect(mockScrollTo).toHaveBeenNthCalledWith(2, {
      animated: false,
      x: 320,
    });
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
  });

  it('keeps direct tab presses controlled by the selector', () => {
    const onChange = jest.fn();
    const view = render(
      <PerpsProMarketTabs
        activeTab="last-category"
        onChange={onChange}
        tabs={tabs}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-tab-all'));
    expect(onChange).toHaveBeenCalledWith('all');
    expect(
      screen.getByTestId('perps-pro-market-tab-all').props.accessibilityState,
    ).toEqual({ selected: false });

    view.rerender(
      <PerpsProMarketTabs
        activeTab="all"
        onChange={onChange}
        tabs={tabs.slice(0, 2)}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-market-tab-all').props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.queryByTestId('perps-pro-market-tab-last-category'),
    ).toBeNull();
  });

  it('matches the approved compact typography, spacing and divider contract', () => {
    render(
      <PerpsProMarketTabs activeTab="all" onChange={jest.fn()} tabs={tabs} />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-tabs').props.style,
      ),
    ).toMatchObject({
      borderBottomColor: 'neutral-bg-5',
      borderBottomWidth: 1,
      height: 34,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-tab-all').props.style,
      ),
    ).toMatchObject({ height: 34, paddingHorizontal: 2, paddingTop: 8 });
    expect(
      StyleSheet.flatten(screen.getByText('All').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-tab-indicator').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-body',
      bottom: 1,
      height: 2,
      width: 20,
    });
  });
});
