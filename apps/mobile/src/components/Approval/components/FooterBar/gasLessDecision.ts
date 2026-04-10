export const shouldAutoSwitchToGasAccountFromGasless = ({
  showGasLess,
  isGasNotEnough,
  canUseGasLess,
  canGotoUseGasAccount,
}: {
  showGasLess: boolean;
  isGasNotEnough: boolean;
  canUseGasLess: boolean;
  canGotoUseGasAccount: boolean;
}) => showGasLess && isGasNotEnough && !canUseGasLess && canGotoUseGasAccount;

export const shouldShowGasLessNotEnough = ({
  showGasLess,
  isGasNotEnough,
  payGasByGasAccount,
  canUseGasLess,
}: {
  showGasLess: boolean;
  isGasNotEnough: boolean;
  payGasByGasAccount: boolean;
  canUseGasLess: boolean;
}) => showGasLess && isGasNotEnough && !payGasByGasAccount && !canUseGasLess;
