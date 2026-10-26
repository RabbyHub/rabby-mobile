import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Chain } from '@/constant/chains';
import DeployContract from './DeployContract';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { symbol?: string }) =>
      options?.symbol ? `${key}:${options.symbol}` : key,
  }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('../../hooks/useCommonStyle', () => ({
  __esModule: true,
  default: () => ({
    primaryText: {},
    rowTitleText: {},
  }),
}));

jest.mock('./components/Table', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Table: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    Col: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    Row: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('@/utils/number', () => ({
  formatTokenAmount: (value: string) => value,
}));

const chain = {
  nativeTokenSymbol: 'ETH',
} as Chain;

describe('DeployContract', () => {
  it('shows the native token payment when transaction value is positive', () => {
    render(<DeployContract value="0xde0b6b3a7640000" chain={chain} />);

    expect(
      screen.getByText('page.signTx.contractCall.payNativeToken:ETH'),
    ).toBeOnTheScreen();
    expect(screen.getByText('1 ETH')).toBeOnTheScreen();
  });

  it('does not show a native token payment when transaction value is zero', () => {
    render(<DeployContract value="0x0" chain={chain} />);

    expect(
      screen.queryByText('page.signTx.contractCall.payNativeToken:ETH'),
    ).not.toBeOnTheScreen();
  });
});
