import { act, renderHook, waitFor } from '@testing-library/react-native';

import { waitPurchaseUpdated } from '@/utils/iap';
import { reconnectIAP, useIAPListener } from './useIAPListener';

const mockInitConnection = jest.fn();
const mockEndConnection = jest.fn();
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
  endConnection: (...args: unknown[]) => mockEndConnection(...args),
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
    mockEndConnection.mockResolvedValue(true);
    mockFetchProducts.mockResolvedValue([]);
    mockPurchaseUpdatedListener.mockReturnValue({ remove: jest.fn() });
    mockPurchaseErrorListener.mockReturnValue({ remove: jest.fn() });
  });

  it('rejects a pending purchase waiter when the store emits an error', async () => {
    const { unmount } = renderHook(() => useIAPListener());

    await waitFor(() => {
      expect(mockInitConnection).toHaveBeenCalled();
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
  it('keeps purchase listeners registered when initConnection fails', async () => {
    const initError = Object.assign(
      new Error('Failed to initialize connection'),
      {
        code: 'init-connection',
        debugMessage: 'Failed to initialize billing connection',
      },
    );
    mockInitConnection.mockRejectedValueOnce(initError);

    const { unmount } = renderHook(() => useIAPListener());

    await waitFor(() => {
      expect(mockCaptureException).toHaveBeenCalledWith(initError, {
        extra: {
          code: 'init-connection',
          responseCode: undefined,
          debugMessage: 'Failed to initialize billing connection',
        },
      });
    });
    expect(mockPurchaseUpdatedListener).toHaveBeenCalled();
    expect(mockPurchaseErrorListener).toHaveBeenCalled();

    unmount();
  });

  it('re-registers listeners after rebuilding the connection', async () => {
    await reconnectIAP();

    expect(mockEndConnection).toHaveBeenCalledTimes(1);
    expect(mockInitConnection).toHaveBeenCalledTimes(1);
    expect(mockEndConnection.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitConnection.mock.invocationCallOrder[0],
    );
    expect(
      mockPurchaseUpdatedListener.mock.invocationCallOrder.at(-1),
    ).toBeGreaterThan(mockEndConnection.mock.invocationCallOrder[0]);
    expect(
      mockPurchaseErrorListener.mock.invocationCallOrder.at(-1),
    ).toBeGreaterThan(mockEndConnection.mock.invocationCallOrder[0]);
  });
});
