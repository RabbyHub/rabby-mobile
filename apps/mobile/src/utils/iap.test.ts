const mockOnce = jest.fn();
const mockDevLog = jest.fn();

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
