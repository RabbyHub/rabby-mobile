import type {
  ResourceFlowResourceSnapshot,
  ResourceFlowTraceEntry,
} from '../shared/types';

const APPCHAIN_RESOURCE_KEY_SEPARATOR = '::';

export type FamilySummary = {
  family: string;
  resourceCount: number;
  valueCount: number;
  loadingCount: number;
  errorCount: number;
  traceCount: number;
  latestUpdatedAt?: number;
};

export type AppChainFamilyStats = {
  totalUsdValue: number;
  uniqueAddressCount: number;
  uniqueChainCount: number;
  addressTotals: {
    ownerAddr: string;
    totalUsdValue: number;
    chainCount: number;
  }[];
  chainTotals: {
    chainId: string;
    chainName: string;
    chainLogoUrl?: string;
    totalUsdValue: number;
    ownerCount: number;
  }[];
};

export type AddressBalanceResourceBreakdown = {
  address: string;
  totalBalance: number;
  recordedEvmBalance: number;
  appChainValue: number;
  appChainValueSource: 'resource' | 'inferred';
  comparableBalance: number;
  evmDelta: number;
};

export type AddressBalanceFamilyStats = {
  totalBalance: number;
  totalRecordedEvmBalance: number;
  totalAppChainValue: number;
  totalComparableBalance: number;
  totalEvmDelta: number;
  addresses: AddressBalanceResourceBreakdown[];
};

export type ResourceTraceSourceInfo = {
  sourceOfCurrentValue?: 'hydrate' | 'remote';
  traceSource?: string;
  endpoint?: string;
  summary: string;
};

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function formatTimestamp(value?: number) {
  if (!value) {
    return 'n/a';
  }

  return new Date(value).toLocaleString();
}

