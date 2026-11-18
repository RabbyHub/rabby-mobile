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
import { addPerpsTwapFills, updatePerpsTwapAccount } from './usePerpsTwapStore';
import type { PerpsTwapFill, PerpsTwapRecord, PerpsTwapState } from './types';

type Session = {
  generation: number;
  users: number;
  refresh: () => Promise<void>;
  dispose: () => void;
};
const sessions = new Map<string, Session>();

export const refreshPerpsTwaps = (user: string) =>
  sessions.get(user.toLowerCase())?.refresh() ?? Promise.resolve();

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
  let revision = 0;
  let pending: Promise<void> | null = null;
  const report = (error: unknown) => {
    if (!disposed)
      updatePerpsTwapAccount(user, current => ({
        ...current,
        error: error instanceof Error ? error.message : 'TWAP data unavailable',
      }));
  };
  const readHistory = (items: unknown) => {
    if (!Array.isArray(items)) throw new Error('Invalid TWAP history response');
    const parsed = items.map(item => parsePerpsTwapHistory(item, user));
    if (parsed.some(item => !item))
      throw new Error('Invalid TWAP history event');
    return parsed.filter((item): item is PerpsTwapRecord => !!item);
  };
  const readFills = (items: unknown) => {
    if (!Array.isArray(items)) throw new Error('Invalid TWAP fills response');
    const parsed = items.map(parsePerpsTwapFill);
    if (parsed.some(item => !item)) throw new Error('Invalid TWAP fill');
    return parsed.filter((item): item is PerpsTwapFill => !!item);
  };
  const refresh = () => {
    if (pending) return pending;
    const startedRevision = revision;
    pending = Promise.all([
      sdk.info.getUserTwapHistory(user),
      sdk.info.getUserTwapSliceFills(user),
    ])
      .then(([history, fills]) => {
        if (disposed) return;
        const parsedHistory = readHistory(history);
        const parsedFills = readFills(fills);
        updatePerpsTwapAccount(user, current => ({
          ...current,
          // The reducer also protects terminal facts against a late REST response.
          records: mergePerpsTwapHistory(current.records, parsedHistory),
          historyReady: true,
          error: startedRevision === revision ? null : current.error,
        }));
        addPerpsTwapFills(user, parsedFills);
      })
      .catch(report)
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  updatePerpsTwapAccount(user, current => ({
    ...current,
    activeReady: false,
    error: null,
  }));
  const subscriptions: Array<{ unsubscribe: () => void }> = [];
  try {
    subscriptions.push(
      sdk.ws.subscribeToTwapStates(payload => {
        if (disposed || !isSameAddress(payload.user, user)) return;
        try {
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
          revision++;
          updatePerpsTwapAccount(user, current => ({
            ...current,
            records: replacePerpsTwapActiveSnapshot(current.records, entries),
            activeReady: true,
          }));
        } catch (error) {
          report(error);
        }
      }, user),
    );
    subscriptions.push(
      sdk.ws.subscribeToUserTwapHistory(payload => {
        if (disposed || !isSameAddress(payload.user, user)) return;
        try {
          const history = readHistory(payload.history);
          revision++;
          updatePerpsTwapAccount(user, current => ({
            ...current,
            records: mergePerpsTwapHistory(current.records, history),
            historyReady: true,
          }));
        } catch (error) {
          report(error);
        }
      }, user),
    );
    subscriptions.push(
      sdk.ws.subscribeToUserTwapSliceFills(payload => {
        if (disposed || !isSameAddress(payload.user, user)) return;
        try {
          addPerpsTwapFills(user, readFills(payload.twapSliceFills));
        } catch (error) {
          report(error);
        }
      }, user),
    );
  } catch (error) {
    report(error);
  }
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
      subscriptions.forEach(subscription => subscription.unsubscribe());
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
