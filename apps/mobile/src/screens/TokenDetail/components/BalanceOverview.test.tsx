import React from 'react';
import { render } from '@testing-library/react-native';
import BalanceOverview from './BalanceOverview';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@rneui/themed', () => ({
  Skeleton: require('react-native').View,
}));
jest.mock('./TokenPriceChart/LoadingLinear', () => ({
  LoadingLinear: () => null,
}));
// The unit under test chooses loading/value/unavailable; number-formatting
// package output is an independent collaborator.
jest.mock('../util', () => ({
  formatAmountValueKMB: (amount: number) => String(amount),
}));

it('keeps a real zero visible, including cached asset-list entries', () => {
  const view = render(<BalanceOverview amount={0} usdValue="0" />);
  expect(view.getByText('0')).toBeVisible();
  expect(view.getByText('≈$0')).toBeVisible();
  expect(view.queryByTestId('token-detail-amount-loading')).toBeNull();
});

it('uses the existing skeleton for an unfetched placeholder then shows data', () => {
  const view = render(
    <BalanceOverview amount={0} usdValue="0" status="loading" />,
  );
  expect(view.queryByText('0')).toBeNull();
  expect(view.queryByText('≈$0')).toBeNull();
  expect(view.getByTestId('token-detail-amount-loading')).toBeVisible();
  expect(view.getByTestId('token-detail-usd-loading')).toBeVisible();
  view.rerender(<BalanceOverview amount={12.5} usdValue="25" status="ready" />);
  expect(view.getByText('12.5')).toBeVisible();
  expect(view.getByText('≈$25')).toBeVisible();
  expect(view.queryByTestId('token-detail-amount-loading')).toBeNull();
});

it('stops the animation on failure without turning unknown into zero', () => {
  const view = render(
    <BalanceOverview amount={0} usdValue="0" status="unavailable" />,
  );
  expect(view.getAllByText('--')).toHaveLength(2);
  expect(view.queryByText('≈$0')).toBeNull();
  expect(view.queryByTestId('token-detail-amount-loading')).toBeNull();
});