export function formatUsd(value: number, compact = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

export function formatSignedUsd(value: number, compact = false) {
  const prefix = value > 0 ? '+' : '';

  return `${prefix}${formatUsd(value, compact)}`;
}

export function toJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

export function formatLabel(value?: string) {
  if (!value) {
    return 'Unknown';
  }

  return value
    .replace(/_/gu, ' ')
    .replace(/\b\w/gu, letter => letter.toUpperCase());
}

export function getStatusTone(
  status?: string,
): 'success' | 'processing' | 'warning' | 'error' | 'default' {
  if (!status) {
    return 'default';
  }

  if (
    status === 'success' ||
    status === 'hydrate_applied' ||
    status === 'remote_fetch_succeeded' ||
    status === 'persist_succeeded'
  ) {
    return 'success';
  }

  if (
    status === 'error' ||
    status === 'hydrate_failed' ||
    status === 'remote_fetch_failed' ||
    status === 'persist_failed'
  ) {
    return 'error';
  }

  if (
    status === 'queued' ||
    status === 'persisting' ||
    status === 'hydrate_started' ||
    status === 'remote_fetch_started' ||
    status === 'persist_enqueued'
  ) {
    return 'warning';
  }

  return 'processing';
}

export function getResourceUpdatedAt(resource: ResourceFlowResourceSnapshot) {
  const meta = resource.meta;

  return Math.max(
    meta.lastHydratedAt || 0,
    meta.lastRemoteAt || 0,
    meta.lastPersistAt || 0,
  );
}

export function buildFamilySummary(
  family: string,
  resources: ResourceFlowResourceSnapshot[],
  entries: ResourceFlowTraceEntry[],
): FamilySummary {
  return {
    family,
    resourceCount: resources.length,
    valueCount: resources.filter(item => item.meta.hasValue).length,
    loadingCount: resources.filter(item => {
      return item.meta.isHydrating || item.meta.isFetchingRemote;
    }).length,
    errorCount: resources.filter(item => item.meta.lastError).length,
    traceCount: entries.length,
    latestUpdatedAt:
      resources.reduce((latest, resource) => {
        return Math.max(latest, getResourceUpdatedAt(resource));
      }, 0) || undefined,
  };
}

export function parseAppChainResource(resource: ResourceFlowResourceSnapshot):
  | {
      ownerAddr: string;
      chainId: string;
      chainName: string;
      chainLogoUrl?: string;
      netWorth: number;
    }
  | undefined {
  if (resource.family !== 'appchain' || !resource.meta.hasValue) {
    return undefined;
  }

  const [ownerAddr, ...chainIdParts] = resource.resourceKey.split(
    APPCHAIN_RESOURCE_KEY_SEPARATOR,
  );
  const chainId = chainIdParts.join(APPCHAIN_RESOURCE_KEY_SEPARATOR);

  if (
    !ownerAddr ||
    !chainId ||
    !resource.value ||
    typeof resource.value !== 'object'
  ) {
    return undefined;
  }

  const candidate = resource.value as {
    name?: unknown;
    logo_url?: unknown;
    netWorth?: unknown;
  };

  return {
    ownerAddr,
    chainId,
    chainName:
      typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name
        : chainId,
    chainLogoUrl:
      typeof candidate.logo_url === 'string' && candidate.logo_url.trim()
        ? candidate.logo_url
        : undefined,
    netWorth:
      typeof candidate.netWorth === 'number' &&
      Number.isFinite(candidate.netWorth)
        ? candidate.netWorth
        : 0,
  };
}

export function parseAddressBalanceResource(
  resource: ResourceFlowResourceSnapshot,
):
  | {
      address: string;
      totalBalance: number;
      evmBalance: number;
    }
  | undefined {
  if (resource.family !== 'addressBalance' || !resource.meta.hasValue) {
    return undefined;
  }

  if (!resource.value || typeof resource.value !== 'object') {
    return undefined;
  }

  const candidate = resource.value as {
    totalBalance?: unknown;
    evmBalance?: unknown;
  };

  if (
    typeof candidate.totalBalance !== 'number' ||
    !Number.isFinite(candidate.totalBalance) ||
    typeof candidate.evmBalance !== 'number' ||
    !Number.isFinite(candidate.evmBalance)
  ) {
    return undefined;
  }

  return {
    address: resource.resourceKey.toLowerCase(),
    totalBalance: candidate.totalBalance,
    evmBalance: candidate.evmBalance,
  };
}

export function buildAppChainTotalsByAddress(
  resources: ResourceFlowResourceSnapshot[],
) {
  const totals = new Map<string, number>();

  resources.forEach(resource => {
    const parsed = parseAppChainResource(resource);

    if (!parsed) {
      return;
    }

    totals.set(
      parsed.ownerAddr,
      (totals.get(parsed.ownerAddr) || 0) + parsed.netWorth,
    );
  });

  return totals;
}

function buildAddressBalanceResourceBreakdownFromMap(
  resource: ResourceFlowResourceSnapshot,
  appChainTotalsByAddress: Map<string, number>,
): AddressBalanceResourceBreakdown | undefined {
  const parsed = parseAddressBalanceResource(resource);

  if (!parsed) {
    return undefined;
  }

  const inferredAppChainValue = parsed.totalBalance - parsed.evmBalance;
  const appChainValueFromResource = appChainTotalsByAddress.get(parsed.address);
  const hasResourceAppChainValue =
    typeof appChainValueFromResource === 'number' &&
    Number.isFinite(appChainValueFromResource);
  const appChainValue = hasResourceAppChainValue
    ? appChainValueFromResource
    : inferredAppChainValue;
  const comparableBalance = parsed.totalBalance - appChainValue;

  return {
    address: parsed.address,
    totalBalance: parsed.totalBalance,
    recordedEvmBalance: parsed.evmBalance,
    appChainValue,
    appChainValueSource: hasResourceAppChainValue ? 'resource' : 'inferred',
    comparableBalance,
    evmDelta: comparableBalance - parsed.evmBalance,
  };
}

export function buildAppChainFamilyStats(
  resources: ResourceFlowResourceSnapshot[],
): AppChainFamilyStats {
  const addressTotals = new Map<
    string,
    {
      totalUsdValue: number;
      chainCount: number;
    }
  >();
  const chainTotals = new Map<
    string,
    {
      chainId: string;
      chainName: string;
      chainLogoUrl?: string;
      totalUsdValue: number;
      owners: Set<string>;
    }
  >();

  resources.forEach(resource => {
    const parsed = parseAppChainResource(resource);

    if (!parsed) {
      return;
    }

    const addressEntry = addressTotals.get(parsed.ownerAddr) || {
      totalUsdValue: 0,
      chainCount: 0,
    };
    addressEntry.totalUsdValue += parsed.netWorth;
    addressEntry.chainCount += 1;
    addressTotals.set(parsed.ownerAddr, addressEntry);

    const chainEntry = chainTotals.get(parsed.chainId) || {
      chainId: parsed.chainId,
      chainName: parsed.chainName,
      chainLogoUrl: parsed.chainLogoUrl,
      totalUsdValue: 0,
      owners: new Set<string>(),
    };
    chainEntry.totalUsdValue += parsed.netWorth;
    if (!chainEntry.chainLogoUrl && parsed.chainLogoUrl) {
      chainEntry.chainLogoUrl = parsed.chainLogoUrl;
    }
    chainEntry.owners.add(parsed.ownerAddr);
    chainTotals.set(parsed.chainId, chainEntry);
  });

  return {
    totalUsdValue: Array.from(addressTotals.values()).reduce((total, item) => {
      return total + item.totalUsdValue;
    }, 0),
    uniqueAddressCount: addressTotals.size,
    uniqueChainCount: chainTotals.size,
    addressTotals: Array.from(addressTotals.entries())
      .map(([ownerAddr, item]) => ({
        ownerAddr,
        totalUsdValue: item.totalUsdValue,
        chainCount: item.chainCount,
      }))
      .sort((left, right) => right.totalUsdValue - left.totalUsdValue),
    chainTotals: Array.from(chainTotals.values())
      .map(item => ({
        chainId: item.chainId,
        chainName: item.chainName,
        chainLogoUrl: item.chainLogoUrl,
        totalUsdValue: item.totalUsdValue,
        ownerCount: item.owners.size,
      }))
      .sort((left, right) => right.totalUsdValue - left.totalUsdValue),
  };
}

function getTraceSourceValue(entry?: ResourceFlowTraceEntry) {
  return typeof entry?.detail?.source === 'string'
    ? entry.detail.source
    : undefined;
}

function getTraceEndpointValue(entry?: ResourceFlowTraceEntry) {
  return typeof entry?.detail?.endpoint === 'string'
    ? entry.detail.endpoint
    : undefined;
}

function buildTraceSummary(
  sourceOfCurrentValue: 'hydrate' | 'remote' | undefined,
  traceSource?: string,
  endpoint?: string,
) {
  const phase = sourceOfCurrentValue || 'n/a';
  const specific = endpoint || traceSource;

  return specific ? `${phase} · ${specific}` : phase;
}

export function getResourceTraceSourceInfo(
  resource: ResourceFlowResourceSnapshot,
  entries: ResourceFlowTraceEntry[],
): ResourceTraceSourceInfo {
  const resourceEntries = entries
    .filter(entry => {
      return (
        entry.family === resource.family &&
        entry.resourceKey === resource.resourceKey
      );
    })
    .sort((left, right) => right.at - left.at);

  let preferredTypes: ResourceFlowTraceEntry['type'][] = [];

  if (resource.meta.sourceOfCurrentValue === 'remote') {
    preferredTypes = [
      'remote_fetch_succeeded',
      'remote_fetch_started',
      'remote_fetch_ignored_stale',
      'remote_fetch_failed',
    ];
  } else if (resource.meta.sourceOfCurrentValue === 'hydrate') {
    preferredTypes = [
      'hydrate_applied',
      'hydrate_started',
      'hydrate_skipped',
      'hydrate_failed',
    ];
  }

  const preferredEntry =
    preferredTypes
      .map(type => {
        return resourceEntries.find(entry => entry.type === type);
      })
      .find(Boolean) ||
    resourceEntries.find(entry => {
      return (
        typeof entry.detail?.endpoint === 'string' ||
        typeof entry.detail?.source === 'string'
      );
    });

  const traceSource = getTraceSourceValue(preferredEntry);
  const endpoint = getTraceEndpointValue(preferredEntry);

  return {
    sourceOfCurrentValue: resource.meta.sourceOfCurrentValue,
    traceSource,
    endpoint,
    summary: buildTraceSummary(
      resource.meta.sourceOfCurrentValue,
      traceSource,
      endpoint,
    ),
  };
}

export function buildAddressBalanceResourceBreakdown(
  resource: ResourceFlowResourceSnapshot,
  resources: ResourceFlowResourceSnapshot[],
) {
  return buildAddressBalanceResourceBreakdownFromMap(
    resource,
    buildAppChainTotalsByAddress(resources),
  );
}

export function buildAddressBalanceFamilyStats(
  addressBalanceResources: ResourceFlowResourceSnapshot[],
  resources: ResourceFlowResourceSnapshot[],
): AddressBalanceFamilyStats {
  const appChainTotalsByAddress = buildAppChainTotalsByAddress(resources);
  const addresses = addressBalanceResources
    .map(resource =>
      buildAddressBalanceResourceBreakdownFromMap(
        resource,
        appChainTotalsByAddress,
      ),
    )
    .filter(
      (
        item,
      ): item is NonNullable<
        ReturnType<typeof buildAddressBalanceResourceBreakdownFromMap>
      > => Boolean(item),
    )
    .sort((left, right) => right.totalBalance - left.totalBalance);

  return {
    totalBalance: addresses.reduce((total, item) => {
      return total + item.totalBalance;
    }, 0),
    totalRecordedEvmBalance: addresses.reduce((total, item) => {
      return total + item.recordedEvmBalance;
    }, 0),
    totalAppChainValue: addresses.reduce((total, item) => {
      return total + item.appChainValue;
    }, 0),
    totalComparableBalance: addresses.reduce((total, item) => {
      return total + item.comparableBalance;
    }, 0),
    totalEvmDelta: addresses.reduce((total, item) => {
      return total + item.evmDelta;
    }, 0),
    addresses,
  };
}
