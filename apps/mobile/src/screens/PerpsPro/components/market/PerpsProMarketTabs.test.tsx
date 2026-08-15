import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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

  it('keeps a Pager-selected trailing tab fully visible within the strip', () => {
    const onChange = jest.fn();
    const view = render(
      <PerpsProMarketTabs activeTab="all" onChange={onChange} tabs={tabs} />,
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
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(lastTab.props.accessibilityState).toEqual({ selected: true });
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
});
