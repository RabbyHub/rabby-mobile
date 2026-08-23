export type PerpsRemoteListSource = 'remote' | 'memory' | 'default';

export type PerpsRemoteListResult<T> = {
  error: unknown | null;
  items: T[];
  source: PerpsRemoteListSource;
};

type FetchPerpsRemoteListOptions<T> = {
  fallback: T[];
  label: string;
  memory: T[];
  request: () => Promise<T[]>;
};

export const fetchPerpsRemoteList = async <T>({
  fallback,
  label,
  memory,
  request,
}: FetchPerpsRemoteListOptions<T>): Promise<PerpsRemoteListResult<T>> => {
  try {
    const items = await request();
    if (items.length > 0) {
      return { error: null, items, source: 'remote' };
    }
    return {
      error: new Error(`${label} returned an empty list`),
      items: memory.length > 0 ? memory : fallback,
      source: memory.length > 0 ? 'memory' : 'default',
    };
  } catch (error) {
    return {
      error,
      items: memory.length > 0 ? memory : fallback,
      source: memory.length > 0 ? 'memory' : 'default',
    };
  }
};

export type PerpsMarketRefreshDecision = {
  persist: boolean;
  publish: boolean;
  status: 'success' | 'error';
};

export const decidePerpsMarketRefresh = ({
  categoriesSource,
  hasCurrentMarketData,
  hasFormattedMarketData,
  topAssetsSource,
}: {
  categoriesSource: PerpsRemoteListSource;
  hasCurrentMarketData: boolean;
  hasFormattedMarketData: boolean;
  topAssetsSource: PerpsRemoteListSource;
}): PerpsMarketRefreshDecision => {
  if (!hasFormattedMarketData) {
    return { persist: false, publish: false, status: 'error' };
  }

  if (topAssetsSource !== 'remote') {
    return {
      persist: false,
      publish: !hasCurrentMarketData,
      status: 'error',
    };
  }

  return {
    persist: true,
    publish: true,
    status: categoriesSource === 'remote' ? 'success' : 'error',
  };
};
