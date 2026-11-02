import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { formatTokenAmount } from '@/utils/number';
import { ExternalTokenRow } from './TokenRenderItems';

// Use the exact workspace formatter source when dist output is absent; never
// build package artifacts as a side effect of this focused component test.
jest.mock(
  '@rabby-wallet/biz-utils/dist/isomorphic/biz-number',
  () =>
    jest.requireActual(
      '../../../../../../../packages/biz-utils/src/isomorphic/biz-number',
    ),
  { virtual: true },
);
jest.mock('@/hooks/theme', () => {
  const colors = new Proxy({}, { get: () => '#123456' });
  return {
    useTheme2024: ({ getStyle }: any) => ({
      colors2024: colors,
      styles: getStyle.getStyles({ colors2024: colors, isLight: false }),
    }),
  };
});
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyles: unknown) => ({ getStyles }),
  makeTriangleStyle: () => ({}),
}));
jest.mock('@/components/AssetAvatar', () => ({ AssetAvatar: () => null }));
jest.mock('@/assets/icons/common/arrow-right-cc.svg', () => () => null);
jest.mock('@/hooks/useCexSupportList', () => ({
  useCexSupportList: () => ({ list: [] }),
}));
jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token: { symbol: string }) => token.symbol,
}));
jest.mock('@/utils/address', () => ({ ellipsisAddress: () => 'contract' }));
jest.mock('@/utils/lpToken', () => ({ isLpToken: () => false }));
jest.mock('../../utils/price', () => ({ formatUsdValueKMB: () => '$0' }));
jest.mock('../AccountOverview', () => ({ AccountOverview: () => null }));
jest.mock('../LpTokenIcon', () => () => null);
jest.mock('../LpTokenSwitch', () => () => null);
jest.mock('react-native-animateable-text', () => require('react-native').Text);
jest.mock('@rneui/base', () => ({ Text: require('react-native').Text }));
jest.mock('react-native-gesture-handler', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
}));

// Component-unit coverage: real row, formatter and Typography; unrelated asset
// decorations/services are mocked. Native text measurement remains device QA.
const token = {
  id: 'custom_1234',
  chain: 'custom_1234',
  symbol: 'TCH',
  amount: 4.242424242424243e50,
  decimals: 18,
  price: 0,
  usd_value: 0,
} as TokenItem;

describe('ExternalTokenRow balance layout', () => {
  it.each([token.amount, 12.3456, 0])(
    'bounds balance %s to one existing 100px line without shortening its value',
    amount => {
      const view = render(
        <ExternalTokenRow
          data={{ ...token, amount }}
          rightInfoMode="balance"
        />,
      );
      const balance = view.getByText(formatTokenAmount(amount));
      expect(balance.props.numberOfLines).toBe(1);
      expect(balance.props.ellipsizeMode).toBe('tail');
      expect(StyleSheet.flatten(balance.props.style)).toMatchObject({
        maxWidth: 100,
        textAlign: 'right',
      });
      expect(balance.props.children).toBe(formatTokenAmount(amount));
    },
  );

  it('passes the original large-balance token to selection without mutation', () => {
    const onTokenPress = jest.fn();
    const originalAmount = token.amount;
    const view = render(
      <ExternalTokenRow
        data={token}
        rightInfoMode="balance"
        onTokenPress={onTokenPress}
      />,
    );
    fireEvent.press(view.getByText('TCH'));
    expect(onTokenPress).toHaveBeenCalledTimes(1);
    expect(onTokenPress.mock.calls[0][0]).toBe(token);
    expect(token.amount).toBe(originalAmount);
  });

  it('preserves the existing gas-token bottom-row action', () => {
    const onPressBottomRow = jest.fn();
    const onTokenPress = jest.fn();
    const stopPropagation = jest.fn();
    const view = render(
      <ExternalTokenRow
        data={token}
        rightInfoMode="balance"
        touchable={false}
        onPressBottomRow={onPressBottomRow}
        onTokenPress={onTokenPress}
      />,
    );
    fireEvent.press(view.getByText('Gas Token'), { stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onPressBottomRow).toHaveBeenCalledTimes(1);
    expect(onTokenPress).not.toHaveBeenCalled();
  });

  it('does not change the ordinary price-change branch', () => {
    const view = render(
      <ExternalTokenRow
        data={{ ...token, price: 2, price_24h_change: 0.12 }}
        rightInfoMode="priceChange"
      />,
    );
    const priceChange = view.getByText('+12.00%');
    expect(priceChange.props.numberOfLines).toBeUndefined();
    expect(priceChange.props.ellipsizeMode).toBeUndefined();
    expect(view.queryByText(formatTokenAmount(token.amount))).toBeNull();
  });
});
