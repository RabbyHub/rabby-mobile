import type { SignatureFlowState } from './types';

const GAS_FEE_TOO_HIGH = 1;
const PROCESS_DISABLED = 2;

export function selectSignatureGuardFlags(state: SignatureFlowState) {
  return (
    (state.ctx?.gasFeeTooHigh ? GAS_FEE_TOO_HIGH : 0) +
    (state.ctx?.disabledProcess ? PROCESS_DISABLED : 0)
  );
}

export function isSignatureGasFeeTooHigh(flags: number) {
  return flags % PROCESS_DISABLED === GAS_FEE_TOO_HIGH;
}

export function canProcessSignature(flags: number) {
  return flags < PROCESS_DISABLED;
}
