import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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
});
