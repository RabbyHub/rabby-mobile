import { render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/assets2024/icons/common/rabby-wallet.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View, { testID: 'rabby-fee-icon' });
});

jest.mock('@/assets2024/icons/perps/IconHyper.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View, { testID: 'hyper-fee-icon' });
});

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
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PerpsTradeFeeExplanationContent } from './PerpsTradeFeeExplanation';

describe('PerpsTradeFeeExplanationContent', () => {
  it('keeps the Simple trading and builder fee explanation for normal fills', () => {
    render(<PerpsTradeFeeExplanationContent isLiquidation={false} />);

    expect(screen.getByText('page.perps.historyDetail.feeDesc')).toBeTruthy();
    expect(
      screen.getByText('page.perps.historyDetail.feeHyperliquid'),
    ).toBeTruthy();
    expect(screen.getByText('0.045%')).toBeTruthy();
    expect(screen.getByText('page.perps.historyDetail.feeRabby')).toBeTruthy();
    expect(screen.getByText('0.02%')).toBeTruthy();
    expect(screen.getByText('0.04%')).toBeTruthy();
    expect(
      screen.getByText('page.perps.historyDetail.feeRabbyDiscount'),
    ).toBeTruthy();
  });

  it('omits the Rabby builder fee for liquidation fills', () => {
    render(<PerpsTradeFeeExplanationContent isLiquidation />);

    expect(screen.getByText('0.045%')).toBeTruthy();
    expect(screen.queryByTestId('rabby-fee-icon')).toBeNull();
    expect(screen.queryByText('0.02%')).toBeNull();
    expect(screen.queryByText('0.04%')).toBeNull();
  });
});
