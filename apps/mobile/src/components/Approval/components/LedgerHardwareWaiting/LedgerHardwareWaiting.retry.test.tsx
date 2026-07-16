import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

const mockCallCurrentRequestDeferFn = jest.fn(
  () => new Promise<void>(() => undefined),
);
const mockGetApproval = jest.fn(async () => ({
  id: 'approval-1',
  data: {
    approvalType: 'SignText',
    params: {},
  },
}));
const mockResolveApproval = jest.fn();
const mockRejectApproval = jest.fn();
const mockSetVisible = jest.fn();
const mockClosePopup = jest.fn();
const mockRetryTxReset = jest.fn();
const mockEmitSignComponentAmounted = jest.fn();

const mockEvents = {
  COMMON_HARDWARE: {
    REJECTED: 'COMMON_HARDWARE_REJECTED',
  },
  TX_SUBMITTING: 'TX_SUBMITTING',
  SIGN_FINISHED: 'SIGN_FINISHED',
};

const mockApprovalStatusMap = {
  WAITING: 'WAITING',
  SUBMITTING: 'SUBMITTING',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  SUBMITTED: 'SUBMITTED',
};

const mockListeners = new Map<string, Set<(data: any) => void>>();
const mockEventBus = {
  addListener: jest.fn((event: string, listener: (data: any) => void) => {
    const listeners = mockListeners.get(event) ?? new Set();
    listeners.add(listener);
    mockListeners.set(event, listeners);
  }),
  removeAllListeners: jest.fn((event: string) => {
    mockListeners.delete(event);
  }),
  emit(event: string, data: any) {
    mockListeners.get(event)?.forEach(listener => listener(data));
  },
};

jest.mock('@/components2024/Toast', () => ({
  toast: {
    success: jest.fn(),
  },
}));

jest.mock('@/core/services/shared', () => ({
  notificationService: {
    callCurrentRequestDeferFn: mockCallCurrentRequestDeferFn,
  },
  preferenceService: {},
  transactionHistoryService: {
    getSigningTx: jest.fn(),
  },
}));

jest.mock('@/hooks/useApproval', () => ({
  useApproval: () => [mockGetApproval, mockResolveApproval, mockRejectApproval],
}));

jest.mock('@/utils/events', () => ({
  APPROVAL_STATUS_MAP: mockApprovalStatusMap,
  eventBus: mockEventBus,
  EVENTS: mockEvents,
}));

jest.mock('../Popup/ApprovalPopupContainer', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    ApprovalPopupContainer: ({
      description,
      onRetry,
    }: {
      description: string;
      onRetry: () => void;
    }) => (
      <View>
        <Pressable testID="ledger-retry" onPress={onRetry} />
        <Text>{description}</Text>
      </View>
    ),
  };
});

jest.mock('@/hooks/useCommonPopupView', () => ({
  useCommonPopupView: () => ({
    setVisible: mockSetVisible,
    visible: true,
    closePopup: mockClosePopup,
  }),
}));

jest.mock('@/hooks/theme', () => ({
  useThemeColors: () => ({
    'neutral-title-1': '#000',
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/utils/stats', () => ({
  stats: {
    report: jest.fn(),
  },
}));

jest.mock('@/utils/analytics', () => ({
  matomoRequestEvent: jest.fn(),
}));

jest.mock('@/core/apis/safe', () => ({
  apisSafe: {},
}));

jest.mock('@/core/utils/signEvent', () => ({
  emitSignComponentAmounted: mockEmitSignComponentAmounted,
}));

jest.mock('@/utils/chain', () => ({
  findChain: () => ({ serverId: 'eth' }),
}));

jest.mock('@/utils/errorTxRetry', () => ({
  getTxFailedResult: jest.fn(),
  retryTxReset: mockRetryTxReset,
  setRetryTxRecommendNonce: jest.fn(),
  setRetryTxType: jest.fn(),
  useDebugToastErrorTxRetryInfo: jest.fn(),
}));

jest.mock('react-use/lib/useAsync', () => () => ({ value: '0x0' }));
jest.mock('ahooks', () => ({ useUnmount: jest.fn() }));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/utils/gnosis', () => ({ adjustV: jest.fn() }));
jest.mock('@/hooks/ledger/error', () => ({
  isLedgerDisconnectedError: () => false,
  isLedgerUserRejectedError: (error: unknown) =>
    String(error).includes('0x5501') || String(error).includes('0x6985'),
}));
jest.mock('@/assets/icons/wallet/ledger.svg', () => () => null);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

const { LedgerHardwareWaiting } =
  require('./LedgerHardwareWaiting') as typeof import('./LedgerHardwareWaiting');

describe('LedgerHardwareWaiting retry ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
  });

  it('keeps retry single-flight until the active Ledger action reaches a terminal event', async () => {
    render(
      <LedgerHardwareWaiting
        params={{
          address: '0x0000000000000000000000000000000000000001',
        }}
        account={
          {
            address: '0x0000000000000000000000000000000000000001',
            type: 'Ledger Hardware',
            brandName: 'Ledger',
          } as any
        }
      />,
    );

    await waitFor(() => {
      expect(mockEventBus.addListener).toHaveBeenCalledWith(
        mockEvents.COMMON_HARDWARE.REJECTED,
        expect.any(Function),
      );
    });

    fireEvent.press(screen.getByTestId('ledger-retry'));
    fireEvent.press(screen.getByTestId('ledger-retry'));

    expect(mockCallCurrentRequestDeferFn).toHaveBeenCalledTimes(1);

    act(() => {
      mockEventBus.emit(mockEvents.COMMON_HARDWARE.REJECTED, '0x5501');
    });
    expect(
      screen.getByText('page.signFooterBar.ledger.txRejectedByLedger'),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('ledger-retry'));

    expect(mockCallCurrentRequestDeferFn).toHaveBeenCalledTimes(2);
  });
});
