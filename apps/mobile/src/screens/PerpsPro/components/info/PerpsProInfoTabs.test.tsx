import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/assets2024/icons/perps/IconHistoryCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.account.account': 'Account',
        'page.perps.pro.account.history': 'Account history',
        'page.perps.pro.account.openOrders': 'Open Orders',
        'page.perps.pro.account.positions': 'Positions',
      }[key] || key),
  }),
}));

import { PerpsProInfoTabs } from './PerpsProInfoTabs';

describe('PerpsProInfoTabs', () => {
  it('keeps counted tab labels on one line', () => {
    render(
      <PerpsProInfoTabs
        activeTab="openOrders"
        historyEnabled
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={123}
        positionsCount={45}
      />,
    );

    expect(screen.getByText('Positions (45)').props.numberOfLines).toBe(1);
    expect(screen.getByText('Open Orders (123)').props.numberOfLines).toBe(1);
  });

  it('only dispatches the History action when the SDK capability is enabled', () => {
    const onHistoryPress = jest.fn();
    const view = render(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled={false}
        onChange={jest.fn()}
        onHistoryPress={onHistoryPress}
        openOrdersCount={0}
        positionsCount={0}
      />,
    );
    fireEvent.press(screen.getByTestId('perps-pro-history'));
    expect(onHistoryPress).not.toHaveBeenCalled();

    view.rerender(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        onChange={jest.fn()}
        onHistoryPress={onHistoryPress}
        openOrdersCount={0}
        positionsCount={0}
      />,
    );
    fireEvent.press(screen.getByTestId('perps-pro-history'));
    expect(onHistoryPress).toHaveBeenCalledTimes(1);
  });
});
