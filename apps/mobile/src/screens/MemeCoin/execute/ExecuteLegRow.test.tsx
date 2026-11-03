import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { create } from 'zustand';
import type { ExecLeg, LegState } from '../engine/types';
import type {
  MemeTradeTaskState,
  MemeTradeTaskStatus,
  MemeTradeTaskStore,
} from '../hooks/useMemeTradeTask';
import { ExecuteLegRow } from './ExecuteLegRow';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  cancelAnimation: jest.fn(),
  Easing: { linear: jest.fn() },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withRepeat: jest.fn(),
  withTiming: jest.fn(),
}));
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/address', () => ({
  ellipsisAddress: (address: string) => address,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (usd: number) => `$${usd}`,
}));
jest.mock('@/assets2024/memecoin/arrow-cc.svg', () => () => null);
jest.mock('@/assets2024/memecoin/status-executing.svg', () => () => null);
jest.mock('@/assets2024/memecoin/status-failed.svg', () => () => null);
jest.mock('@/assets2024/memecoin/status-pending.svg', () => () => null);
jest.mock('@/assets2024/memecoin/status-success.svg', () => () => null);
jest.mock('@/components/AssetAvatar', () => ({ AssetAvatar: () => null }));
jest.mock('../components/DashedDivider', () => ({ DashedDivider: () => null }));

const leg: ExecLeg = {
  key: 'a',
  kind: 'swap',
  pay: { id: '0xusdc', chain: 'eth', symbol: 'USDC' },
  receive: { id: '0xpepe', chain: 'eth', symbol: 'PEPE' },
  amountUsd: 1,
  payAll: false,
};

const pressRow = (status: MemeTradeTaskStatus, state: LegState) => {
  const store = create<MemeTradeTaskState>(() => ({
    status,
    states: { a: state },
    exitDialogOpen: false,
  })) as unknown as MemeTradeTaskStore;
  const onRetry = jest.fn();
  const { getByText } = render(
    <ExecuteLegRow
      leg={leg}
      legs={[leg]}
      mode="buy"
      store={store}
      tokenLogos={{}}
      onRetry={onRetry}
    />,
  );
  fireEvent.press(getByText('PEPE'));
  return onRetry;
};

describe('ExecuteLegRow retry', () => {
  it('retries a failed leg while other legs are still running', () => {
    const onRetry = pressRow('running', {
      phase: 'failed',
      failReason: 'noQuote',
    });
    expect(onRetry).toHaveBeenCalledWith('a');
  });

  it('retries a failed leg after the task finished', () => {
    const onRetry = pressRow('finished', {
      phase: 'failed',
      failReason: 'noQuote',
    });
    expect(onRetry).toHaveBeenCalledWith('a');
  });

  it('ignores a leg that has not failed', () => {
    expect(pressRow('running', { phase: 'preparing' })).not.toHaveBeenCalled();
  });

  it('ignores a bridge leg whose arrival failed', () => {
    const onRetry = pressRow('running', {
      phase: 'failed',
      failReason: 'arrivalFailed',
      txHash: '0x1',
    });
    expect(onRetry).not.toHaveBeenCalled();
  });
});
