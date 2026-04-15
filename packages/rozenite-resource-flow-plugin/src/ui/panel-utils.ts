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
    totalUsdValue: number;
    ownerCount: number;
  }[];
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
    netWorth?: unknown;
  };

  return {
    ownerAddr,
    chainId,
    chainName:
      typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name
        : chainId,
    netWorth:
      typeof candidate.netWorth === 'number' &&
      Number.isFinite(candidate.netWorth)
        ? candidate.netWorth
        : 0,
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
      totalUsdValue: 0,
      owners: new Set<string>(),
    };
    chainEntry.totalUsdValue += parsed.netWorth;
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
        totalUsdValue: item.totalUsdValue,
        ownerCount: item.owners.size,
      }))
      .sort((left, right) => right.totalUsdValue - left.totalUsdValue),
  };
}
