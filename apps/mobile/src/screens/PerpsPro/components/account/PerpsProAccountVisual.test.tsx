import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockOpenFieldExplanation = jest.fn();

jest.mock('@/assets2024/icons/perps/IconUSDC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});
jest.mock('@/assets2024/icons/perps/IconUSDE.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconUSDH.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconUSDT.svg', () => () => null);
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
jest.mock('../common/PerpsProFieldExplanationContext', () => ({
  usePerpsProFieldExplanation: () => mockOpenFieldExplanation,
}));
jest.mock('../common/PerpsProDottedUnderlineText', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PerpsProDottedUnderlineText: ({
      children,
      onPress,
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      testID: string;
    }) =>
      ReactModule.createElement(
        Pressable,
        { onPress, testID },
        ReactModule.createElement(Text, null, children),
      ),
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.account.crossMarginRatio': 'Cross Margin Ratio',
        'page.perps.pro.account.deposit': 'Deposit',
        'page.perps.pro.account.perpsAccountSummary': 'Perps Account Summary',
        'page.perps.pro.account.spot': 'Spot',
        'page.perps.pro.account.totalValue': 'Total Value',
        'page.perps.pro.account.transfer': 'Transfer',
        'page.perps.pro.account.unrealizedPnl': 'Unrealized PNL',
        'page.perps.pro.account.withdraw': 'Withdraw',
      }[key] ?? key),
  }),
}));

import type {
  PerpsAccountAssetRow,
  PerpsAccountViewModel,
} from '../../model/account';
import { PerpsProAccountAssetRow } from './PerpsProAccountAssetRow';
import { PerpsProAccountSummary } from './PerpsProAccountSummary';

const account = {
  assets: [],
  diagnostics: {
    complete: true,
    unpricedNonZeroAssets: [],
    unresolvedDexes: [],
  },
  metrics: [{ key: 'crossMarginRatio', kind: 'ratio', value: '0.2' }],
  mode: 'standard',
  primaryKey: 'balance',
  primaryValue: '190',
  titleKey: 'perpsAccountSummary',
  unrealizedPnl: '10',
} satisfies PerpsAccountViewModel;

const spotUsdc = {
  action: 'transfer',
  available: '10',
  coin: 'USDC',
  fullName: 'USD Coin',
  key: 'spot:USDC',
  ledger: 'spot',
  total: '10',
  usdValue: '10',
} satisfies PerpsAccountAssetRow;

describe('Perps Pro account visual contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows only Total Value and Unrealized PNL in the summary for now', () => {
    render(
      <PerpsProAccountSummary
        account={account}
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    );

    expect(screen.getByText('Total Value')).toBeTruthy();
    expect(screen.getByText('Unrealized PNL')).toBeTruthy();
    expect(screen.queryByText('Perps Account Summary')).toBeNull();
    expect(screen.queryByText('Cross Margin Ratio')).toBeNull();
  });

  it('keeps the design summary and action geometry', () => {
    render(
      <PerpsProAccountSummary
        account={account}
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-account-summary').props.style,
      ),
    ).toMatchObject({
      gap: 16,
      marginHorizontal: 15,
      marginTop: 16,
      padding: 12,
    });
    expect(
      StyleSheet.flatten(
        screen.getByText('Total Value').parent?.parent?.props.style,
      ),
    ).toMatchObject({ gap: 4 });
    expect(
      StyleSheet.flatten(
        screen.getByText('Unrealized PNL').parent?.parent?.props.style,
      ),
    ).toMatchObject({ alignItems: 'flex-end', gap: 4 });

    const buttons = screen.getAllByRole('button');
    expect(StyleSheet.flatten(buttons[0].props.style)).toMatchObject({
      height: 34,
    });
    expect(StyleSheet.flatten(buttons[1].props.style)).toMatchObject({
      height: 34,
    });
    const actionRow = screen.getByTestId('perps-pro-account-summary')
      .children[1] as { props: { style?: object } };
    expect(StyleSheet.flatten(actionRow.props.style)).toMatchObject({ gap: 8 });
  });

  it('explains Total Value only for a Unified Account', () => {
    const screen = render(
      <PerpsProAccountSummary
        account={{ ...account, mode: 'unified' }}
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-total-value-explanation'));
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith('totalValue');

    screen.rerender(
      <PerpsProAccountSummary
        account={account}
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    );
    expect(
      screen.queryByTestId('perps-pro-total-value-explanation'),
    ).toBeNull();
  });

  it('exposes Transfer only for the actionable standard Spot USDC row', () => {
    const onTransfer = jest.fn();
    render(
      <PerpsProAccountAssetRow
        asset={spotUsdc}
        onSwap={jest.fn()}
        onTransfer={onTransfer}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-transfer'));
    expect(onTransfer).toHaveBeenCalledWith(spotUsdc);
  });

  it('keeps the 8px asset rhythm outside the 92px row', () => {
    render(
      <PerpsProAccountAssetRow
        asset={spotUsdc}
        onSwap={jest.fn()}
        onTransfer={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-asset-spot:USDC').props.style,
      ),
    ).toMatchObject({
      gap: 12,
      marginHorizontal: 15,
      marginTop: 8,
      minHeight: 92,
      paddingVertical: 8,
    });
  });
});
