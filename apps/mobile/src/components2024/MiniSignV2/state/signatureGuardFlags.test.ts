import {
  canProcessSignature,
  isSignatureGasFeeTooHigh,
  selectSignatureGuardFlags,
} from './signatureGuardFlags';
import type { SignatureFlowState } from './types';

function stateWithContext(ctx: SignatureFlowState['ctx']): SignatureFlowState {
  return {
    status: 'ready',
    ctx,
  };
}

describe('signature guard flags', () => {
  it('keeps unrelated signature state changes out of the selected value', () => {
    expect(selectSignatureGuardFlags({ status: 'idle' })).toBe(
      selectSignatureGuardFlags({ status: 'prefetching' }),
    );
  });

  it('represents gas risk and process availability independently', () => {
    const flags = selectSignatureGuardFlags(
      stateWithContext({
        gasFeeTooHigh: true,
        disabledProcess: true,
      } as SignatureFlowState['ctx']),
    );

    expect(isSignatureGasFeeTooHigh(flags)).toBe(true);
    expect(canProcessSignature(flags)).toBe(false);
  });

  it('keeps the default execution behavior when no context exists', () => {
    const flags = selectSignatureGuardFlags({ status: 'idle' });

    expect(isSignatureGasFeeTooHigh(flags)).toBe(false);
    expect(canProcessSignature(flags)).toBe(true);
  });
});
