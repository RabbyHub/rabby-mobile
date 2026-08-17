export type AssetSyncTrigger =
  | 'initial'
  | 'resume'
  | 'pull-refresh'
  | 'scope-change'
  | 'on-demand';

export type AssetSyncScope = {
  kind: string;
  addresses: string[];
  variant?: string;
};

export type AssetSyncTicket = {
  requestId: string;
  scopeKey: string;
  getTrigger(): AssetSyncTrigger;
  isForceRequested(): boolean;
};

type AssetSyncRunOptions<TResult> = {
  scope: AssetSyncScope;
  trigger: AssetSyncTrigger;
  force: boolean;
  execute: (ticket: AssetSyncTicket) => Promise<TResult>;
  onStart?: (ticket: AssetSyncTicket) => void;
  onSuccess?: (
    ticket: AssetSyncTicket,
    result: TResult,
  ) => void | Promise<void>;
  onError?: (ticket: AssetSyncTicket, error: unknown) => void | Promise<void>;
};

type InFlightAssetSync<TResult = unknown> = {
  trigger: AssetSyncTrigger;
  forceRequested: boolean;
  promise: Promise<TResult>;
};

const TRIGGER_PRIORITY: Record<AssetSyncTrigger, number> = {
  'on-demand': 0,
  initial: 1,
  resume: 2,
  'scope-change': 3,
  'pull-refresh': 4,
};

const normalizeScopeAddresses = (addresses: string[]) =>
  Array.from(
    new Set(addresses.map(address => address.toLowerCase()).filter(Boolean)),
  ).sort();

export const buildAssetSyncScopeKey = ({
  kind,
  addresses,
  variant = 'default',
}: AssetSyncScope) =>
  `${kind}:${variant}:${normalizeScopeAddresses(addresses).join('|')}`;

const selectStrongerTrigger = (
  current: AssetSyncTrigger,
  next: AssetSyncTrigger,
) => (TRIGGER_PRIORITY[next] > TRIGGER_PRIORITY[current] ? next : current);

/**
 * Coordinates intent only. The owning asset store remains responsible for
 * freshness checks, request execution, persistence, and stale-result fences.
 */
export class AssetSyncCoordinator {
  private sequence = 0;

  private readonly inFlightByScope = new Map<string, InFlightAssetSync>();

  run<TResult>({
    scope,
    trigger,
    force,
    execute,
    onStart,
    onSuccess,
    onError,
  }: AssetSyncRunOptions<TResult>): Promise<TResult> {
    const scopeKey = buildAssetSyncScopeKey(scope);
    const active = this.inFlightByScope.get(scopeKey) as
      | InFlightAssetSync<TResult>
      | undefined;

    if (active) {
      active.forceRequested ||= force;
      active.trigger = selectStrongerTrigger(active.trigger, trigger);
      return active.promise;
    }

    this.sequence += 1;
    const flight: InFlightAssetSync<TResult> = {
      trigger,
      forceRequested: force,
      promise: undefined as unknown as Promise<TResult>,
    };
    const ticket: AssetSyncTicket = {
      requestId: `${scopeKey}:${this.sequence}`,
      scopeKey,
      getTrigger: () => flight.trigger,
      isForceRequested: () => flight.forceRequested,
    };

    const promise = Promise.resolve().then(async () => {
      onStart?.(ticket);
      try {
        const result = await execute(ticket);
        await onSuccess?.(ticket, result);
        return result;
      } catch (error) {
        await onError?.(ticket, error);
        throw error;
      }
    });
    flight.promise = promise;
    this.inFlightByScope.set(scopeKey, flight);

    void promise.then(
      () => {
        if (this.inFlightByScope.get(scopeKey) === flight) {
          this.inFlightByScope.delete(scopeKey);
        }
      },
      () => {
        if (this.inFlightByScope.get(scopeKey) === flight) {
          this.inFlightByScope.delete(scopeKey);
        }
      },
    );

    return promise;
  }
}
