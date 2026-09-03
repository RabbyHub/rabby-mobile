import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.openOrders.basic': 'Basic',
        'page.perps.pro.openOrders.cancelAll': 'Cancel All',
        'page.perps.pro.openOrders.conditional': 'Conditional',
      }[key] || key),
  }),
}));

jest.mock('../info/PerpsProInfoControls', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProInfoControls: ({ testID }: { testID: string }) =>
      ReactModule.createElement(View, { testID }),
  };
});

import { PerpsProOpenOrdersControls } from './PerpsProOpenOrdersControls';

describe('PerpsProOpenOrdersControls', () => {
  it('renders the Hide/Cancel controls before the Basic/Conditional tabs', () => {
    const rendered = render(
      <PerpsProOpenOrdersControls
        basicCount={2}
        category="basic"
        conditionalCount={1}
        hideOtherSymbols={false}
        isCancelAllPending={false}
        onCancelAll={jest.fn()}
        onSetCategory={jest.fn()}
        onToggleHideOtherSymbols={jest.fn()}
      />,
    );

    expect(rendered.toJSON()).toMatchObject({
      children: [
        { props: { testID: 'perps-pro-open-orders-controls' } },
        { props: { testID: 'perps-pro-open-orders-tabs' } },
      ],
    });
  });

  it('uses the latest neutral 24px tab treatment and changes category', () => {
    const onSetCategory = jest.fn();
    render(
      <PerpsProOpenOrdersControls
        basicCount={2}
        category="basic"
        conditionalCount={1}
        hideOtherSymbols={false}
        isCancelAllPending={false}
        onCancelAll={jest.fn()}
        onSetCategory={onSetCategory}
        onToggleHideOtherSymbols={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-orders-tab-basic').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-line',
      borderRadius: 6,
      height: 24,
      paddingHorizontal: 8,
    });
    expect(screen.getByText('Basic (2)').props.style).toMatchObject({
      color: 'neutral-body',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-orders-tab-conditional').props.style,
      ),
    ).toMatchObject({
      borderRadius: 6,
      height: 24,
      paddingHorizontal: 8,
    });
    expect(screen.getByText('Conditional (1)').props.style).toMatchObject({
      color: 'neutral-foot',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
    });

    fireEvent.press(
      screen.getByTestId('perps-pro-open-orders-tab-conditional'),
    );
    expect(onSetCategory).toHaveBeenCalledWith('conditional');
  });
});
