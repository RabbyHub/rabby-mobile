const LEDGER_ERROR_KEYS = [
  '_tag',
  'name',
  'message',
  'statusCode',
  'statusText',
  'errorCode',
  'reason',
  'code',
  'originalError',
  'cause',
];

const LEDGER_DMK_SESSION_UNAVAILABLE_ERROR_TAGS = [
  'DeviceSessionNotFound',
  'DeviceDisconnectedWhileSendingError',
  'DeviceDisconnectedBeforeSendingApdu',
  'ReconnectionFailedError',
  'DeviceNotInitializedError',
  'SendApduTimeoutError',
  'SendCommandTimeoutError',
];

function normalizeStatusWord(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const normalized = String(value).replace(/^0x/iu, '').toLowerCase();
  return normalized || undefined;
}

function getDmkErrorTag(error: unknown) {
  const tag = (error as any)?._tag;

  return typeof tag === 'string' ? tag : undefined;
}

export function isDeviceSessionNotFound(error: unknown) {
  return getDmkErrorTag(error) === 'DeviceSessionNotFound';
}

function getDmkErrorCode(error: unknown) {
  const value = error as any;
  const code = normalizeStatusWord(
    value?.statusCode ??
      value?.errorCode ??
      value?.message?.statusCode ??
      value?.message?.errorCode ??
      value?.originalError?.statusCode ??
      value?.originalError?.errorCode,
  );

  if (code) {
    return code;
  }

  if (getDmkErrorTag(error) === 'RefusedByUserDAError') {
    return '6985';
  }

  if (getDmkErrorTag(error) === 'DeviceLockedError') {
    return '5515';
  }

  return undefined;
}

function stringifyLedgerErrorValue(value: unknown, key?: string): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return key?.toLowerCase().includes('code')
      ? `0x${value.toString(16)}`
      : String(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Error) {
    return value.message || value.name;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => stringifyLedgerErrorValue(item))
      .filter(Boolean)
      .join(' ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = LEDGER_ERROR_KEYS.map(item =>
      stringifyLedgerErrorValue(record[item], item),
    ).filter(Boolean);

    if (parts.length) {
      return [...new Set(parts)].join(' ');
    }

    const message = String(value);
    if (message && message !== '[object Object]') {
      return message;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return String(value);
}

export function isLedgerDmkSessionUnavailableError(error: unknown) {
  const tag = getDmkErrorTag(error);
  const text = stringifyLedgerErrorValue(error);
  const normalizedText = text.toLowerCase();

  return (
    (tag != null && LEDGER_DMK_SESSION_UNAVAILABLE_ERROR_TAGS.includes(tag)) ||
    LEDGER_DMK_SESSION_UNAVAILABLE_ERROR_TAGS.some(errorTag =>
      text.includes(errorTag),
    ) ||
    normalizedText.includes('device session not found') ||
    normalizedText.includes('disconnected')
  );
}

function appendStatusWord(message: string, code?: string) {
  if (!code || message.includes(`0x${code}`)) {
    return message;
  }

  return `${message} 0x${code}`;
}

function attachStatusWord(error: Error, code?: string) {
  if (code) {
    (error as Error & { errorCode?: string }).errorCode = code;
  }

  return error;
}

function getDmkErrorMessage(error: unknown, fallback: string) {
  return appendStatusWord(
    stringifyLedgerErrorValue(error) || fallback,
    getDmkErrorCode(error),
  );
}

export function toLedgerDmkError(error: unknown) {
  const code = getDmkErrorCode(error);
  if (error instanceof Error) {
    const message = getDmkErrorMessage(error, error.message || error.name);
    const normalizedError =
      message === error.message ? error : new Error(message);

    return attachStatusWord(normalizedError, code);
  }

  return attachStatusWord(
    new Error(getDmkErrorMessage(error, 'Unknown Ledger DMK error')),
    code,
  );
}
