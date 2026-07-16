import {
  isLedgerBusyError,
  isLedgerDisconnectedError,
  isLedgerUserRejectedError,
  LEDGER_ERROR_CODES,
  ledgerErrorHandler,
} from './error';

describe('ledgerErrorHandler', () => {
  it('classifies DMK user rejection tags and status words', () => {
    expect(
      ledgerErrorHandler({
        _tag: 'RefusedByUserDAError',
      } as any),
    ).toBe(LEDGER_ERROR_CODES.USER_REJECTED);

    expect(
      ledgerErrorHandler({
        errorCode: '5501',
      } as any),
    ).toBe(LEDGER_ERROR_CODES.USER_REJECTED);

    expect(
      ledgerErrorHandler({
        originalError: {
          errorCode: '6985',
        },
      } as any),
    ).toBe(LEDGER_ERROR_CODES.USER_REJECTED);

    expect(ledgerErrorHandler(new Error('Action refused 0x5501'))).toBe(
      LEDGER_ERROR_CODES.USER_REJECTED,
    );
    expect(isLedgerUserRejectedError('Action refused 0x5501')).toBe(true);
    expect(isLedgerUserRejectedError('Action refused 0x6985')).toBe(true);
  });

  it('keeps existing LedgerJS message classification working', () => {
    expect(ledgerErrorHandler(new Error('Transport error 0x650f'))).toBe(
      LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP,
    );
    expect(ledgerErrorHandler(new Error('Transport error 0x6b0c'))).toBe(
      LEDGER_ERROR_CODES.OFF_OR_LOCKED,
    );
  });

  it('classifies the DMK missing Ethereum app status word', () => {
    expect(ledgerErrorHandler({ errorCode: '6807' })).toBe(
      LEDGER_ERROR_CODES.NO_ETH_APP,
    );
  });

  it('classifies DMK Bluetooth state errors', () => {
    expect(ledgerErrorHandler({ _tag: 'BlePermissionsNotGranted' })).toBe(
      LEDGER_ERROR_CODES.BLUETOOTH_PERMISSION_DENIED,
    );
    expect(ledgerErrorHandler({ _tag: 'BlePoweredOff' })).toBe(
      LEDGER_ERROR_CODES.BLUETOOTH_POWERED_OFF,
    );
  });

  it('classifies stale DMK sessions as disconnected', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(
      ledgerErrorHandler({
        _tag: 'DeviceSessionNotFound',
        originalError: new Error('Device session not found'),
      } as any),
    ).toBe(LEDGER_ERROR_CODES.DISCONNECTED);

    consoleError.mockRestore();
  });

  it('uses the same disconnect classification for objects and messages', () => {
    const tags = [
      'DeviceSessionNotFound',
      'DeviceDisconnectedWhileSendingError',
      'DeviceDisconnectedBeforeSendingApdu',
      'ReconnectionFailedError',
      'DeviceNotInitializedError',
      'SendApduTimeoutError',
      'SendCommandTimeoutError',
    ];

    for (const tag of tags) {
      expect(isLedgerDisconnectedError({ _tag: tag })).toBe(true);
      expect(isLedgerDisconnectedError(`Error: ${tag}`)).toBe(true);
    }

    expect(
      isLedgerDisconnectedError(
        'Error: DeviceSessionNotFound Device session not found',
      ),
    ).toBe(true);
    expect(isLedgerDisconnectedError(new Error('Ledger disconnected'))).toBe(
      true,
    );
    expect(isLedgerDisconnectedError('Action refused 0x6985')).toBe(false);
  });

  it('classifies DMK busy errors without treating them as disconnects', () => {
    for (const tag of [
      'DeviceBusyError',
      'SendApduConcurrencyError',
      'AlreadySendingApduError',
    ]) {
      expect(isLedgerBusyError({ _tag: tag })).toBe(true);
      expect(isLedgerBusyError(`Error: ${tag}`)).toBe(true);
      expect(isLedgerDisconnectedError({ _tag: tag })).toBe(false);
    }
  });
});
