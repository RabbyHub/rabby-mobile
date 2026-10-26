import {
  buildPortfolioAddressChange,
  buildPortfolioAggregateChange,
} from './consistency';

export type HomeProjectionAvailability =
  | 'unresolved'
  | 'loading'
  | 'partial'
  | 'ready'
  | 'empty';

export type HomeProjectionResourceFlow = {
  isHydrating?: boolean;
  isFetchingRemote?: boolean;
  isComputing?: boolean;
};

export type HomeProjectionActivity = {
  isHydrating: boolean;
  isFetchingRemote: boolean;
  isComputing: boolean;
  isActive: boolean;
  activeAddresses: string[];
};

export type HomeAccountProjection = {
  availability: HomeProjectionAvailability;
  addresses: string[];
  selectionSignature: string;
  selectionGeneration: number;
  hasResolvedSelection: boolean;
  hasResolvedAccountContext: boolean;
  hasFetchedAccounts: boolean;
  matteredAccountLength: number;
  isPendingMatteredAccountLength: boolean;
  activity: HomeProjectionActivity;
};

export type HomeBalanceValue = {
  evmBalance: number;
  totalBalance: number;
};

export type HomeBalanceProjection = {
  availability: HomeProjectionAvailability;
  selectionSignature: string;
  selectionGeneration: number;
  sourceAddresses: string[];
  missingAddresses: string[];
  value?: HomeBalanceValue;
  activity: HomeProjectionActivity;
};

export type Home24hChangeValue = {
  rawChange: number;
  changePercent: string;
  isLoss: boolean;
  currentEvmBalance: number;
  previousEvmBalance: number;
};

export type Home24hProjection = {
  availability: HomeProjectionAvailability;
  selectionSignature: string;
  selectionGeneration: number;
  sourceAddresses: string[];
  missingAddresses: string[];
  value?: Home24hChangeValue;
  activity: HomeProjectionActivity;
};

export type HomeAccountProjectionInput = {
  selectedAddresses: string[];
  hasResolvedSelection: boolean;
  matteredAccountLength: number;
  hasResolvedMatteredAccountLength: boolean;
  hasFetchedAccounts: boolean;
  isFetchingAccounts: boolean;
};

export type HomeBalanceProjectionInput = {
  account: HomeAccountProjection;
  valueMap: Record<string, HomeBalanceValue | undefined>;
  flowMap?: Record<string, HomeProjectionResourceFlow | undefined>;
};

export type Home24hProjectionInput = {
  account: HomeAccountProjection;
  currentBalanceMap: Record<string, HomeBalanceValue | undefined>;
  previousBalanceMap: Record<
    string,
    | {
        total_usd_value: number;
      }
    | undefined
  >;
  currentFlowMap?: Record<string, HomeProjectionResourceFlow | undefined>;
  previousFlowMap?: Record<string, HomeProjectionResourceFlow | undefined>;
  isComputing?: boolean;
};

const EMPTY_ACTIVITY: HomeProjectionActivity = {
  isHydrating: false,
  isFetchingRemote: false,
  isComputing: false,
  isActive: false,
  activeAddresses: [],
};

export function normalizeHomeProjectionAddresses(addresses: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  addresses.forEach(address => {
    const lowerAddress = address.toLowerCase();
    if (!lowerAddress || seen.has(lowerAddress)) {
      return;
    }

    seen.add(lowerAddress);
    normalized.push(lowerAddress);
  });

  return normalized;
}

export function getHomeSelectionSignature(addresses: string[]) {
  return normalizeHomeProjectionAddresses(addresses).sort().join('|');
}

export function isHomeProjectionWaitingForValue(
  availability: HomeProjectionAvailability,
) {
  return availability === 'unresolved' || availability === 'loading';
}

