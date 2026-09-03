import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { createStore } from 'zustand/vanilla';

import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

const mockHandleDeposit = jest.fn();
const mockHandleStableCoinOrder = jest.fn();
const mockHandleWithdraw = jest.fn(async () => true);
const mockUsePerpsFundingActions = jest.fn((_options?: unknown) => ({
  currentPerpsAccount: { address: '0x1', type: 'SimpleKeyring' },
  handleDeposit: mockHandleDeposit,
  handleStableCoinOrder: mockHandleStableCoinOrder,
  handleWithdraw: mockHandleWithdraw,
}));
let mockDepositPopupProps: Record<string, unknown> | null = null;
let mockSwapPopupProps: Record<string, unknown> | null = null;
let mockWithdrawPopupProps: Record<string, unknown> | null = null;
const mockWithdrawBalanceStore = createStore(() => ({ availableBalance: 0 }));
const mockWithdrawBalanceRenders: number[] = [];

jest.mock('@/hooks/perps/funding/usePerpsFundingActions', () => ({
  usePerpsFundingActions: (...args: unknown[]) =>
    mockUsePerpsFundingActions(...args),
}));

jest.mock('@/screens/Perps/components/PerpsDepositPopup', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsDepositPopup: (props: Record<string, unknown>) => {
      mockDepositPopupProps = props;
      return ReactModule.createElement(View, { testID: 'deposit-popup' });
    },
  };
});

jest.mock('@/screens/Perps/components/PerpsWithdrawPopup', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  const {
    useActivityStore: useMockActivityStore,
  } = require('@/hooks/storeActivity/useActivityStore');
  return {
    PerpsWithdrawPopup: (props: {
      onWithdraw: (
        amount: string,
        isHypeWithdraw: boolean,
        targetAsset: string,
      ) => Promise<unknown>;
    }) => {
      mockWithdrawPopupProps = props;
      const { onWithdraw } = props;
      const availableBalance = useMockActivityStore(
        mockWithdrawBalanceStore,
        (state: { availableBalance: number }) => state.availableBalance,
      );
      mockWithdrawBalanceRenders.push(availableBalance);
      return ReactModule.createElement(Pressable, {
        onPress: () => onWithdraw('12', true, 'USDT'),
        testID: 'withdraw-popup',
      });
    },
  };
});

jest.mock('@/screens/Perps/components/PerpsSpotSwapPopup', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsSpotSwapPopup: (props: Record<string, unknown>) => {
      mockSwapPopupProps = props;
      return ReactModule.createElement(View, { testID: 'swap-popup' });
    },
  };
});

import { PerpsProFundingOverlay } from './PerpsProFundingOverlay';

const GlobalBalanceProbe = () => {
  useActivityStore(mockWithdrawBalanceStore, state => state.availableBalance);
  return null;
};

const renderOverlay = (
  mode: React.ComponentProps<typeof PerpsProFundingOverlay>['mode'],
  onClose = jest.fn(),
  sourceAsset?: React.ComponentProps<
    typeof PerpsProFundingOverlay
  >['sourceAsset'],
) =>
  render(
    <PerpsProFundingOverlay
      depositFromSwapVisible={false}
      mode={mode}
      onClose={onClose}
      onCloseDeposit={jest.fn()}
      onOpenDeposit={jest.fn()}
      sourceAsset={sourceAsset}
      targetAsset="USDC"
    />,
  );

describe('PerpsProFundingOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDepositPopupProps = null;
    mockSwapPopupProps = null;
    mockWithdrawPopupProps = null;
    mockWithdrawBalanceRenders.length = 0;
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

  it('closes the Pro overlay after the shared withdraw action settles', async () => {
    const onClose = jest.fn();
    renderOverlay('withdraw', onClose);

    fireEvent.press(screen.getByTestId('withdraw-popup'));

    await waitFor(() => {
      expect(mockHandleWithdraw).toHaveBeenCalledWith('12', true, 'USDT');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reads the latest balance on the first Pro withdraw render', () => {
    act(() => {
      mockWithdrawBalanceStore.setState({ availableBalance: 0 });
    });
    const globalProbe = render(<GlobalBalanceProbe />);
    globalProbe.unmount();

    act(() => {
      mockWithdrawBalanceStore.setState({ availableBalance: 42 });
    });
    mockWithdrawBalanceRenders.length = 0;

    renderOverlay('withdraw');

    expect(mockWithdrawBalanceRenders[0]).toBe(42);
  });

  it('opts Pro into live mode validation', () => {
    renderOverlay('withdraw');

    expect(mockUsePerpsFundingActions).toHaveBeenCalledWith({
      withdrawModeValidation: 'live',
    });
  });

  it.each(['deposit', 'withdraw', 'swap'] as const)(
    'opts the shared %s popup into Pro rounded typography',
    mode => {
      renderOverlay(mode);

      const popupProps =
        mode === 'deposit'
          ? mockDepositPopupProps
          : mode === 'withdraw'
          ? mockWithdrawPopupProps
          : mockSwapPopupProps;
      expect(popupProps?.inputTextStyle).toMatchObject({
        fontFamily: expect.stringContaining('Rounded'),
      });
      expect(popupProps?.tooltipTextStyle).toMatchObject({
        fontFamily: expect.stringContaining('Rounded'),
      });
    },
  );

  it('keeps the Pro withdraw popup open after a handled failure', async () => {
    mockHandleWithdraw.mockResolvedValueOnce(false);
    const onClose = jest.fn();
    renderOverlay('withdraw', onClose);

    fireEvent.press(screen.getByTestId('withdraw-popup'));

    await waitFor(() => expect(mockHandleWithdraw).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens USDC as an editable Pro-only swap source', () => {
    renderOverlay('swap', jest.fn(), 'USDC');

    expect(mockSwapPopupProps).toMatchObject({
      disableSwitch: false,
      sourceAsset: 'USDC',
      targetAsset: undefined,
      visible: true,
    });
  });

  it('keeps non-USDC Pro swaps on the existing fixed-target path', () => {
    render(
      <PerpsProFundingOverlay
        depositFromSwapVisible={false}
        mode="swap"
        onClose={jest.fn()}
        onCloseDeposit={jest.fn()}
        onOpenDeposit={jest.fn()}
        targetAsset="USDE"
      />,
    );

    expect(mockSwapPopupProps).toMatchObject({
      disableSwitch: true,
      sourceAsset: undefined,
      targetAsset: 'USDE',
      visible: true,
    });
  });

  it('keeps Swap mounted below the nested Deposit popup', () => {
    const onCloseDeposit = jest.fn();
    const onOpenDeposit = jest.fn();
    render(
      <PerpsProFundingOverlay
        depositFromSwapVisible
        mode="swap"
        onClose={jest.fn()}
        onCloseDeposit={onCloseDeposit}
        onOpenDeposit={onOpenDeposit}
        sourceAsset="USDC"
        targetAsset="USDC"
      />,
    );

    expect(screen.getByTestId('swap-popup')).toBeTruthy();
    expect(screen.getByTestId('deposit-popup')).toBeTruthy();
    expect(mockSwapPopupProps).toMatchObject({
      onDepositPress: onOpenDeposit,
      visible: true,
    });
    expect(mockDepositPopupProps).toMatchObject({
      onClose: onCloseDeposit,
      onDeposit: mockHandleDeposit,
      visible: true,
    });
  });
});
