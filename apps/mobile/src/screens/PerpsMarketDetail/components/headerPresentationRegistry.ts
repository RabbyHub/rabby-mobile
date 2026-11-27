import type {
  AccountHeaderHandle,
  AccountHeaderSnapshot,
} from './account/model';

/**
 * Bridges the page-owned header presentation to the route-level header.
 *
 * The scroll/layout/quote snapshot is produced by the screen (that is where the
 * chart lives) while the header is declared on the route. Keying by route key
 * keeps replacing the route with another market from leaking state into the new
 * screen, and replaying the latest snapshot on register covers a header remount.
 */
const latestSnapshots = new Map<string, AccountHeaderSnapshot>();
const headerHandles = new Map<string, AccountHeaderHandle>();

export function reportPerpsHeaderSnapshot(
  routeKey: string,
  snapshot: AccountHeaderSnapshot,
) {
  latestSnapshots.set(routeKey, snapshot);
  headerHandles.get(routeKey)?.update(snapshot);
}

export function registerPerpsHeaderHandle(
  routeKey: string,
  handle: AccountHeaderHandle | null,
) {
  if (!handle) {
    headerHandles.delete(routeKey);
    return;
  }
  headerHandles.set(routeKey, handle);
  const latest = latestSnapshots.get(routeKey);
  if (latest) {
    handle.update(latest);
  }
}

export function resetPerpsHeaderSnapshot(routeKey: string) {
  latestSnapshots.delete(routeKey);
  headerHandles.delete(routeKey);
}
