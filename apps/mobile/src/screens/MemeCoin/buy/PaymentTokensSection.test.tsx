import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { PaymentAsset } from '../engine/types';
import { PaymentTokensSection } from './PaymentTokensSection';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {}, isLight: true }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (usd: number) => `$${usd.toFixed(2)}`,
}));
jest.mock('@/components/AssetAvatar', () => ({ AssetAvatar: () => null }));
jest.mock('@/assets2024/memecoin/empty-payment-light.svg', () => () => null);
jest.mock('@/assets2024/memecoin/empty-payment-dark.svg', () => () => null);

const eth: PaymentAsset = {
  id: '0xeth',
  chain: 'eth',
  symbol: 'ETH',
  usdValue: 200,
  price: 1,
  isNative: true,
};

const renderSection = (
  selectedAssets: PaymentAsset[],
  paymentBySource: Record<string, number> = {},
) => {
  const onSelectTokens = jest.fn();
  const utils = render(
    <PaymentTokensSection
      selectedAssets={selectedAssets}
      paymentBySource={paymentBySource}
      logoByKey={new Map()}
      onSelectTokens={onSelectTokens}
    />,
  );
  return { ...utils, onSelectTokens };
};

describe('PaymentTokensSection', () => {
  it('shows the empty state without a selection', () => {
    const { getByText, queryByText } = renderSection([]);
    getByText('page.memeCoin.buy.noPaymentToken');
    expect(queryByText('page.memeCoin.buy.estPaymentLabel')).toBeNull();
  });

  it('shows only the payment amount for each selected token', () => {
    const { getByText, queryByText } = renderSection([eth], {
      'eth:0xeth': 80.02,
    });
    getByText('ETH');
    getByText('page.memeCoin.buy.estPaymentLabel');
    getByText('$80.02');
    expect(queryByText('$200.00')).toBeNull();
    expect(queryByText('page.memeCoin.buy.noPaymentToken')).toBeNull();
  });

  it('shows zero for a selected token the plan does not use', () => {
    const { getByText } = renderSection([eth]);
    getByText('$0.00');
  });

  it('opens the picker from Select Tokens', () => {
    const { getByText, onSelectTokens } = renderSection([]);
    fireEvent.press(getByText('page.memeCoin.buy.selectTokens'));
    expect(onSelectTokens).toHaveBeenCalledTimes(1);
  });
});
