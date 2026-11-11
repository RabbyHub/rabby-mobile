import {
  getOneKeyErrorCode,
  getOneKeyErrorMessage,
  isOneKeyBleSetupError,
  isOneKeyPermissionError,
  isOneKeyUserCancelError,
} from './onekeyError';

const t = (key: string) => key;

describe('utils/onekeyError', () => {
  it('reads the code from SDK responses, errors and numbers', () => {
    expect(
      getOneKeyErrorCode({
        success: false,
        payload: { code: 117, error: 'x' },
      }),
    ).toBe(117);
    expect(
      getOneKeyErrorCode(Object.assign(new Error('x'), { code: 802 })),
    ).toBe(802);
    expect(getOneKeyErrorCode(721)).toBe(721);
    expect(getOneKeyErrorCode('105')).toBe(105);
  });

  it('prefers a carried code over the message text', () => {
    // "Device interrupted" alone is ambiguous (107 vs 109); the code is not.
    expect(
      getOneKeyErrorCode({ code: 109, message: 'Device interrupted' }),
    ).toBe(109);
    expect(
      getOneKeyErrorMessage({ code: 117, message: 'Pin cancelled' }, t),
    ).toBe('page.newAddress.onekey.error.deviceBusy');
  });

  it('falls back to the default SDK message when the code was lost', () => {
    expect(getOneKeyErrorCode(new Error('Error: Device is busy'))).toBe(117);
    expect(getOneKeyErrorCode('Pin cancelled')).toBe(802);
    expect(getOneKeyErrorCode('Device not opened passphrase')).toBe(113);
    expect(getOneKeyErrorCode('Action cancelled by user on call queue')).toBe(
      822,
    );
    expect(getOneKeyErrorCode('Action cancelled by user')).toBe(803);
    expect(
      getOneKeyErrorCode({
        success: false,
        payload: { error: 'Bluetooth pairing failed' },
      }),
    ).toBe(715);
  });

  it('does not guess for ambiguous or unknown messages', () => {
    expect(getOneKeyErrorCode('Device interrupted')).toBeUndefined();
    expect(getOneKeyErrorCode('signature doesnt match')).toBeUndefined();
    expect(getOneKeyErrorCode(undefined)).toBeUndefined();
    expect(getOneKeyErrorMessage(new Error('random'), t)).toBeUndefined();
  });

  it('maps codes to OneKey i18n messages', () => {
    expect(getOneKeyErrorMessage(113, t)).toBe(
      'page.newAddress.onekey.error.passphraseDisabled',
    );
    expect(getOneKeyErrorMessage(117, t)).toBe(
      'page.newAddress.onekey.error.deviceBusy',
    );
    expect(getOneKeyErrorMessage(724, t)).toBe(
      'page.newAddress.onekey.error.pairingInvalid',
    );
    expect(getOneKeyErrorMessage(702, t)).toBe(
      'page.newAddress.onekey.error.bluetoothPermission',
    );
    expect(getOneKeyErrorMessage(414, t)).toBe(
      'page.newAddress.onekey.error.firmwareTooOld',
    );
  });

  it('classifies setup and cancel errors', () => {
    expect([701, 702, 712, 721, 722].every(isOneKeyBleSetupError)).toBe(true);
    expect(isOneKeyBleSetupError(700)).toBe(false);
    expect([802, 803, 822, 109].every(isOneKeyUserCancelError)).toBe(true);
    expect(isOneKeyUserCancelError(107)).toBe(false);
  });

  it.each([
    [701, true, 'denied', true],
    [701, true, 'blocked', true],
    [701, true, 'unavailable', false],
    [701, true, 'granted', false],
    [701, true, 'limited', false],
    [701, true, undefined, false],
    [701, false, 'denied', false],
    [701, false, 'blocked', false],
    [701, false, 'unavailable', false],
    [702, true, undefined, true],
    [702, false, undefined, true],
    [721, true, 'denied', false],
  ])(
    'classifies permission errors for code %s, iOS %s, status %s',
    (code, isIOS, permission, expected) => {
      expect(isOneKeyPermissionError(code, isIOS, permission)).toBe(expected);
    },
  );
});