export function buildHomeProjectionActivity(
  addresses: string[],
  flowMaps: Array<
    Record<string, HomeProjectionResourceFlow | undefined> | undefined
  >,
  isComputing = false,
): HomeProjectionActivity {
  let isHydrating = false;
  let isFetchingRemote = false;
  const activeAddresses: string[] = [];

  addresses.forEach(address => {
    let isAddressActive = false;
    flowMaps.forEach(flowMap => {
      const flow = flowMap?.[address];
      isHydrating ||= !!flow?.isHydrating;
      isFetchingRemote ||= !!flow?.isFetchingRemote;
      isAddressActive ||= !!(
        flow?.isHydrating ||
        flow?.isFetchingRemote ||
        flow?.isComputing
      );
    });

    if (isAddressActive) {
      activeAddresses.push(address);
    }
  });

  const hasComputingAddress = addresses.some(address =>
    flowMaps.some(flowMap => !!flowMap?.[address]?.isComputing),
  );
  const isAnyComputing = isComputing || hasComputingAddress;

  return {
    isHydrating,
    isFetchingRemote,
    isComputing: isAnyComputing,
    isActive:
      isHydrating ||
      isFetchingRemote ||
      isAnyComputing ||
      !!activeAddresses.length,
    activeAddresses,
  };
}

function getProjectionAvailability(input: {
  account: HomeAccountProjection;
  sourceCount: number;
  missingCount: number;
}): HomeProjectionAvailability {
  const { account, sourceCount, missingCount } = input;

  if (account.availability === 'unresolved') {
    return 'unresolved';
  }
  if (!account.addresses.length) {
    return 'empty';
  }
  if (!sourceCount) {
    return 'loading';
  }
  if (account.availability === 'partial' || missingCount > 0) {
    return 'partial';
  }

  return 'ready';
}

export function areHomeProjectionAddressListsEqual(
  left: string[],
  right: string[],
) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

export function areHomeProjectionActivitiesEqual(
  left: HomeProjectionActivity,
  right: HomeProjectionActivity,
) {
  return (
    left.isHydrating === right.isHydrating &&
    left.isFetchingRemote === right.isFetchingRemote &&
    left.isComputing === right.isComputing &&
    left.isActive === right.isActive &&
    areHomeProjectionAddressListsEqual(
      left.activeAddresses,
      right.activeAddresses,
    )
  );
}

export function createInitialHomeAccountProjection(): HomeAccountProjection {
  return {
    availability: 'unresolved',
    addresses: [],
    selectionSignature: '',
    selectionGeneration: 0,
    hasResolvedSelection: false,
    hasResolvedAccountContext: false,
    hasFetchedAccounts: false,
    matteredAccountLength: 0,
    isPendingMatteredAccountLength: true,
    activity: EMPTY_ACTIVITY,
  };
}

export function reduceHomeAccountProjection(
  previous: HomeAccountProjection,
  input: HomeAccountProjectionInput,
): HomeAccountProjection {
  const addresses = normalizeHomeProjectionAddresses(input.selectedAddresses);
  const selectionSignature = getHomeSelectionSignature(addresses);
  const selectionGeneration =
    selectionSignature === previous.selectionSignature
      ? previous.selectionGeneration
      : previous.selectionGeneration + 1;
  const hasResolvedAccountContext =
    input.hasResolvedSelection ||
    (input.hasFetchedAccounts && !input.isFetchingAccounts);
  const availability: HomeProjectionAvailability = addresses.length
    ? input.hasResolvedSelection
      ? 'ready'
      : 'partial'
    : hasResolvedAccountContext
    ? 'empty'
    : 'unresolved';
  const activity: HomeProjectionActivity = {
    ...EMPTY_ACTIVITY,
    isFetchingRemote: input.isFetchingAccounts,
    isActive: input.isFetchingAccounts,
  };
  const next: HomeAccountProjection = {
    availability,
    addresses,
    selectionSignature,
    selectionGeneration,
    hasResolvedSelection: input.hasResolvedSelection,
    hasResolvedAccountContext,
    hasFetchedAccounts: input.hasFetchedAccounts,
    matteredAccountLength: input.matteredAccountLength,
    isPendingMatteredAccountLength: !input.hasResolvedMatteredAccountLength,
    activity,
  };

  if (
    previous.availability === next.availability &&
    previous.selectionSignature === next.selectionSignature &&
    previous.selectionGeneration === next.selectionGeneration &&
    previous.hasResolvedSelection === next.hasResolvedSelection &&
    previous.hasResolvedAccountContext === next.hasResolvedAccountContext &&
    previous.hasFetchedAccounts === next.hasFetchedAccounts &&
    previous.matteredAccountLength === next.matteredAccountLength &&
    previous.isPendingMatteredAccountLength ===
      next.isPendingMatteredAccountLength &&
    areHomeProjectionActivitiesEqual(previous.activity, next.activity)
  ) {
    return previous;
  }

  return next;
}

