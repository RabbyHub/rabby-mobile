import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { BuySummary } from '../ui/helpers';
import { BuyPreviewBar } from './BuyPreviewBar';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { amount?: string }) =>
      options?.amount ? `${key}:${options.amount}` : key,
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (usd: number) => `$${usd.toFixed(2)}`,
}));
jest.mock('@/components2024/Button', () => {
  const { createElement } = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      createElement(
        TouchableOpacity,
        { onPress, disabled },
        createElement(Text, null, title),
      ),
  };
});
jest.mock('@/constant/layout', () => ({
  BOTTOM_BUTTON_SINGLE_HEIGHT: 52,
  BOTTOM_BUTTON_TITLE_STYLE: {},
  BOTTOM_BUTTON_TOP_OFFSET: 12,
  getBottomButtonBottomOffset: () => 36,
}));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeOffBottom: 0 }),
}));
jest.mock('../components/MaxPriceImpactSelector', () => ({
  MaxPriceImpactSelector: () => null,
}));

const renderBar = (summary: BuySummary, disabled: boolean) => {
  const onPreview = jest.fn();
  const utils = render(
    <BuyPreviewBar
      summary={summary}
      maxPriceImpactPct={5}
      onMaxPriceImpactChange={jest.fn()}
      disabled={disabled}
      onPreview={onPreview}
    />,
  );
  return { ...utils, onPreview };
};

describe('BuyPreviewBar', () => {
  it('keeps Preview disabled when nothing is selected', () => {
    const { getByText, onPreview } = renderBar(
      { kind: 'none', neededUsd: 100 },
      true,
    );
    fireEvent.press(getByText('page.memeCoin.buy.preview'));
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('shows the shortfall when the selection does not cover the amount', () => {
    const { getByText, onPreview } = renderBar(
      { kind: 'short', shortfallUsd: 65.21 },
      true,
    );
    fireEvent.press(getByText('page.memeCoin.buy.anotherNeeded:$65.21'));
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('previews when the selection covers the amount', () => {
    const { getByText, onPreview } = renderBar({ kind: 'enough' }, false);
    fireEvent.press(getByText('page.memeCoin.buy.preview'));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });
});
