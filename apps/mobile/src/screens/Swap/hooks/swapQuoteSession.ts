import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { zCreate } from '@/core/utils/reexports';
import { useScopedActivityStore } from '@/hooks/storeActivity/useActivityStore';

import type { QuoteProvider, TDexQuoteData } from './quote';
import {
  canDisplaySwapProviderBeforeAllQuotesLoaded,
  canDisplaySwapQuoteBeforeAllQuotesLoaded,
  createSwapQuoteProvider,
  getBestSwapQuote,
  getSwapProviderScore,
} from './quoteSelection';
import { clearQuoteRefreshSession } from './quoteRefreshScheduler';
import { mergeSwapQuoteBatch } from './quoteResultBatch';
import { RequestRateLimiter } from './rateLimit';

export type SwapQuoteStoreState = {
  quoteList: TDexQuoteData[];
  /**
   * Only published while the page has nothing to show yet. Background refreshes
   * keep the previous quote visible and never flip this flag, so a periodic
   * refresh does not re-render the swap screen.
   */
  quoteLoading: boolean;
  quoteRequestFinished: boolean;
  quoteRequestId: number;
  activeProvider?: QuoteProvider;
  bestQuoteDex: string;
};

export const swapQuoteStore = zCreate<SwapQuoteStoreState>(() => ({
  quoteList: [],
  quoteLoading: false,
  quoteRequestFinished: true,
  quoteRequestId: 0,
  activeProvider: undefined,
  bestQuoteDex: '',
}));

export type SwapQuoteLifecycleEvent =
  | { type: 'cycle-start'; requestId: number }
  | { type: 'cycle-finished'; requestId: number }
  | { type: 'list-updated'; requestId: number };

type SwapQuoteLifecycleListener = (event: SwapQuoteLifecycleEvent) => void;

const lifecycleListeners = new Set<SwapQuoteLifecycleListener>();

const tokenRefreshListeners = new Set<() => void>();

/**
 * Non-render trigger for "refresh the pay/receive token snapshot". Subscribing
 * with a React state atom made every quote cycle re-render the swap screen.
 */
export function requestSwapTokenRefresh() {
  tokenRefreshListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('swap token refresh listener failed', error);
    }
  });
}

export function subscribeSwapTokenRefresh(listener: () => void) {
  tokenRefreshListeners.add(listener);
  return () => {
    tokenRefreshListeners.delete(listener);
  };
}

/**
 * Non-render subscription for orchestration (for example the swap tx prebuild
 * tracker). Rendering consumers use the selectors below instead.
 */
export function subscribeSwapQuoteLifecycle(
  listener: SwapQuoteLifecycleListener,
) {
  lifecycleListeners.add(listener);
  return () => {
    lifecycleListeners.delete(listener);
  };
}

function emitLifecycle(event: SwapQuoteLifecycleEvent) {
  lifecycleListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('swap-quote lifecycle listener failed', error);
    }
  });
}

type SwapQuoteSelectionContext = {
  canUpdateActiveProvider: boolean;
  payToken?: TokenItem;
  receiveToken?: TokenItem;
  payAmount: string;
  inSufficient: boolean;
};

let selectionContext: SwapQuoteSelectionContext = {
  canUpdateActiveProvider: false,
  payAmount: '',
  inSufficient: false,
};

let fetchId = 0;
let pendingQuoteUpdates = new Map<string, TDexQuoteData>();
let flushFrame: number | null = null;
let quoteRefreshEnabled = false;
let scheduleRefresh: (() => void) | null = null;
let quoteCycleRunner: (() => void) | null = null;

type SwapQuoteFetchRunner = (requestId: number) => Promise<void>;

let quoteFetchRunner: SwapQuoteFetchRunner | null = null;
let pendingRequestTimer: ReturnType<typeof setTimeout> | null = null;
const quoteRateLimiter = new RequestRateLimiter(1000 * 30, 10);
let quoteRateLimited = false;

export function setSwapQuoteFetchRunner(runner: SwapQuoteFetchRunner | null) {
  quoteFetchRunner = runner;
}

