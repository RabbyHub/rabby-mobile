import { act, renderHook, waitFor } from '@testing-library/react-native';

import { waitPurchaseUpdated } from '@/utils/iap';
import { useIAPListener } from './useIAPListener';

const mockInitConnection = jest.fn();
const mockFetchProducts = jest.fn();
const mockPurchaseUpdatedListener = jest.fn();
const mockPurchaseErrorListener = jest.fn();
const mockEventBusOnce = jest.fn();
const mockEventBusEmit = jest.fn();
const mockDevLog = jest.fn();
const mockConfirmIapOrder = jest.fn();
const mockCaptureException = jest.fn();

type PurchaseEventDetail = {
  data?: unknown;
  error?: unknown;
};

let mockPurchaseEventListener:
  | ((detail: PurchaseEventDetail) => void)
  | undefined;

mockEventBusOnce.mockImplementation(
  (event: string, listener: (detail: PurchaseEventDetail) => void) => {
    if (event === 'PURCHASE_UPDATED') {
      mockPurchaseEventListener = listener;
    }
  },
);
mockEventBusEmit.mockImplementation(
  (event: string, detail: PurchaseEventDetail) => {
    if (event === 'PURCHASE_UPDATED') {
      const listener = mockPurchaseEventListener;
      mockPurchaseEventListener = undefined;
      listener?.(detail);
    }
  },
);

jest.mock('@/constant/iap', () => ({
  gasAccountProducts: [{ id: 'gas-account-product' }],
}));

jest.mock('@/core/request', () => ({
  openapi: {
    confirmIapOrder: (...args: unknown[]) => mockConfirmIapOrder(...args),
  },
}));

jest.mock('@/utils/events', () => ({
  EVENTS: {
    PURCHASE_UPDATED: 'PURCHASE_UPDATED',
  },
  eventBus: {
    once: (...args: unknown[]) => mockEventBusOnce(...args),
    emit: (...args: unknown[]) => mockEventBusEmit(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  devLog: (...args: unknown[]) => mockDevLog(...args),
}));

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('react-native-iap', () => ({
  fetchProducts: (...args: unknown[]) => mockFetchProducts(...args),
  finishTransaction: jest.fn(),
  initConnection: (...args: unknown[]) => mockInitConnection(...args),
  purchaseErrorListener: (...args: unknown[]) =>
    mockPurchaseErrorListener(...args),
  purchaseUpdatedListener: (...args: unknown[]) =>
    mockPurchaseUpdatedListener(...args),
}));

describe('useIAPListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPurchaseEventListener = undefined;
    mockInitConnection.mockResolvedValue(undefined);
    mockPurchaseUpdatedListener.mockReturnValue({ remove: jest.fn() });
    mockPurchaseErrorListener.mockReturnValue({ remove: jest.fn() });
  });

  it('rejects a pending purchase waiter when the store emits an error', async () => {
    const { unmount } = renderHook(() => useIAPListener());

    await waitFor(() => {
      expect(mockPurchaseErrorListener).toHaveBeenCalledTimes(1);
    });

    const pending = waitPurchaseUpdated();
    const purchaseError = {
      code: 'E_USER_CANCELLED',
      message: 'User cancelled the purchase',
    };
    const errorListener = mockPurchaseErrorListener.mock.calls[0]?.[0] as
      | ((error: typeof purchaseError) => void)
      | undefined;

    act(() => {
      errorListener?.(purchaseError);
    });

    await expect(pending).rejects.toBe(purchaseError);
    expect(mockEventBusEmit).toHaveBeenCalledWith('PURCHASE_UPDATED', {
      error: purchaseError,
    });

    unmount();
  });
});
