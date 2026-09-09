import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockShowPortfolioBreakdown = jest.fn();
let mockHasNonPerpsAssets = true;
let mockIsLight = true;

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
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) =>
          // The real dotted primitive needs a valid SVG stroke color.
          key === 'neutral-body'
            ? mockIsLight
              ? '#3e495e'
              : '#d3d8e0'
            : String(key),
      },
    );
    return {
      colors2024,
      isLight: mockIsLight,
      styles: getStyle({ colors2024, isLight: mockIsLight }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock(
  '@/screens/PerpsShared/components/PerpsPortfolioBreakdownExplanation',
  () => ({
    useShowPerpsPortfolioBreakdown: () => ({
      hasNonPerpsAssets: mockHasNonPerpsAssets,
      showPortfolioBreakdown: mockShowPortfolioBreakdown,
    }),
  }),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.account.crossMarginRatio': 'Cross Margin Ratio',
        'page.perps.pro.account.deposit': 'Deposit',
        'page.perps.pro.account.perpsAccountSummary': 'Perps Account Summary',
        'page.perps.pro.account.perps': 'Perps',
        'page.perps.pro.account.spot': 'Spot',
        'page.perps.pro.account.swap': 'Swap',
        'page.perps.PerpsCard.portfolioValue': 'Portfolio Value',
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
  total: '10.126',
  usdValue: '10',
} satisfies PerpsAccountAssetRow;

describe('Perps Pro account visual contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasNonPerpsAssets = true;
    mockIsLight = true;
  });

  it('shows only Portfolio Value and Unrealized PNL in the summary for now', () => {
    render(
      <PerpsProAccountSummary
        account={account}
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    );

    expect(screen.getByText('Portfolio Value')).toBeTruthy();
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

    const summary = screen.getByTestId('perps-pro-account-summary');
    const summaryStyle = StyleSheet.flatten(summary.props.style);
    expect(summaryStyle).toMatchObject({
      gap: 12,
      marginHorizontal: 16,
      marginTop: 16,
      paddingBottom: 16,
    });
    expect(summaryStyle.backgroundColor).toBeUndefined();
    expect(summaryStyle.borderWidth).toBeUndefined();
    expect(summaryStyle.borderRadius).toBeUndefined();
    const summaryRow = summary.children[0] as {
      props: { style?: object };
    };
    expect(StyleSheet.flatten(summaryRow.props.style)).toMatchObject({
      paddingHorizontal: 4,
    });
    expect(
      StyleSheet.flatten(
        screen.getByText('$190.00').parent?.parent?.props.style,
      ),
    ).toMatchObject({ gap: 4 });
    expect(
      StyleSheet.flatten(
        screen.getByText('Unrealized PNL').parent?.parent?.props.style,
      ),
    ).toMatchObject({ alignItems: 'flex-end', gap: 4 });

    const actionButtons = screen
      .getAllByRole('button')
      .filter(button => StyleSheet.flatten(button.props.style)?.height === 36);
    expect(actionButtons).toHaveLength(2);
    const actionRow = screen.getByTestId('perps-pro-account-summary')
      .children[1] as { props: { style?: object } };
    expect(StyleSheet.flatten(actionRow.props.style)).toMatchObject({
      gap: 12,
    });
    for (const label of ['Portfolio Value', 'Unrealized PNL']) {
      expect(
        StyleSheet.flatten(screen.getByText(label).props.style),
      ).toMatchObject({
        color: '#3e495e',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 18,
      });
    }
  });

  it.each([true, false])(
    'keeps the approved funding colors and callbacks when isLight=%s',
    isLight => {
      mockIsLight = isLight;
      const onDeposit = jest.fn();
      const onWithdraw = jest.fn();
      render(
        <PerpsProAccountSummary
          account={account}
          onDeposit={onDeposit}
          onWithdraw={onWithdraw}
        />,
      );

      for (const label of ['Deposit', 'Withdraw']) {
        const button = screen.getByRole('button', { name: label });
        expect(StyleSheet.flatten(button.props.style)).toMatchObject({
          backgroundColor: 'rgba(80, 210, 193, 0.1)',
          borderRadius: 8,
          flex: 1,
          height: 36,
        });
        expect(
          StyleSheet.flatten(screen.getByText(label).props.style),
        ).toMatchObject({
          color: '#23C0B0',
          fontSize: 16,
          fontWeight: '700',
          lineHeight: 20,
        });
        fireEvent.press(button);
      }
      expect(onDeposit).toHaveBeenCalledTimes(1);
      expect(onWithdraw).toHaveBeenCalledTimes(1);
      expect(mockShowPortfolioBreakdown).not.toHaveBeenCalled();
    },
  );

  it('lets large signed balances wrap at the approved size inside their columns', () => {
    render(
      <PerpsProAccountSummary
        account={{
          ...account,
          primaryValue: '1111111111.11',
          unrealizedPnl: '-888888888.88',
        }}
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    );

    for (const value of ['$1,111,111,111.11', '-$888,888,888.88']) {
      const text = screen.getByText(value);
      expect(text.props.adjustsFontSizeToFit).toBeUndefined();
      expect(text.props.numberOfLines).toBeUndefined();
      expect(StyleSheet.flatten(text.props.style)).toMatchObject({
        fontVariant: ['tabular-nums'],
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 22,
      });
      expect(
        StyleSheet.flatten(text.parent?.parent?.props.style),
      ).toMatchObject({ flex: 1, minWidth: 0 });
    }
    expect(
      StyleSheet.flatten(screen.getByText('Portfolio Value').props.style)
        .fontVariant,
    ).toBeUndefined();
  });

  it.each(['standard', 'unified', 'portfolioMargin'] as const)(
    'reuses the Portfolio Value breakdown for %s accounts',
    mode => {
      render(
        <PerpsProAccountSummary
          account={{ ...account, mode }}
          onDeposit={jest.fn()}
          onWithdraw={jest.fn()}
        />,
      );

      const label = screen.getByText('Portfolio Value');
      fireEvent(label, 'textLayout', {
        nativeEvent: { lines: [{ ascender: 13, width: 84, y: 0 }] },
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-dotted-underline').props.style,
        ).width,
      ).toBe(84);
      fireEvent.press(label);
      expect(mockShowPortfolioBreakdown).toHaveBeenCalledWith(190);
    },
  );

  it('hides the breakdown trigger when the account has no non-Perps assets', () => {
    mockHasNonPerpsAssets = false;
    render(
      <PerpsProAccountSummary
        account={account}
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    );
    expect(
      screen.queryByTestId('perps-pro-portfolio-value-breakdown'),
    ).toBeNull();
    expect(screen.queryByTestId('perps-pro-dotted-underline')).toBeNull();
    fireEvent.press(screen.getByText('Portfolio Value'));
    expect(mockShowPortfolioBreakdown).not.toHaveBeenCalled();
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
    expect(screen.getByText('10.13')).toBeTruthy();
  });

  it('aligns the single-line identity, balances and action in a compact row', () => {
    render(
      <PerpsProAccountAssetRow
        asset={spotUsdc}
        onSwap={jest.fn()}
        onTransfer={jest.fn()}
      />,
    );

    const assetRow = screen.getByTestId('perps-pro-asset-spot:USDC');
    const rowStyle = StyleSheet.flatten(assetRow.props.style);
    expect(rowStyle).toMatchObject({
      alignItems: 'center',
      backgroundColor: 'neutral-bg-1',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      flexDirection: 'row',
      gap: 16,
      marginHorizontal: 16,
      minHeight: 62,
      paddingLeft: 4,
      paddingVertical: 12,
    });
    expect(rowStyle.borderBottomWidth).toBeUndefined();
    expect(rowStyle.marginTop).toBeUndefined();
    const rowStyles = assetRow
      .findAll(node => node.props.style != null)
      .map(node => StyleSheet.flatten(node.props.style));
    const coin = screen.getByText('USDC');
    expect(rowStyles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 1,
          minWidth: 0,
        }),
        expect.objectContaining({
          alignItems: 'center',
          flexShrink: 0,
          gap: 8,
        }),
        expect.objectContaining({ gap: 2 }),
      ]),
    );
    expect(StyleSheet.flatten(coin.props.style)).toMatchObject({
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    });
    expect(screen.queryByText('USD Coin')).toBeNull();
    expect(screen.getByText('Spot')).toBeTruthy();
    expect(
      assetRow.findAll(
        node => node.props.width === 36 && node.props.height === 36,
      ),
    ).not.toHaveLength(0);
    expect(StyleSheet.flatten(screen.getByText('$10.00').props.style)).toEqual(
      expect.objectContaining({
        color: 'neutral-secondary',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 18,
      }),
    );
    expect(
      StyleSheet.flatten(screen.getByRole('button').props.style),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-5',
      borderRadius: 6,
      height: 30,
      width: 68,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Transfer').props.style),
    ).toMatchObject({
      color: '#3e495e',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    });
  });

  it('keeps Swap identity and lets large amounts wrap without shrinking', () => {
    const onSwap = jest.fn();
    const onTransfer = jest.fn();
    render(
      <PerpsProAccountAssetRow
        asset={{
          ...spotUsdc,
          action: 'swap',
          total: '1111111111.11',
          usdValue: '1111111111.11',
        }}
        onSwap={onSwap}
        onTransfer={onTransfer}
      />,
    );

    for (const amount of ['1,111,111,111.11', '$1,111,111,111.11']) {
      const value = screen.getByText(amount);
      expect(value.props.adjustsFontSizeToFit).toBeUndefined();
      expect(value.props.numberOfLines).toBeUndefined();
      expect(StyleSheet.flatten(value.props.style).fontVariant).toEqual([
        'tabular-nums',
      ]);
      expect(
        StyleSheet.flatten(value.parent?.parent?.props.style),
      ).toMatchObject({
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-end',
      });
    }
    fireEvent.press(screen.getByRole('button', { name: 'Swap' }));
    expect(onSwap).toHaveBeenCalledWith('USDC');
    expect(onTransfer).not.toHaveBeenCalled();
  });

  it('keeps the Perps ledger identity and reserves the action column without a fake button', () => {
    render(
      <PerpsProAccountAssetRow
        asset={{
          ...spotUsdc,
          action: 'none',
          key: 'perps:USDC',
          ledger: 'perps',
        }}
        onSwap={jest.fn()}
        onTransfer={jest.fn()}
      />,
    );

    expect(screen.getByText('Perps')).toBeTruthy();
    expect(screen.queryByText('USD Coin')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    const row = screen.getByTestId('perps-pro-asset-perps:USDC');
    expect(
      row.findAll(node => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.width === 68 && style?.height === 30;
      }),
    ).not.toHaveLength(0);
  });
});
