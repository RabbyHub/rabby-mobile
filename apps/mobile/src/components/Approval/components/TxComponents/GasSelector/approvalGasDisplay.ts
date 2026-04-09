import {
  APPROVAL_GAS_DISPLAY_MODE,
  type ApprovalGasDisplayMode,
} from './approvalGasDisplayConfig';

export type ApprovalGasMethod = 'native' | 'gasAccount';

type ResolveApprovalGasMethodParams = {
  mode?: ApprovalGasDisplayMode;
  nativeTokenInsufficient: boolean;
  gasAccountChainSupported: boolean;
  noCustomRPC?: boolean;
  freeGasAvailable?: boolean;
  legacyGasMethod?: ApprovalGasMethod;
};

type ResolveApprovalGasLevelMethodParams = {
  mode?: ApprovalGasDisplayMode;
  isCustom?: boolean;
  nativeTokenInsufficient: boolean;
  gasAccountChainSupported: boolean;
  noCustomRPC?: boolean;
  freeGasAvailable?: boolean;
  currentGasMethod?: ApprovalGasMethod;
};

export const isApprovalSmartGasDisplayEnabled = (
  mode: ApprovalGasDisplayMode = APPROVAL_GAS_DISPLAY_MODE,
) => mode === 'native_insufficient_prefers_gasAccount';

export const shouldHideApprovalGasMethodTabs = (
  mode: ApprovalGasDisplayMode = APPROVAL_GAS_DISPLAY_MODE,
) => isApprovalSmartGasDisplayEnabled(mode);

export const shouldUseLegacyApprovalFooterAutoSwitch = (
  mode: ApprovalGasDisplayMode = APPROVAL_GAS_DISPLAY_MODE,
) => !isApprovalSmartGasDisplayEnabled(mode);

export const getApprovalGasMethodLabel = (method: ApprovalGasMethod): string =>
  method === 'gasAccount' ? 'GasAccount' : 'Native';

export type ShouldAutoSwitchToApprovalGasAccountParams = {
  nativeTokenInsufficient: boolean;
  gasAccountChainSupported: boolean;
  freeGasAvailable?: boolean;
  noCustomRPC?: boolean;
};

export const shouldAutoSwitchToApprovalGasAccount = ({
  nativeTokenInsufficient,
  gasAccountChainSupported,
  freeGasAvailable = false,
  noCustomRPC = true,
}: ShouldAutoSwitchToApprovalGasAccountParams) => {
  if (!nativeTokenInsufficient) {
    return false;
  }
  if (freeGasAvailable) {
    return false;
  }
  return gasAccountChainSupported && noCustomRPC;
};

export const resolveApprovalGasMethod = ({
  mode = APPROVAL_GAS_DISPLAY_MODE,
  nativeTokenInsufficient,
  gasAccountChainSupported,
  noCustomRPC = true,
  freeGasAvailable = false,
  legacyGasMethod = 'native',
}: ResolveApprovalGasMethodParams): ApprovalGasMethod => {
  if (!isApprovalSmartGasDisplayEnabled(mode)) {
    return legacyGasMethod;
  }

  return shouldAutoSwitchToApprovalGasAccount({
    nativeTokenInsufficient,
    gasAccountChainSupported,
    freeGasAvailable,
    noCustomRPC,
  })
    ? 'gasAccount'
    : 'native';
};

export const resolveApprovalGasLevelMethod = ({
  mode = APPROVAL_GAS_DISPLAY_MODE,
  isCustom = false,
  nativeTokenInsufficient,
  gasAccountChainSupported,
  noCustomRPC = true,
  freeGasAvailable = false,
  currentGasMethod = 'native',
}: ResolveApprovalGasLevelMethodParams): ApprovalGasMethod => {
  if (isCustom) {
    return currentGasMethod;
  }

  return resolveApprovalGasMethod({
    mode,
    nativeTokenInsufficient,
    gasAccountChainSupported,
    noCustomRPC,
    freeGasAvailable,
    legacyGasMethod: currentGasMethod,
  });
};

export const isApprovalGasMethodNotEnough = ({
  displayMethod,
  nativeTokenInsufficient,
  gasAccountBalanceEnough,
}: {
  displayMethod: ApprovalGasMethod;
  nativeTokenInsufficient: boolean;
  gasAccountBalanceEnough?: boolean;
}) =>
  displayMethod === 'gasAccount'
    ? gasAccountBalanceEnough === false
    : nativeTokenInsufficient;

export const resolveApprovalDisplayedGasLevelNotEnough = ({
  isActive,
  displayMethod,
  nativeTokenInsufficient,
  gasAccountBalanceEnough,
  levelNativeInsufficient,
  levelGasAccountNotEnough,
}: {
  isActive: boolean;
  displayMethod: ApprovalGasMethod;
  nativeTokenInsufficient: boolean;
  gasAccountBalanceEnough?: boolean;
  levelNativeInsufficient?: boolean;
  levelGasAccountNotEnough?: boolean;
}) => {
  if (isActive) {
    return isApprovalGasMethodNotEnough({
      displayMethod,
      nativeTokenInsufficient,
      gasAccountBalanceEnough,
    });
  }

  return displayMethod === 'gasAccount'
    ? levelGasAccountNotEnough
    : levelNativeInsufficient;
};