/**
 * Module-owned debounce for the quote request. A React debounce hook would keep
 * loading state inside the swap screen and re-render it on every refresh.
 */
export function scheduleSwapQuoteRequest(requestId: number) {
  if (pendingRequestTimer !== null) {
    clearTimeout(pendingRequestTimer);
  }
  const delay = quoteRateLimited ? 5000 : 300;
  pendingRequestTimer = setTimeout(() => {
    pendingRequestTimer = null;
    if (requestId !== fetchId) {
      return;
    }
    quoteRateLimited = !!quoteRateLimiter.checkRateLimit();
    const runner = quoteFetchRunner;
    if (!runner) {
      markSwapQuoteCycleIdle(requestId);
      return;
    }
    runner(requestId).catch(error => {
      console.error('swap quote request failed', error);
      finishSwapQuoteCycle(requestId);
    });
  }, delay);
}

export function cancelSwapQuoteRequest() {
  if (pendingRequestTimer !== null) {
    clearTimeout(pendingRequestTimer);
    pendingRequestTimer = null;
  }
}

export function isSwapQuoteRefreshEnabled() {
  return quoteRefreshEnabled;
}

export function setSwapQuoteRefreshScheduler(scheduler: (() => void) | null) {
  scheduleRefresh = scheduler;
}

export function setSwapQuoteCycleRunner(runner: (() => void) | null) {
  quoteCycleRunner = runner;
}

/**
 * Entry point for the module-owned 20s timer. It starts a quote cycle without
 * bumping a React atom, so the periodic tick itself does not re-render.
 */
export function requestSwapQuoteRefresh() {
  quoteCycleRunner?.();
}

function requestRefreshScheduling() {
  clearQuoteRefreshSession();
  scheduleRefresh?.();
}

export function applySwapQuoteProvider(
  next:
    | QuoteProvider
    | undefined
    | ((prev: QuoteProvider | undefined) => QuoteProvider | undefined),
) {
  const prev = swapQuoteStore.getState().activeProvider;
  const resolved = typeof next === 'function' ? next(prev) : next;
  quoteRefreshEnabled = !!resolved;
  swapQuoteStore.setState({ activeProvider: resolved });
  requestRefreshScheduling();
}

function recomputeSelectedProvider() {
  const context = selectionContext;
  if (!context.canUpdateActiveProvider || !context.receiveToken?.id) {
    return;
  }
  const receiveToken = context.receiveToken;

  const state = swapQuoteStore.getState();
  const selectableQuoteList = state.quoteRequestFinished
    ? state.quoteList
    : state.quoteList.filter(quote =>
        canDisplaySwapQuoteBeforeAllQuotesLoaded({
          quote,
          payToken: context.payToken,
          payAmount: context.payAmount,
          receiveToken,
        }),
      );

  const best = getBestSwapQuote({
    quoteList: selectableQuoteList,
    receiveToken,
    inSufficient: context.inSufficient,
  });

  if (!best) {
    return;
  }

  const updates: Partial<SwapQuoteStoreState> = {};
  if (state.quoteLoading) {
    updates.quoteLoading = false;
  }
  // While a background refresh is running the "best" badge is part of the
  // settled snapshot, published together with the provider at cycle finish.
  if (
    state.bestQuoteDex !== best.quote.name &&
    (state.quoteRequestFinished || !state.activeProvider)
  ) {
    updates.bestQuoteDex = best.quote.name;
  }

  // Background refresh: keep the currently displayed provider for the whole
  // cycle and publish the settled value once when the cycle finishes. Quote
  // panels still update per batch through the list subscription.
  if (state.activeProvider && !state.quoteRequestFinished) {
    if (Object.keys(updates).length) {
      swapQuoteStore.setState(updates);
    }
    return;
  }

  const currentProvider = state.activeProvider;
  const currentProviderScore = currentProvider
    ? getSwapProviderScore({
        provider: currentProvider,
        receiveToken,
        inSufficient: context.inSufficient,
      })
    : null;
  const currentProviderLoaded =
    !!currentProvider &&
    state.quoteList.some(
      quote => !quote.loading && quote.name === currentProvider.name,
    );

  if (currentProviderLoaded && currentProvider.manualClick) {
    const canDisplayCurrentProvider =
      state.quoteRequestFinished ||
      canDisplaySwapProviderBeforeAllQuotesLoaded({
        provider: currentProvider!,
        payToken: context.payToken,
        payAmount: context.payAmount,
        receiveToken,
      });

    if (canDisplayCurrentProvider) {
      if (Object.keys(updates).length) {
        swapQuoteStore.setState(updates);
      }
      return;
    }
  }

  if (
    currentProviderLoaded &&
    currentProviderScore &&
    !best.score.gt(currentProviderScore)
  ) {
    if (Object.keys(updates).length) {
      swapQuoteStore.setState(updates);
    }
    return;
  }

  const nextProvider = createSwapQuoteProvider({
    quote: best.quote,
    receiveToken,
  });

  // Quotes refresh in batches; rebuilding an identical provider object would
  // re-render every consumer for a value that did not change. Only publish when
  // the visible quote data actually moved.
  if (
    currentProvider &&
    currentProvider.name === nextProvider.name &&
    currentProvider.actualReceiveAmount === nextProvider.actualReceiveAmount &&
    currentProvider.gasUsd === nextProvider.gasUsd &&
    currentProvider.shouldApproveToken === nextProvider.shouldApproveToken &&
    currentProvider.shouldTwoStepApprove ===
      nextProvider.shouldTwoStepApprove &&
    currentProvider.preExecResult?.gasPrice ===
      nextProvider.preExecResult?.gasPrice
  ) {
    if (Object.keys(updates).length) {
      swapQuoteStore.setState(updates);
    }
    return;
  }

  quoteRefreshEnabled = true;
  swapQuoteStore.setState({ ...updates, activeProvider: nextProvider });
}

