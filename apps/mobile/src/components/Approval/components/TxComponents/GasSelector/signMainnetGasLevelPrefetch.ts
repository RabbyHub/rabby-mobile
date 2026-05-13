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

export const resolveSignMainnetGasLevelFetchNeeds = ({
  gasAccountChainSupported,
}: {
  gasAccountChainSupported: boolean;
}) => ({
  needsNative: true,
  needsGasAccount: gasAccountChainSupported,
});

export const shouldFetchSignMainnetGasLevel = ({
  state,
  needsNative,
  needsGasAccount,
  hasActiveRequest = false,
}: {
  state?: SignMainnetGasLevelState[SignMainnetSupportedGasLevel];
  needsNative: boolean;
  needsGasAccount: boolean;
  hasActiveRequest?: boolean;
}) => {
  const hasNativeData =
    state?.nativeUsd !== undefined && state?.nativeNotEnough !== undefined;
  const hasGasAccountData = state?.gasAccount !== undefined;

  if (state?.loading && hasActiveRequest) {
    return false;
  }

  return (
    (needsNative && !hasNativeData) || (needsGasAccount && !hasGasAccountData)
  );
};

const isNativeGasLevelUsable = (
  state?: SignMainnetGasLevelState[SignMainnetSupportedGasLevel],
) => state?.nativeNotEnough === false;

const isGasAccountGasLevelUsable = ({
  state,
  gasAccountChainSupported,
}: {
  state?: SignMainnetGasLevelState[SignMainnetSupportedGasLevel];
  gasAccountChainSupported: boolean;
}) =>
  !!(
    gasAccountChainSupported &&
    state?.gasAccount &&
    state.gasAccount[0] === false
  );

const getSignMainnetDowngradeLevels = (
  selectedSupportedLevel: SignMainnetSupportedGasLevel,
) => {
  const selectedIndex = SIGN_MAINNET_SUPPORTED_GAS_LEVELS.indexOf(
    selectedSupportedLevel,
  );

  return SIGN_MAINNET_SUPPORTED_GAS_LEVELS.slice(
    0,
    selectedIndex + 1,
  ).reverse();
};

export const resolveSignMainnetAutoGasSelection = ({
  fetchMode,
  autoDowngradeEnabled = true,
  selectedSupportedLevel,
  nativeTokenInsufficient,
  gasAccountUsable,
  gasAccountChainSupported,
  levelState,
}: {
  fetchMode: 'idle' | 'prefetch' | 'open';
  autoDowngradeEnabled?: boolean;
  selectedSupportedLevel?: SignMainnetSupportedGasLevel;
  nativeTokenInsufficient: boolean;
  gasAccountUsable: boolean;
  gasAccountChainSupported: boolean;
  levelState: SignMainnetGasLevelState;
}): null | {
  gasMethod: 'native' | 'gasAccount';
  level: SignMainnetSupportedGasLevel;
} => {
  if (
    fetchMode !== 'prefetch' ||
    !autoDowngradeEnabled ||
    !selectedSupportedLevel ||
    !nativeTokenInsufficient ||
    gasAccountUsable
  ) {
    return null;
  }

  const levelsToCheck = getSignMainnetDowngradeLevels(selectedSupportedLevel);

  for (const level of levelsToCheck) {
    const state = levelState[level];

    if (level !== selectedSupportedLevel) {
      if (state?.nativeNotEnough === undefined) {
        return null;
      }

      if (isNativeGasLevelUsable(state)) {
        return {
          gasMethod: 'native',
          level,
        };
      }
    }

    if (gasAccountChainSupported) {
      if (!state?.gasAccount) {
        return null;
      }

      if (
        isGasAccountGasLevelUsable({
          state,
          gasAccountChainSupported,
        })
      ) {
        return {
          gasMethod: 'gasAccount',
          level,
        };
      }
    }
  }

  return null;
};
