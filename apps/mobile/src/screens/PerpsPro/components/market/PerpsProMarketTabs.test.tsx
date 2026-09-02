import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const mockScrollTo = jest.fn();

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: { Text: ReactNative.Text, View: ReactNative.View },
    Easing: { bezier: jest.fn(() => jest.fn()) },
    ReduceMotion: { System: 'system' },
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (target: number) => target,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    ScrollView: ReactModule.forwardRef(
      (
        { children, ...props }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          scrollTo: mockScrollTo,
        }));
        return ReactModule.createElement(ReactNative.View, props, children);
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
const indicatorPosition = { value: 0 } as SharedValue<number>;

describe('PerpsProMarketTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    indicatorPosition.value = 0;
  });

  it('positions a restored trailing tab without animating its first mount', () => {
    const onChange = jest.fn();
    render(
      <PerpsProMarketTabs
        activeTab="last-category"
        indicatorPosition={indicatorPosition}
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
      <PerpsProMarketTabs
        activeTab="all"
        indicatorPosition={indicatorPosition}
        onChange={onChange}
        tabs={tabs}
      />,
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
        indicatorPosition={indicatorPosition}
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
        indicatorPosition={indicatorPosition}
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
        indicatorPosition={indicatorPosition}
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
        indicatorPosition={indicatorPosition}
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
      <PerpsProMarketTabs
        activeTab="all"
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        tabs={tabs}
      />,
    );

    const frames = [
      { id: 'all', width: 40, x: 15 },
      { id: 'layer-one', width: 70, x: 67 },
      { id: 'meme', width: 50, x: 149 },
      { id: 'last-category', width: 100, x: 211 },
    ] as const;
    act(() => {
      frames.forEach(frame => {
        fireEvent(
          screen.getByTestId(`perps-pro-market-tab-${frame.id}`),
          'layout',
          {
            nativeEvent: {
              layout: { height: 34, width: frame.width, x: frame.x, y: 0 },
            },
          },
        );
      });
    });

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
        screen.getByTestId('perps-pro-market-tab-indicator', {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-body',
      bottom: 1,
      height: 2,
      left: 15,
      width: 40,
    });
  });

  it('keeps one indicator and interpolates real tab frames in both directions', () => {
    indicatorPosition.value = 1;
    const onChange = jest.fn();
    const view = render(
      <PerpsProMarketTabs
        activeTab="layer-one"
        indicatorPosition={indicatorPosition}
        onChange={onChange}
        tabs={tabs}
      />,
    );

    act(() => {
      [
        { id: 'all', width: 40, x: 15 },
        { id: 'layer-one', width: 70, x: 67 },
        { id: 'meme', width: 50, x: 149 },
        { id: 'last-category', width: 100, x: 211 },
      ].forEach(frame => {
        fireEvent(
          screen.getByTestId(`perps-pro-market-tab-${frame.id}`),
          'layout',
          {
            nativeEvent: {
              layout: { height: 34, width: frame.width, x: frame.x, y: 0 },
            },
          },
        );
      });
    });

    expect(
      screen.getAllByTestId('perps-pro-market-tab-indicator', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(1);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-tab-indicator', {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toMatchObject({
      opacity: 1,
      left: 67,
      width: 70,
    });

    indicatorPosition.value = 1.75;
    view.rerender(
      <PerpsProMarketTabs
        activeTab="meme"
        indicatorPosition={indicatorPosition}
        onChange={onChange}
        tabs={tabs}
      />,
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-tab-indicator', {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toMatchObject({
      left: 128.5,
      width: 55,
    });

    indicatorPosition.value = 1.25;
    view.rerender(
      <PerpsProMarketTabs
        activeTab="layer-one"
        indicatorPosition={indicatorPosition}
        onChange={onChange}
        tabs={tabs}
      />,
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-tab-indicator', {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toMatchObject({
      left: 87.5,
      width: 65,
    });
    expect(
      screen.getByTestId('perps-pro-market-tab-all').props.accessibilityState,
    ).toEqual({ selected: false });
  });

  it('derives the visible label highlight from the indicator presentation', () => {
    indicatorPosition.value = 1;
    render(
      <PerpsProMarketTabs
        activeTab="all"
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        tabs={tabs}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByText('All').props.style),
    ).toMatchObject({
      color: 'neutral-secondary',
      fontWeight: '400',
    });
    expect(
      StyleSheet.flatten(screen.getByText('Layer 1').props.style),
    ).toMatchObject({
      color: 'neutral-title-1',
      fontWeight: '500',
    });
    expect(
      screen.getByTestId('perps-pro-market-tab-all').props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId('perps-pro-market-tab-layer-one').props
        .accessibilityState,
    ).toEqual({ selected: false });
    expect(
      screen
        .getAllByText('Layer 1', { includeHiddenElements: true })
        .map(label => StyleSheet.flatten(label.props.style)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontWeight: '500', opacity: 0 }),
        expect.objectContaining({ position: 'absolute' }),
      ]),
    );
  });

  it('hides stale frames until a changed tab layout is measured again', () => {
    indicatorPosition.value = 1;
    const view = render(
      <View>
        <PerpsProMarketTabs
          activeTab="layer-one"
          indicatorPosition={indicatorPosition}
          key="with-leading-tab"
          onChange={jest.fn()}
          tabs={tabs}
        />
      </View>,
    );

    act(() => {
      [
        { id: 'all', width: 40, x: 15 },
        { id: 'layer-one', width: 70, x: 67 },
        { id: 'meme', width: 50, x: 149 },
        { id: 'last-category', width: 100, x: 211 },
      ].forEach(frame => {
        fireEvent(
          view.getByTestId(`perps-pro-market-tab-${frame.id}`),
          'layout',
          {
            nativeEvent: {
              layout: { height: 34, width: frame.width, x: frame.x, y: 0 },
            },
          },
        );
      });
    });
    expect(
      StyleSheet.flatten(
        view.getByTestId('perps-pro-market-tab-indicator', {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toMatchObject({ opacity: 1 });

    indicatorPosition.value = 0;
    view.rerender(
      <View>
        <PerpsProMarketTabs
          activeTab="layer-one"
          indicatorPosition={indicatorPosition}
          key="without-leading-tab"
          onChange={jest.fn()}
          tabs={tabs.slice(1)}
        />
      </View>,
    );
    expect(
      StyleSheet.flatten(
        view.getByTestId('perps-pro-market-tab-indicator', {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toMatchObject({ opacity: 0, width: 0 });

    act(() => {
      [
        { id: 'layer-one', width: 70, x: 15 },
        { id: 'meme', width: 50, x: 97 },
        { id: 'last-category', width: 100, x: 159 },
      ].forEach(frame => {
        fireEvent(
          view.getByTestId(`perps-pro-market-tab-${frame.id}`),
          'layout',
          {
            nativeEvent: {
              layout: { height: 34, width: frame.width, x: frame.x, y: 0 },
            },
          },
        );
      });
    });
    expect(
      StyleSheet.flatten(
        view.getByTestId('perps-pro-market-tab-indicator', {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toMatchObject({
      opacity: 1,
      left: 15,
      width: 70,
    });
  });
});