/**
 * Called from the swap hook whenever the quote inputs change. Kept as a plain
 * function so the selection logic does not need a React effect on the quote
 * list.
 */
export function setSwapQuoteSelectionContext(
  context: SwapQuoteSelectionContext,
) {
  selectionContext = context;
  recomputeSelectedProvider();
}

function cancelPendingQuoteFlush() {
  if (flushFrame !== null) {
    cancelAnimationFrame(flushFrame);
    flushFrame = null;
  }
  pendingQuoteUpdates.clear();
}

function flushPendingQuoteUpdates(id: number) {
  flushFrame = null;
  if (id !== fetchId) {
    pendingQuoteUpdates.clear();
    return;
  }

  const updates = Array.from(pendingQuoteUpdates.values());
  pendingQuoteUpdates.clear();
  if (!updates.length) {
    return;
  }

  swapQuoteStore.setState(state => ({
    quoteList: mergeSwapQuoteBatch(state.quoteList, updates),
  }));
  emitLifecycle({ type: 'list-updated', requestId: id });
  recomputeSelectedProvider();
}

function schedulePendingQuoteFlush(id: number) {
  if (flushFrame !== null) {
    return;
  }
  flushFrame = requestAnimationFrame(() => {
    flushPendingQuoteUpdates(id);
  });
}

export function getSwapQuoteFetchId() {
  return fetchId;
}

export function getSwapQuoteList() {
  return swapQuoteStore.getState().quoteList;
}

export function getSwapQuoteListLength() {
  return swapQuoteStore.getState().quoteList.length;
}

export function getSwapQuoteRequestFinished() {
  return swapQuoteStore.getState().quoteRequestFinished;
}

/**
 * Starts a quote cycle. `keepVisibleData` is the background-refresh mode: the
 * previous quote list and provider stay rendered while the next round of
 * quotes comes in, so a 20s auto refresh does not blank the screen.
 */
