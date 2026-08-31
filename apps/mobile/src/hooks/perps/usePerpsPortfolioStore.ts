import { apisPerps } from '@/core/apis';
import { zCreate } from '@/core/utils/reexports';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  parsePortfolioResponseStrict,
  type PortfolioData,
} from './perpsPortfolio';

export type PortfolioEntry = {
  data: PortfolioData | null;
  status: 'loading' | 'ready' | 'error';
  updatedAt: number;
};

type PerpsPortfolioState = {
  portfolioMap: Record<string, PortfolioEntry>;
};

/**
 * Per-address cache of the HL portfolio series. Kept out of the main
 * perpsStore on purpose: the data is REST-polled, address-scoped, and has no
 * coupling with the WS subscription lifecycle. Entries survive account
 * switches (stale data is shown while a background refresh runs) and are
 * only replaced, never cleared, on logout.
 */
export const perpsPortfolioStore = zCreate<PerpsPortfolioState>(() => ({
  portfolioMap: {},
}));

const FRESH_TTL_MS = 10_000;

const inFlight = new Map<string, Promise<void>>();

const setEntry = (address: string, entry: PortfolioEntry) => {
  perpsPortfolioStore.setState(state => ({
    portfolioMap: { ...state.portfolioMap, [address]: entry },
  }));
};

export const fetchPerpsPortfolio = async (
  address: string,
  // maxAgeMs widens the freshness window beyond the default TTL — e.g. the
  // account selector treats a 5-minute-old series as fresh enough, while the
  // account card's poll still forces through.
  opts?: { force?: boolean; maxAgeMs?: number },
): Promise<void> => {
  const key = address?.toLowerCase();
  if (!key) {
    return;
  }
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }
  const prev = perpsPortfolioStore.getState().portfolioMap[key];
  if (
    !opts?.force &&
    prev &&
    Date.now() - prev.updatedAt < (opts?.maxAgeMs ?? FRESH_TTL_MS)
  ) {
    return;
  }
  // Only publish a loading entry when there is nothing to show yet — a
  // background refresh over existing data must not emit a no-op update
  // (identical content, new identity) that re-renders every subscriber.
  if (!prev?.data) {
    setEntry(key, {
      data: null,
      status: 'loading',
      updatedAt: prev?.updatedAt ?? 0,
    });
  }
  const task = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Timeout (10s AbortController) and structured errors come from the
        // SDK's HttpClient.
        const raw = await apisPerps.getPerpsSDK().info.getPortfolio(key);
        const data = parsePortfolioResponseStrict(raw);
        setEntry(key, { data, status: 'ready', updatedAt: Date.now() });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    console.warn('[perpsPortfolio] fetch failed', lastError);
    const stale = perpsPortfolioStore.getState().portfolioMap[key];
    // Keep any previously fetched series visible; only flag the error.
    setEntry(key, {
      data: stale?.data ?? null,
      status: 'error',
      updatedAt: stale?.updatedAt ?? 0,
    });
  })().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
};

export const usePerpsPortfolio = (address?: string): PortfolioEntry | null => {
  const key = address?.toLowerCase() || '';
  return useActivityStore(
    perpsPortfolioStore,
    s => (key ? s.portfolioMap[key] ?? null : null),
    Object.is,
    { storeLabel: 'perps-portfolio' },
  );
};