export function buildHomeBalanceProjection(
  input: HomeBalanceProjectionInput,
): HomeBalanceProjection {
  const { account } = input;
  const sourceAddresses = account.addresses.filter(
    address => !!input.valueMap[address],
  );
  const missingAddresses = account.addresses.filter(
    address => !input.valueMap[address],
  );
  const value = sourceAddresses.length
    ? sourceAddresses.reduce<HomeBalanceValue>(
        (result, address) => {
          const addressValue = input.valueMap[address];
          if (addressValue) {
            result.evmBalance += addressValue.evmBalance;
            result.totalBalance += addressValue.totalBalance;
          }
          return result;
        },
        { evmBalance: 0, totalBalance: 0 },
      )
    : undefined;

  return {
    availability: getProjectionAvailability({
      account,
      sourceCount: sourceAddresses.length,
      missingCount: missingAddresses.length,
    }),
    selectionSignature: account.selectionSignature,
    selectionGeneration: account.selectionGeneration,
    sourceAddresses,
    missingAddresses,
    value,
    activity: buildHomeProjectionActivity(account.addresses, [input.flowMap]),
  };
}

export function buildHome24hProjection(
  input: Home24hProjectionInput,
): Home24hProjection {
  const { account } = input;
  const addressChanges = account.addresses.reduce((result, address) => {
    result[address] = buildPortfolioAddressChange({
      currentEvmBalance: input.currentBalanceMap[address]?.evmBalance,
      previousEvmBalance: input.previousBalanceMap[address]?.total_usd_value,
    });
    return result;
  }, {} as Record<string, ReturnType<typeof buildPortfolioAddressChange>>);
  const sourceAddresses = account.addresses.filter(
    address => !!addressChanges[address],
  );
  const missingAddresses = account.addresses.filter(
    address => !sourceAddresses.includes(address),
  );
  const value: Home24hChangeValue | undefined = buildPortfolioAggregateChange(
    sourceAddresses.map(address => addressChanges[address]),
  );

  return {
    availability: getProjectionAvailability({
      account,
      sourceCount: sourceAddresses.length,
      missingCount: missingAddresses.length,
    }),
    selectionSignature: account.selectionSignature,
    selectionGeneration: account.selectionGeneration,
    sourceAddresses,
    missingAddresses,
    value,
    activity: buildHomeProjectionActivity(
      account.addresses,
      [input.currentFlowMap, input.previousFlowMap],
      input.isComputing,
    ),
  };
}

export function areHomeBalanceProjectionsEqual(
  previous: HomeBalanceProjection,
  next: HomeBalanceProjection,
) {
  return (
    previous.availability === next.availability &&
    previous.selectionSignature === next.selectionSignature &&
    previous.selectionGeneration === next.selectionGeneration &&
    areHomeProjectionAddressListsEqual(
      previous.sourceAddresses,
      next.sourceAddresses,
    ) &&
    areHomeProjectionAddressListsEqual(
      previous.missingAddresses,
      next.missingAddresses,
    ) &&
    previous.value?.evmBalance === next.value?.evmBalance &&
    previous.value?.totalBalance === next.value?.totalBalance &&
    areHomeProjectionActivitiesEqual(previous.activity, next.activity)
  );
}

export function areHome24hProjectionsEqual(
  previous: Home24hProjection,
  next: Home24hProjection,
) {
  return (
    previous.availability === next.availability &&
    previous.selectionSignature === next.selectionSignature &&
    previous.selectionGeneration === next.selectionGeneration &&
    areHomeProjectionAddressListsEqual(
      previous.sourceAddresses,
      next.sourceAddresses,
    ) &&
    areHomeProjectionAddressListsEqual(
      previous.missingAddresses,
      next.missingAddresses,
    ) &&
    previous.value?.rawChange === next.value?.rawChange &&
    previous.value?.changePercent === next.value?.changePercent &&
    previous.value?.isLoss === next.value?.isLoss &&
    previous.value?.currentEvmBalance === next.value?.currentEvmBalance &&
    previous.value?.previousEvmBalance === next.value?.previousEvmBalance &&
    areHomeProjectionActivitiesEqual(previous.activity, next.activity)
  );
}
