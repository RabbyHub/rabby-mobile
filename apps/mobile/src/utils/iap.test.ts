const mockOnce = jest.fn();
const mockDevLog = jest.fn();

jest.mock('react-native-iap', () => ({
  ErrorCode: { NotPrepared: 'not-prepared' },
}));

function loadIapModule() {
  jest.resetModules();

  jest.doMock('./events', () => ({
    EVENTS: {
      PURCHASE_UPDATED: 'PURCHASE_UPDATED',
    },
    eventBus: {
      once: (...args: unknown[]) => mockOnce(...args),
    },
  }));

  jest.doMock('./logger', () => ({
    devLog: (...args: unknown[]) => mockDevLog(...args),
  }));

  return require('./iap') as typeof import('./iap');
}

describe('waitPurchaseUpdated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with purchase data and logs the payload', async () => {
    const { waitPurchaseUpdated } = loadIapModule();

    const pending = waitPurchaseUpdated();
    const handler = mockOnce.mock.calls[0]?.[1];
    handler({
      data: { id: 'purchase-1' },
      error: null,
    });

    await expect(pending).resolves.toEqual({ id: 'purchase-1' });
    expect(mockDevLog).toHaveBeenCalledWith(
      'purchase updated',
      { id: 'purchase-1' },
      null,
    );
  });

  it('rejects when the purchase update event carries an error', async () => {
    const { waitPurchaseUpdated } = loadIapModule();
    const error = new Error('iap failed');

    const pending = waitPurchaseUpdated();
    const handler = mockOnce.mock.calls[0]?.[1];
    handler({
      data: null,
      error,
    });

    await expect(pending).rejects.toBe(error);
  });
});

describe('purchaseWithReconnect', () => {
  const notPrepared = {
    code: 'not-prepared',
    message: 'Billing client not ready',
  };

  // loadIapModule resets the registry, so set the OS on the fresh instance.
  const loadOnPlatform = (os: string) => {
    const iap = loadIapModule();
    require('react-native').Platform.OS = os;
    return iap;
  };

  it('reconnects and retries once when the billing client is not ready', async () => {
    const { purchaseWithReconnect } = loadOnPlatform('android');
    const purchase = jest
      .fn()
      .mockRejectedValueOnce(notPrepared)
      .mockResolvedValueOnce('purchase');
    const reconnect = jest.fn().mockResolvedValue(undefined);

    await expect(purchaseWithReconnect(purchase, reconnect)).resolves.toBe(
      'purchase',
    );
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(purchase).toHaveBeenCalledTimes(2);
  });

  it('does not retry more than once', async () => {
    const { purchaseWithReconnect } = loadOnPlatform('android');
    const purchase = jest.fn().mockRejectedValue(notPrepared);
    const reconnect = jest.fn().mockResolvedValue(undefined);

    await expect(purchaseWithReconnect(purchase, reconnect)).rejects.toBe(
      notPrepared,
    );
    expect(purchase).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['other errors', 'android', { code: 'user-cancelled' }],
    ['on iOS', 'ios', notPrepared],
  ])('does not retry %s', async (_, os, error) => {
    const { purchaseWithReconnect } = loadOnPlatform(os);
    const purchase = jest.fn().mockRejectedValue(error);
    const reconnect = jest.fn();

    await expect(purchaseWithReconnect(purchase, reconnect)).rejects.toBe(
      error,
    );
    expect(reconnect).not.toHaveBeenCalled();
    expect(purchase).toHaveBeenCalledTimes(1);
  });
});