export function beginSwapQuoteCycle({
  keepVisibleData = false,
  willRequest = true,
}: {
  keepVisibleData?: boolean;
  willRequest?: boolean;
} = {}) {
  fetchId += 1;
  const requestId = fetchId;
  cancelPendingQuoteFlush();
  cancelSwapQuoteRequest();
  const state = swapQuoteStore.getState();

  if (keepVisibleData && state.activeProvider) {
    swapQuoteStore.setState({
      quoteRequestId: requestId,
      quoteRequestFinished: !willRequest,
    });
  } else {
    quoteRefreshEnabled = false;
    clearQuoteRefreshSession();
    swapQuoteStore.setState({
      quoteList: [],
      quoteRequestId: requestId,
      quoteRequestFinished: !willRequest,
      quoteLoading: willRequest,
      activeProvider: undefined,
      bestQuoteDex: '',
    });
  }

  emitLifecycle({ type: 'cycle-start', requestId });
  return requestId;
}

export function markSwapQuoteRequestLoading() {
  const state = swapQuoteStore.getState();
  swapQuoteStore.setState({
    quoteList: state.quoteList.map(quote => ({
      ...quote,
      loading: true,
      isBest: false,
    })),
    quoteLoading: !state.activeProvider,
  });
}

export function pushSwapQuoteUpdate(id: number, quote: TDexQuoteData) {
  if (id !== fetchId) {
    return;
  }
  pendingQuoteUpdates.set(quote.name, quote);
  schedulePendingQuoteFlush(id);
}

export function finishSwapQuoteCycle(id: number) {
  if (id !== fetchId) {
    return;
  }
  flushPendingQuoteUpdates(id);
  if (id !== fetchId) {
    return;
  }
  swapQuoteStore.setState({
    quoteRequestFinished: true,
    quoteLoading: false,
  });
  emitLifecycle({ type: 'cycle-finished', requestId: id });
  recomputeSelectedProvider();
  // Arm the next auto refresh exactly once per cycle instead of resetting the
  // countdown on every quote batch.
  if (swapQuoteStore.getState().activeProvider) {
    quoteRefreshEnabled = true;
    requestRefreshScheduling();
  }
}

export function markSwapQuoteCycleIdle(id: number) {
  if (id !== fetchId) {
    return;
  }
  swapQuoteStore.setState({
    quoteRequestFinished: true,
    quoteLoading: false,
  });
  emitLifecycle({ type: 'cycle-finished', requestId: id });
}

export function cancelSwapQuotePendingWork() {
  fetchId += 1;
  cancelPendingQuoteFlush();
  cancelSwapQuoteRequest();
}

/** Hidden scene: keep the store last-value semantics, only drop the list. */
export function resetSwapQuoteListOnInactive() {
  cancelPendingQuoteFlush();
  swapQuoteStore.setState({ quoteList: [] });
}

export function clearSwapQuoteSession() {
  fetchId += 1;
  cancelPendingQuoteFlush();
  quoteRefreshEnabled = false;
  clearQuoteRefreshSession();
  swapQuoteStore.setState({
    quoteList: [],
    quoteLoading: false,
    quoteRequestFinished: true,
    activeProvider: undefined,
    bestQuoteDex: '',
  });
}

/** Input change (amount/token/slippage): stale quotes are dropped, the cycle
 * effect below decides when the next request starts. */
export function clearSwapQuoteList() {
  swapQuoteStore.setState({ quoteList: [] });
}

export function useSwapQuoteActiveProvider(active: boolean) {
  return useScopedActivityStore(
    active,
    swapQuoteStore,
    state => state.activeProvider,
    Object.is,
    { storeLabel: 'swap-quote-active-provider' },
  );
}

export function useSwapQuoteBestDex(active: boolean) {
  return useScopedActivityStore(
    active,
    swapQuoteStore,
    state => state.bestQuoteDex,
    Object.is,
    { storeLabel: 'swap-quote-best-dex' },
  );
}

export function useSwapQuoteLoading(active: boolean) {
  return useScopedActivityStore(
    active,
    swapQuoteStore,
    state => state.quoteLoading,
    Object.is,
    { storeLabel: 'swap-quote-loading' },
  );
}

export function useSwapQuoteList(active: boolean) {
  return useScopedActivityStore(
    active,
    swapQuoteStore,
    state => state.quoteList,
    Object.is,
    { storeLabel: 'swap-quote-list' },
  );
}
