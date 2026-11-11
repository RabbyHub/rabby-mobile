import React from 'react';
import { act, render } from '@testing-library/react-native';
import { eventBus, EVENTS } from '@/utils/events';
import { notificationServiceApi } from '@/core/serviceApi/notification';
import { ApprovalPopupContainer } from '../Popup/ApprovalPopupContainer';
import { OneKeyHardwareWaiting } from './OneKeyHardwareWaiting';

jest.mock('@/core/utils/fonts', () => ({ RoundedFontStyles: {} }));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/components2024/Toast', () => ({
  toast: { success: jest.fn() },
}));
jest.mock('@/core/serviceApi/notification', () => ({
  notificationServiceApi: { callCurrentRequestDeferFn: jest.fn() },
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {},
}));
jest.mock('@/hooks/useApproval', () => ({
  useApproval: () => [
    async () => ({ id: 'approval', data: { approvalType: 'SignText' } }),
    jest.fn(),
    jest.fn(),
  ],
}));
jest.mock('@/utils/events', () => ({
  eventBus: new (require('events').EventEmitter)(),
  EVENTS: {
    COMMON_HARDWARE: { REJECTED: 'rejected' },
    TX_SUBMITTING: 'submitting',
    SIGN_FINISHED: 'finished',
  },
  APPROVAL_STATUS_MAP: {
    WAITING: 3,
    SUBMITTED: 4,
    REJECTED: 5,
    FAILED: 6,
    SUBMITTING: 7,
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../Popup/ApprovalPopupContainer', () => ({
  ApprovalPopupContainer: jest.fn(() => null),
}));
jest.mock('@/hooks/useCommonPopupView', () => ({
  useCommonPopupView: () => ({ setVisible: jest.fn() }),
}));
jest.mock('@/assets/icons/wallet/onekey.svg', () => () => null);
jest.mock('@/hooks/theme', () => ({ useThemeColors: () => ({}) }));
jest.mock('@/utils/gnosis', () => ({ adjustV: jest.fn() }));
jest.mock('@/core/apis/safe', () => ({ apisSafe: {} }));
jest.mock('@/core/utils/signEvent', () => ({
  emitSignComponentAmounted: jest.fn(),
}));
jest.mock('@/utils/errorTxRetry', () => ({
  retryTxReset: jest.fn(),
  setRetryTxType: jest.fn(),
  setRetryTxRecommendNonce: jest.fn(),
  useDebugToastErrorTxRetryInfo: jest.fn(),
}));
jest.mock('react-use/lib/useAsync', () => () => ({ value: '0x0' }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/core/apis', () => ({ apiOneKey: { cancel: jest.fn() } }));

const retryRequest = jest.mocked(
  notificationServiceApi.callCurrentRequestDeferFn,
);
const popup = jest.mocked(ApprovalPopupContainer);

function retry() {
  const props = popup.mock.calls[popup.mock.calls.length - 1]![0];
  return props.onRetry!();
}

function fail() {
  eventBus.emit(EVENTS.SIGN_FINISHED, {
    success: false,
    errorMsg: 'Device disconnected',
  });
  jest.advanceTimersByTime(600);
}

describe('OneKeyHardwareWaiting retry', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    retryRequest.mockReset();
    // Even a resolved notification RPC does not finish the hardware attempt.
    retryRequest.mockResolvedValue(undefined);
    popup.mockClear();
    render(<OneKeyHardwareWaiting params={{} as any} account={{} as any} />);
    await act(async () => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ignores retry while the initial signing attempt is waiting', () => {
    act(() => {
      retry();
    });
    expect(retryRequest).not.toHaveBeenCalled();
  });

  it('blocks rapid double taps and stays locked after the notification RPC resolves', async () => {
    act(fail);
    await act(async () => {
      retry();
      retry();
    });
    expect(retryRequest).toHaveBeenCalledTimes(1);

    act(() => {
      retry();
    });
    expect(retryRequest).toHaveBeenCalledTimes(1);

    act(fail);
    await act(async () => {
      retry();
    });
    expect(retryRequest).toHaveBeenCalledTimes(2);
  });

  it('allows retry after device rejection and ignores retry during submission', async () => {
    act(() => {
      eventBus.emit(EVENTS.COMMON_HARDWARE.REJECTED, 'User rejected');
    });
    await act(async () => {
      retry();
    });
    expect(retryRequest).toHaveBeenCalledTimes(1);

    act(() => {
      eventBus.emit(EVENTS.COMMON_HARDWARE.REJECTED, 'User rejected');
    });
    await act(async () => {
      retry();
    });
    expect(retryRequest).toHaveBeenCalledTimes(2);

    act(() => {
      eventBus.emit(EVENTS.TX_SUBMITTING, undefined);
    });
    await act(async () => {
      retry();
    });
    expect(retryRequest).toHaveBeenCalledTimes(2);
  });
});
