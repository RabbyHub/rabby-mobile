/**
 * Common Ledger Error Codes
 */
export enum LEDGER_ERROR_CODES {
  OFF_OR_LOCKED = 'off_or_locked',
  NO_ETH_APP = 'no_eth_app',
  UNKNOWN = 'unknown',
  DISCONNECTED = 'disconnected',
  LOCKED_OR_NO_ETH_APP = 'locked_or_no_eth_app',
  FIRMWARE_OR_APP_UPDATE_REQUIRED = 'firmware_or_app_update_required',
  USER_REJECTED = 'user_rejected',
}

function normalizeStatusWord(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  return String(value).replace(/^0x/iu, '').toLowerCase();
}

function getErrorCode(error: unknown) {
  const value = error as any;

  return normalizeStatusWord(
    value?.errorCode ?? value?.originalError?.errorCode,
  );
}

function getErrorText(error: unknown) {
  const value = error as any;

  return [value?.message, value?.name, value?._tag].filter(Boolean).join(' ');
}

/**
 * Parses ledger errors based on common issues
 */
export const ledgerErrorHandler = (error: unknown) => {
  const value = error as any;
  const tag = value?._tag;
  const code = getErrorCode(error);
  const text = getErrorText(error);

  if (
    tag === 'RefusedByUserDAError' ||
    code === '5501' ||
    code === '6985' ||
    text.includes('0x5501') ||
    text.includes('0x6985') ||
    text.includes('RefusedByUserDAError')
  ) {
    return LEDGER_ERROR_CODES.USER_REJECTED;
  }

  if (
    tag === 'DeviceLockedError' ||
    code === '5515' ||
    text.includes('0x5515')
  ) {
    return LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP;
  }

  if (text.includes('0x6b00') || text.includes('0x6e00')) {
    return LEDGER_ERROR_CODES.FIRMWARE_OR_APP_UPDATE_REQUIRED;
  }

  if (text.includes('0x650f')) {
    return LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP;
  }

  if (text.includes('0x6511')) {
    return LEDGER_ERROR_CODES.NO_ETH_APP;
  }

  if (
    text.includes('BleError') ||
    text.includes('0x6b0c') ||
    text.includes('busy')
  ) {
    return LEDGER_ERROR_CODES.OFF_OR_LOCKED;
  }

  if (
    tag === 'DeviceSessionNotFound' ||
    text.includes('DeviceSessionNotFound') ||
    text.includes('Device session not found') ||
    text.includes('Disconnected')
  ) {
    console.error(new Error('[Ledger] - Disconnected Error'), {
      error,
    });
    return LEDGER_ERROR_CODES.DISCONNECTED;
  }

  console.error(new Error('[LedgerConnect] - Unknown Error'), {
    error,
  });

  return LEDGER_ERROR_CODES.UNKNOWN;
};
