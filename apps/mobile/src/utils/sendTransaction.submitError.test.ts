import { isOneKeyDisconnectError, toSubmitTxError } from './onekeyError';

describe('toSubmitTxError', () => {
  it.each([107, 109])('keeps SDK code %s on Device interrupted', code => {
    const error = toSubmitTxError(
      Object.assign(new Error('Device interrupted'), { code }),
    );

    expect(error).toMatchObject({
      name: 'SubmitTxFailed',
      message: 'Device interrupted',
      code,
    });
    expect(isOneKeyDisconnectError(error)).toBe(true);
    expect(isOneKeyDisconnectError(error.message)).toBe(false);
  });

  it('copies errorCode when code is absent', () => {
    const error = toSubmitTxError({
      message: 'Device interrupted',
      errorCode: 109,
    });

    expect(error).toMatchObject({ code: 109, message: 'Device interrupted' });
    expect(isOneKeyDisconnectError(error)).toBe(true);
  });

  it('leaves a code-less interruption ambiguous', () => {
    const error = toSubmitTxError(new Error('Device interrupted'));

    expect(error).toMatchObject({
      name: 'SubmitTxFailed',
      message: 'Device interrupted',
    });
    expect((error as { code?: unknown }).code).toBeUndefined();
    expect(isOneKeyDisconnectError(error)).toBe(false);
  });
});
