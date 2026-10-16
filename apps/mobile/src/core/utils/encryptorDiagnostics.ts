export type DecryptDiagnosticEvent = {
  phase:
    | 'envelope_json'
    | 'envelope_shape'
    | 'derive_key'
    | 'decrypt_cipher'
    | 'plaintext_json'
    | 'credentials_shape';
  outcome: 'started' | 'succeeded' | 'failed';
  errorKind?: 'syntax' | 'type' | 'other';
  inputLength?: number;
  scannedLength?: number;
  controlCharacterCount?: number;
  firstControlCharacterOffset?: number;
  nulCount?: number;
  isObject?: boolean;
  cipherIsString?: boolean;
  cipherLength?: number;
  cipherBase64ShapeValid?: boolean;
  ivIsString?: boolean;
  ivHexShapeValid?: boolean;
  saltIsString?: boolean;
  saltLength?: number;
  passwordIsString?: boolean;
  hasPassword?: boolean;
  vaultKeyIsString?: boolean;
};

export type DecryptDiagnosticObserver = (event: DecryptDiagnosticEvent) => void;

// Observers receive structural metadata only, never input bytes or exceptions.
export function emitDecryptDiagnostic(
  observer: DecryptDiagnosticObserver | undefined,
  createEvent: () => DecryptDiagnosticEvent,
) {
  if (!observer) return;
  try {
    observer(createEvent());
  } catch {
    // Instrumentation must not change the original crypto result or error.
  }
}

export function describeEncryptedInput(value: string) {
  const scannedLength = Math.min(value.length, 65_536);
  let controlCharacterCount = 0;
  let firstControlCharacterOffset = -1;
  let nulCount = 0;
  for (let index = 0; index < scannedLength; index++) {
    const code = value.charCodeAt(index);
    if (code < 32) {
      controlCharacterCount++;
      if (firstControlCharacterOffset === -1) {
        firstControlCharacterOffset = index;
      }
      if (code === 0) nulCount++;
    }
  }
  return {
    inputLength: value.length,
    scannedLength,
    controlCharacterCount,
    firstControlCharacterOffset,
    nulCount,
  };
}

export function describeEncryptedEnvelope(value: unknown) {
  const isObject =
    !!value && typeof value === 'object' && !Array.isArray(value);
  const envelope = isObject ? (value as Record<string, unknown>) : {};
  const { cipher, iv, salt } = envelope;
  return {
    isObject,
    cipherIsString: typeof cipher === 'string',
    cipherLength: typeof cipher === 'string' ? cipher.length : undefined,
    cipherBase64ShapeValid:
      typeof cipher === 'string' &&
      cipher.length > 0 &&
      cipher.length <= 65_536 &&
      cipher.length % 4 === 0 &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(cipher),
    ivIsString: typeof iv === 'string',
    ivHexShapeValid: typeof iv === 'string' && /^[a-f0-9]{32}$/i.test(iv),
    saltIsString: typeof salt === 'string',
    saltLength: typeof salt === 'string' ? salt.length : undefined,
  };
}

export function describePasswordPayload(value: unknown) {
  const isObject =
    !!value && typeof value === 'object' && !Array.isArray(value);
  const payload = isObject ? (value as Record<string, unknown>) : {};
  return {
    isObject,
    passwordIsString: typeof payload.password === 'string',
    hasPassword:
      typeof payload.password === 'string' && payload.password.length > 0,
    vaultKeyIsString: typeof payload.vaultKeyString === 'string',
  };
}
