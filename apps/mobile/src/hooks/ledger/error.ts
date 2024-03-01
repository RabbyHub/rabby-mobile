/**
 * Common Ledger Error Codes
 */
export enum LEDGER_ERROR_CODES {
  OFF_OR_LOCKED = 'off_or_locked',
  NO_ETH_APP = 'no_eth_app',
  UNKNOWN = 'unknown',
  DISCONNECTED = 'disconnected',
  LOCKED_OR_NO_ETH_APP = 'locked_or_no_eth_app',
}

/**
 * Parses ledger errors based on common issues
 */
export const ledgerErrorHandler = (error: Error) => {
  if (error.message.includes('0x650f')) {
    return LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP;
  }

  if (error.message.includes('0x6511')) {
    return LEDGER_ERROR_CODES.NO_ETH_APP;
  }
  if (
    error.name.includes('BleError') ||
    error.message.includes('0x6b0c') ||
    error.message.includes('busy')
  ) {
    return LEDGER_ERROR_CODES.OFF_OR_LOCKED;
  }
  if (error.name.includes('Disconnected')) {
    console.error(new Error('[Ledger] - Disconnected Error'), {
      name: error.name,
      message: error.message,
    });
    return LEDGER_ERROR_CODES.DISCONNECTED;
  }

  console.error(new Error('[LedgerConnect] - Unknown Error'), {
    name: error.name,
    message: error.message,
  });

  return LEDGER_ERROR_CODES.UNKNOWN;
};
