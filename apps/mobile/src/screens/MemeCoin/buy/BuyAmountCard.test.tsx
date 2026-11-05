import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { AllocationMode } from '../engine/types';
import { BuyAmountCard } from './BuyAmountCard';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
  TextInput: jest.requireActual('react-native').TextInput,
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (usd: number) => `$${usd}`,
}));
jest.mock('@/assets2024/memecoin/pencil-cc.svg', () => () => null);
jest.mock('@/assets2024/memecoin/switch-cc.svg', () => () => null);
jest.mock('@/components/AssetAvatar', () => ({ AssetAvatar: () => null }));
jest.mock('../components/DashedDivider', () => ({ DashedDivider: () => null }));

const memes = [
  { id: 'b', chain: 'hood', symbol: 'BBB', marketCap: 25, logoUrl: '' },
  { id: 'a', chain: 'hood', symbol: 'AAA', marketCap: 75, logoUrl: '' },
];

const renderCard = (allocationMode: AllocationMode) => {
  const onToggle = jest.fn();
  const onChangeAmount = jest.fn();
  const utils = render(
    <BuyAmountCard
      amountText="100.00"
      amountUsd={100}
      onChangeAmount={onChangeAmount}
      memes={memes}
      allocationMode={allocationMode}
      onToggleAllocationMode={onToggle}
    />,
  );
  return { ...utils, onToggle, onChangeAmount };
};

describe('BuyAmountCard amount', () => {
  it('keeps at most two decimals while typing', () => {
    const { getByText, getByDisplayValue, onChangeAmount } =
      renderCard('marketCap');
    fireEvent.press(getByText('$100'));
    fireEvent.changeText(getByDisplayValue('100.00'), '12.345');
    expect(onChangeAmount).toHaveBeenCalledWith('12.34');
  });
});

describe('BuyAmountCard allocation', () => {
  it('lists each meme with its market cap share', () => {
    const { getByText } = renderCard('marketCap');
    getByText('page.memeCoin.buy.allocation');
    getByText('page.memeCoin.buy.byMarketCap');
    ['AAA', '$75', '75%', 'BBB', '$25', '25%'].forEach(text => getByText(text));
  });

  it('lists an even split in equal mode', () => {
    const { getByText, getAllByText } = renderCard('equal');
    getByText('page.memeCoin.buy.equalSplit');
    expect(getAllByText('$50')).toHaveLength(2);
    expect(getAllByText('50%')).toHaveLength(2);
  });

  it('toggles from the mode label', () => {
    const { getByText, onToggle } = renderCard('marketCap');
    fireEvent.press(getByText('page.memeCoin.buy.byMarketCap'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
