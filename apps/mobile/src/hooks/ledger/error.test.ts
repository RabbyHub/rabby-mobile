import { LEDGER_ERROR_CODES, ledgerErrorHandler } from './error';

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
  });

  it('keeps existing LedgerJS message classification working', () => {
    expect(ledgerErrorHandler(new Error('Transport error 0x650f'))).toBe(
      LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP,
    );
    expect(ledgerErrorHandler(new Error('Transport error 0x6b0c'))).toBe(
      LEDGER_ERROR_CODES.OFF_OR_LOCKED,
    );
  });
});
