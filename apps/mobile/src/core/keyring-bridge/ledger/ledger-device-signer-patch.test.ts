const {
  SignTransactionDeviceAction,
} = require('@ledgerhq/device-signer-kit-ethereum/internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction.js');

function shouldFallbackToBlindSign(error: Record<string, unknown>) {
  const action = new SignTransactionDeviceAction({ input: {} });
  const machine = action.makeStateMachine({
    getDeviceModel: () => ({ id: 'nanoX' }),
    getDeviceSessionState: () => ({}),
  });

  return machine.implementations.guards.shouldFallbackToBlindSign({
    context: { _internalState: { error } },
  });
}

describe('patched Ledger transaction fallback', () => {
  it('keeps both device refusal status words terminal', () => {
    expect(shouldFallbackToBlindSign({ errorCode: '5501' })).toBe(false);
    expect(shouldFallbackToBlindSign({ errorCode: '6985' })).toBe(false);
    expect(shouldFallbackToBlindSign({ errorCode: '6a80' })).toBe(true);
  });

  it('does not blind-sign after the DMK session is gone', () => {
    expect(shouldFallbackToBlindSign({ _tag: 'DeviceSessionNotFound' })).toBe(
      false,
    );
  });
});
