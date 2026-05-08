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

export const resolveGasAccountAutoSwitchOnce = ({
  shouldAutoSwitch,
  payGasByGasAccount,
  hasAutoSwitched,
}: {
  shouldAutoSwitch: boolean;
  payGasByGasAccount: boolean;
  hasAutoSwitched: boolean;
}) => {
  if (!shouldAutoSwitch) {
    return {
      shouldSwitch: false,
      nextHasAutoSwitched: false,
    };
  }

  if (payGasByGasAccount) {
    return {
      shouldSwitch: false,
      nextHasAutoSwitched: true,
    };
  }

  if (hasAutoSwitched) {
    return {
      shouldSwitch: false,
      nextHasAutoSwitched: true,
    };
  }

  return {
    shouldSwitch: true,
    nextHasAutoSwitched: true,
  };
};
