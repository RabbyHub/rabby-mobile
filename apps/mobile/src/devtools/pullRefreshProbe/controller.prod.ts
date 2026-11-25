import type { PagerProbeRow } from './pagerTypes';

export type PullRefreshProbeScope =
  | 'home-token-list'
  | 'home-defi-list'
  | 'home-nft-list';

export type PullRefreshProbeUIRow = {
  at: number;
  scope: PullRefreshProbeScope;
  phase:
    | 'sample'
    | 'gesture-start'
    | 'gesture-end'
    | 'gesture-finalize'
    | 'request-start'
    | 'request-finish'
    | 'loading'
    | 'unmount';
  pull: number;
  scrollY: number;
  refreshing: boolean;
  manual: boolean;
  height?: number;
  pageY?: number;
  success?: boolean;
  loading?: boolean;
};

export type PullRefreshProbeSnapshot = {
  runId: string | null;
  expiresAt: number;
  active: boolean;
  pagerEnabled?: boolean;
};

const INACTIVE = Object.freeze<PullRefreshProbeSnapshot>({
  runId: null,
  expiresAt: 0,
  active: false,
});

export async function startPullRefreshProbe(_command: {
  runId: string;
  expiresAt: number;
  perpsRootProbe?: boolean;
}): Promise<void> {}

export async function stopPullRefreshProbe(_reason: string): Promise<void> {}

export async function flushPullRefreshProbe(): Promise<void> {}

export function getPullRefreshProbeSnapshot(): PullRefreshProbeSnapshot {
  return INACTIVE;
}

export function subscribePullRefreshProbe(_listener: () => void): () => void {
  return () => {};
}

export function registerPullRefreshProbeUIFlusher(
  _flush: (stop?: boolean) => Promise<void>,
): () => void {
  return () => {};
}

export function recordPullRefreshProbeUI(
  _runId: string,
  _rows: readonly PullRefreshProbeUIRow[],
): void {}

export function recordPagerProbe(
  _runId: string,
  _rows: readonly PagerProbeRow[],
): void {}
