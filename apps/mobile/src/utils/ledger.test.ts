const mockOn = jest.fn();
const mockEmit = jest.fn();

function loadLedgerModule() {
  jest.resetModules();

  jest.doMock('@/utils/events', () => ({
    EVENTS: {
      broadcastToUI: 'broadcastToUI',
    },
    eventBus: {
      emit: (...args: unknown[]) => mockEmit(...args),
    },
  }));

  return require('./ledger') as typeof import('./ledger');
}

describe('ledger utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bindLedgerEvents forwards bridge broadcasts to the event bus', () => {
    const { bindLedgerEvents } = loadLedgerModule();
    const keyring = {
      events: {
        on: mockOn,
      },
    };

    bindLedgerEvents(keyring as any);

    expect(mockOn).toHaveBeenCalledWith('broadcastToUI', expect.any(Function));

    const handler = mockOn.mock.calls[0]?.[1];
    handler({
      method: 'LEDGER_CONNECTED',
      params: {
        id: 1,
      },
    });

    expect(mockEmit).toHaveBeenCalledWith('LEDGER_CONNECTED', { id: 1 });
  });

  it('recognizes the known ledger lock error codes', () => {
    const { isLedgerLockError } = loadLedgerModule();

    expect(isLedgerLockError('Error 0x5515')).toBe(true);
    expect(isLedgerLockError('Error 0x6b0c')).toBe(true);
    expect(isLedgerLockError('Error 0x650f')).toBe(true);
    expect(isLedgerLockError('Error 0x1234')).toBe(false);
  });
});
