import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

const mockHandleDeposit = jest.fn();
const mockHandleStableCoinOrder = jest.fn();
const mockHandleWithdraw = jest.fn(async () => true);

jest.mock('@/hooks/perps/funding/usePerpsFundingActions', () => ({
  usePerpsFundingActions: () => ({
    currentPerpsAccount: { address: '0x1', type: 'SimpleKeyring' },
    handleDeposit: mockHandleDeposit,
    handleStableCoinOrder: mockHandleStableCoinOrder,
    handleWithdraw: mockHandleWithdraw,
  }),
}));

jest.mock('@/screens/Perps/components/PerpsDepositPopup', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsDepositPopup: () =>
      ReactModule.createElement(View, { testID: 'deposit-popup' }),
  };
});

jest.mock('@/screens/Perps/components/PerpsWithdrawPopup', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsWithdrawPopup: ({
      onWithdraw,
    }: {
      onWithdraw: (
        amount: string,
        isHypeWithdraw: boolean,
        targetAsset: string,
      ) => Promise<unknown>;
    }) =>
      ReactModule.createElement(Pressable, {
        onPress: () => onWithdraw('12', true, 'USDT'),
        testID: 'withdraw-popup',
      }),
  };
});

jest.mock('@/screens/Perps/components/PerpsSpotSwapPopup', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsSpotSwapPopup: () =>
      ReactModule.createElement(View, { testID: 'swap-popup' }),
  };
});

import { PerpsProFundingOverlay } from './PerpsProFundingOverlay';

const renderOverlay = (
  mode: React.ComponentProps<typeof PerpsProFundingOverlay>['mode'],
  onClose = jest.fn(),
) =>
  render(
    <PerpsProFundingOverlay
      mode={mode}
      onClose={onClose}
      onOpenDeposit={jest.fn()}
      targetAsset="USDC"
    />,
  );

describe('PerpsProFundingOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['deposit', 'deposit-popup'],
    ['withdraw', 'withdraw-popup'],
    ['swap', 'swap-popup'],
  ] as const)('mounts only the active %s popup', (mode, testID) => {
    renderOverlay(mode);

    expect(screen.getByTestId(testID)).toBeTruthy();
    expect(screen.queryAllByTestId(/-popup$/)).toHaveLength(1);
  });

  it('delegates withdraw without changing the shared popup close behavior', async () => {
    const onClose = jest.fn();
    renderOverlay('withdraw', onClose);

    fireEvent.press(screen.getByTestId('withdraw-popup'));

    await waitFor(() => {
      expect(mockHandleWithdraw).toHaveBeenCalledWith('12', true, 'USDT');
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
