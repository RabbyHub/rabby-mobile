export const SIGN_MAINNET_SUPPORTED_GAS_LEVELS = [
  'slow',
  'normal',
  'fast',
] as const;

export type SignMainnetSupportedGasLevel =
  (typeof SIGN_MAINNET_SUPPORTED_GAS_LEVELS)[number];

export type SignMainnetGasLevelState = Partial<
  Record<
    SignMainnetSupportedGasLevel,
    {
      nativeUsd?: string;
      nativeNotEnough?: boolean;
      gasAccount?: [boolean, string];
      loading?: boolean;
    }
  >
>;

export const resolveSignMainnetGasLevelFetchMode = ({
  isReady,
  isModalOpen,
  nativeTokenInsufficient,
  gasAccountUsable,
}: {
  isReady: boolean;
  isModalOpen: boolean;
  nativeTokenInsufficient: boolean;
  gasAccountUsable: boolean;
}) => {
  if (!isReady) {
    return 'idle' as const;
  }

  if (nativeTokenInsufficient && !gasAccountUsable) {
    return 'prefetch' as const;
  }

  return isModalOpen ? ('open' as const) : ('idle' as const);
};

const isSignMainnetSupportedGasLevel = (
  level?: string | null,
): level is SignMainnetSupportedGasLevel =>
  !!level &&
  SIGN_MAINNET_SUPPORTED_GAS_LEVELS.includes(
    level as SignMainnetSupportedGasLevel,
  );

export const buildCurrentLevelGasState = ({
  selectedGasLevel,
  displayGasMethod,
  selectedGasCostUsd,
  nativeTokenInsufficient,
  gasAccountBalanceEnough,
  selectedGasAccountCostUsd,
}: {
  selectedGasLevel?: string | null;
  displayGasMethod: 'native' | 'gasAccount';
  selectedGasCostUsd: string;
  nativeTokenInsufficient: boolean;
  gasAccountBalanceEnough?: boolean;
  selectedGasAccountCostUsd?: string;
}): SignMainnetGasLevelState => {
  if (!isSignMainnetSupportedGasLevel(selectedGasLevel)) {
    return {};
  }

  return {
    [selectedGasLevel]: {
      nativeUsd: displayGasMethod === 'native' ? selectedGasCostUsd : undefined,
      nativeNotEnough: nativeTokenInsufficient,
      gasAccount:
        selectedGasAccountCostUsd && gasAccountBalanceEnough !== undefined
          ? [!gasAccountBalanceEnough, selectedGasAccountCostUsd]
          : undefined,
      loading: false,
    },
  };
};

export const mergeCurrentLevelGasState = ({
  prevState,
  currentLevelState,
}: {
  prevState: SignMainnetGasLevelState;
  currentLevelState: SignMainnetGasLevelState;
}): SignMainnetGasLevelState => ({
  ...prevState,
  ...currentLevelState,
});

export const resolveSignMainnetGasLevelFetchNeeds = ({
  isCurrentLevel,
  gasAccountChainSupported,
  hasCurrentGasAccountCost,
}: {
  isCurrentLevel: boolean;
  gasAccountChainSupported: boolean;
  hasCurrentGasAccountCost: boolean;
}) => ({
  needsNative: !isCurrentLevel,
  needsGasAccount:
    gasAccountChainSupported && (!isCurrentLevel || !hasCurrentGasAccountCost),
});

export const shouldFetchSignMainnetGasLevel = ({
  state,
  needsNative,
  needsGasAccount,
}: {
  state?: SignMainnetGasLevelState[SignMainnetSupportedGasLevel];
  needsNative: boolean;
  needsGasAccount: boolean;
}) => {
  const hasNativeData =
    state?.nativeUsd !== undefined && state?.nativeNotEnough !== undefined;
  const hasGasAccountData = state?.gasAccount !== undefined;

  if (state?.loading) {
    return false;
  }

  return (
    (needsNative && !hasNativeData) || (needsGasAccount && !hasGasAccountData)
  );
};

export const hasUsableSiblingSignMainnetGasLevel = ({
  selectedSupportedLevel,
  gasAccountChainSupported,
  levelState,
}: {
  selectedSupportedLevel?: SignMainnetSupportedGasLevel;
  gasAccountChainSupported: boolean;
  levelState: SignMainnetGasLevelState;
}) =>
  SIGN_MAINNET_SUPPORTED_GAS_LEVELS.some(level => {
    if (level === selectedSupportedLevel) {
      return false;
    }

    const state = levelState[level];
    if (!state) {
      return false;
    }

    if (state.nativeUsd !== undefined && state.nativeNotEnough === false) {
      return true;
    }

    return !!(
      gasAccountChainSupported &&
      state.nativeNotEnough === true &&
      state.gasAccount &&
      state.gasAccount[0] === false
    );
  });

export const shouldAutoOpenSignMainnetGasModal = ({
  fetchMode,
  selectedSupportedLevel,
  nativeTokenInsufficient,
  gasAccountUsable,
  gasAccountChainSupported,
  levelState,
}: {
  fetchMode: 'idle' | 'prefetch' | 'open';
  selectedSupportedLevel?: SignMainnetSupportedGasLevel;
  nativeTokenInsufficient: boolean;
  gasAccountUsable: boolean;
  gasAccountChainSupported: boolean;
  levelState: SignMainnetGasLevelState;
}) =>
  fetchMode === 'prefetch' &&
  nativeTokenInsufficient &&
  !gasAccountUsable &&
  hasUsableSiblingSignMainnetGasLevel({
    selectedSupportedLevel,
    gasAccountChainSupported,
    levelState,
  });
