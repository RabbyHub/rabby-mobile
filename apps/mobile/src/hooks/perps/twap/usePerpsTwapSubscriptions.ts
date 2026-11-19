import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { apisPerps } from '@/core/apis/perps';
import {
  mergePerpsTwapHistory,
  parsePerpsTwapFill,
  parsePerpsTwapHistory,
  parsePerpsTwapState,
  replacePerpsTwapActiveSnapshot,
} from './twapReconciliation';
import {
  addPerpsTwapFills,
  getPerpsTwapAccount,
  updatePerpsTwapAccount,
  withPerpsTwapSourceState,
  type PerpsTwapSource,
} from './usePerpsTwapStore';
import type { PerpsTwapState } from './types';

type Session = {
  generation: number;
  users: number;
  refresh: (source?: PerpsTwapSource) => Promise<void>;
  dispose: () => void;
};
const sessions = new Map<string, Session>();

export const refreshPerpsTwaps = (user: string, source?: PerpsTwapSource) =>
  sessions.get(user.toLowerCase())?.refresh(source) ?? Promise.resolve();

const acquire = (user: string, generation: number) => {
  const key = user.toLowerCase();
  const existing = sessions.get(key);
  if (existing?.generation === generation) {
    existing.users++;
    return () => release(key, existing);
  }
  existing?.dispose();
  const sdk = apisPerps.getPerpsSDK();
  let disposed = false;
  const wsRevision = { history: 0, fills: 0 };
  const pending: Partial<Record<'history' | 'fills', Promise<void>>> = {};
  const subscriptions: Partial<
    Record<PerpsTwapSource, { unsubscribe: () => void }>
  > = {};
  const report = (source: PerpsTwapSource, stage: string, error: unknown) => {
    if (disposed) return;
    updatePerpsTwapAccount(user, current =>
      withPerpsTwapSourceState(
        current,
        source,
        source !== 'active' && current.sources[source].ready,
        `${source} ${stage}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );
  };
  const acceptHistory = (items: unknown, snapshot: boolean) => {
    if (!Array.isArray(items)) throw new Error('Invalid TWAP history response');
    const history = items.map(item => {
      const record = parsePerpsTwapHistory(item, user);
      if (!record) throw new Error('Invalid TWAP history event');
      return record;
    });
    if (!snapshot && !history.length) return false;
    // An activation delta has no completed history to display. It cannot
    // recover a failed initial snapshot or supersede that request's error.
    const recoversHistory =
      snapshot || history.some(record => record.endedAt !== null);
    updatePerpsTwapAccount(user, current => {
      const records = mergePerpsTwapHistory(current.records, history);
      const next =
        records === current.records ? current : { ...current, records };
      // A delta can contribute rows, but only a snapshot establishes an empty history.
      return recoversHistory
        ? withPerpsTwapSourceState(
            next,
            'history',
            snapshot || current.sources.history.ready,
          )
        : next;
    });
    return recoversHistory;
  };
  const acceptFills = (items: unknown, snapshot: boolean) => {
    if (!Array.isArray(items)) throw new Error('Invalid TWAP fills response');
    const fills = items.map(item => {
      const fill = parsePerpsTwapFill(item);
      if (!fill) throw new Error('Invalid TWAP fill');
      return fill;
    });
    if (!snapshot && !fills.length) return;
    addPerpsTwapFills(user, fills);
    updatePerpsTwapAccount(user, current =>
      snapshot || current.sources.fills.ready
        ? withPerpsTwapSourceState(current, 'fills', true)
        : current,
    );
  };
  const fetchSource = (source: 'history' | 'fills') => {
    const inFlight = pending[source];
    if (inFlight) return inFlight;
    const startedRevision = wsRevision[source];
    const request = (async () => {
      if (source === 'history') {
        const history = await sdk.info.getUserTwapHistory(user);
        if (!disposed) acceptHistory(history, true);
      } else {
        const fills = await sdk.info.getUserTwapSliceFills(user);
        if (!disposed) acceptFills(fills, true);
      }
    })()
      .catch(error => {
        // Newer valid WS data supersedes an older HTTP failure. A history delta
        // can recover visible rows without establishing a complete snapshot.
        if (wsRevision[source] === startedRevision)
          report(source, 'REST', error);
      })
      .finally(() => {
        delete pending[source];
      });
    pending[source] = request;
    return request;
  };

  const onPayload =
    <T extends { user: string }>(
      source: PerpsTwapSource,
      apply: (payload: T) => void,
    ) =>
    (payload: T) => {
      if (disposed || !isSameAddress(payload.user, user)) return;
      try {
        apply(payload);
      } catch (error) {
        report(source, 'WS payload', error);
      }
    };
  const register = {
    active: () =>
      sdk.ws.subscribeToTwapStates(
        onPayload('active', payload => {
          if (!Array.isArray(payload.states))
            throw new Error('Invalid TWAP state snapshot');
          const entries: [number, PerpsTwapState][] = payload.states.map(
            entry => {
              if (
                !Array.isArray(entry) ||
                !Number.isSafeInteger(entry[0]) ||
                entry[0] < 0
              )
                throw new Error('Invalid TWAP state identity');
              const state = parsePerpsTwapState(entry[1], user);
              if (!state) throw new Error('Invalid TWAP state');
              return [entry[0], state];
            },
          );
          updatePerpsTwapAccount(user, current => {
            const records = replacePerpsTwapActiveSnapshot(
              current.records,
              entries,
            );
            return withPerpsTwapSourceState(
              records === current.records ? current : { ...current, records },
              'active',
              true,
            );
          });
        }),
        user,
      ),
    history: () =>
      sdk.ws.subscribeToUserTwapHistory(
        onPayload('history', payload => {
          if (acceptHistory(payload.history, payload.isSnapshot === true))
            wsRevision.history++;
        }),
        user,
      ),
    fills: () =>
      sdk.ws.subscribeToUserTwapSliceFills(
        onPayload('fills', payload => {
          acceptFills(payload.twapSliceFills, payload.isSnapshot === true);
          if (payload.isSnapshot) wsRevision.fills++;
        }),
        user,
      ),
  };
  const subscribe = (source: PerpsTwapSource) => {
    if (subscriptions[source]) return;
    try {
      subscriptions[source] = register[source]();
    } catch (error) {
      report(source, 'WS subscribe', error);
    }
  };
  const refresh = async (source?: PerpsTwapSource) => {
    if (source === 'active') {
      if (!getPerpsTwapAccount(user).sources.active.ready) {
        subscriptions.active?.unsubscribe();
        delete subscriptions.active;
      }
      subscribe('active');
      return;
    }
    if (source) {
      subscribe(source);
      await fetchSource(source);
      return;
    }
    subscribe('active');
    subscribe('history');
    subscribe('fills');
    await Promise.all([fetchSource('history'), fetchSource('fills')]);
  };
  updatePerpsTwapAccount(user, current =>
    withPerpsTwapSourceState(current, 'active', false),
  );
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') void refresh();
  });
  const session: Session = {
    generation,
    users: 1,
    refresh,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      Object.values(subscriptions).forEach(subscription =>
        subscription.unsubscribe(),
      );
      appState.remove();
    },
  };
  sessions.set(key, session);
  void refresh();
  return () => release(key, session);
};

const release = (key: string, session: Session) => {
  if (--session.users > 0) return;
  session.dispose();
  if (sessions.get(key) === session) sessions.delete(key);
};

export const usePerpsTwapSubscriptions = (
  user: string | undefined,
  enabled: boolean,
  generation: number,
) => {
  useEffect(() => {
    if (!user || !enabled) return;
    return acquire(user, generation);
  }, [user, enabled, generation]);
};
