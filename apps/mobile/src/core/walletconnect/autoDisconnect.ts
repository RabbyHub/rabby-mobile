import type { IWalletKit } from '@reown/walletkit';
import { getSdkError } from '@walletconnect/utils';

import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import {
  WALLETCONNECT_AUTO_DISCONNECT_INACTIVE_MS,
  WalletConnectAutoDisconnect,
} from './constants';
import { forgetWalletConnectAccountForTopic } from './accountSelection';
import { addWalletConnectLog } from './debugLog';
import { syncWalletConnectSessionsFromClient } from './sessions';

type WalletConnectAutoDisconnectReason = 'inactive' | 'startup' | 'replace';
type TimerRef = ReturnType<typeof setTimeout>;

const lastActivityAtByTopic = new Map<string, number>();
const disconnectTimersByTopic = new Map<string, TimerRef>();

function isAutoDisconnectEnabled() {
  const storedValue = appStorage.getItem(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_AUTO_DISCONNECT_ENABLED,
  );
  return typeof storedValue === 'boolean'
    ? storedValue
    : WalletConnectAutoDisconnect;
}

export function getWalletConnectAutoDisconnectEnabled() {
  return isAutoDisconnectEnabled();
}

function getActiveSessionTopics(walletKit: IWalletKit) {
  return Object.keys(walletKit.getActiveSessions());
}

function hasActiveSession(walletKit: IWalletKit, topic: string) {
  return !!walletKit.getActiveSessions()[topic];
}

export function clearWalletConnectAutoDisconnectTopic(topic: string) {
  const timer = disconnectTimersByTopic.get(topic);
  if (timer) {
    clearTimeout(timer);
  }
  disconnectTimersByTopic.delete(topic);
  lastActivityAtByTopic.delete(topic);
}

function clearWalletConnectAutoDisconnectState() {
  for (const timer of disconnectTimersByTopic.values()) {
    clearTimeout(timer);
  }
  disconnectTimersByTopic.clear();
  lastActivityAtByTopic.clear();
}

export function setWalletConnectAutoDisconnectEnabled(enabled: boolean) {
  appStorage.setItem(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_AUTO_DISCONNECT_ENABLED,
    enabled,
  );
  if (!enabled) {
    clearWalletConnectAutoDisconnectState();
  }
  addWalletConnectLog('sessions', 'auto-disconnect setting changed', {
    enabled,
  });
}

async function disconnectWalletConnectSessionForPolicy(
  walletKit: IWalletKit,
  topic: string,
  reason: WalletConnectAutoDisconnectReason,
) {
  clearWalletConnectAutoDisconnectTopic(topic);

  if (!hasActiveSession(walletKit, topic)) {
    forgetWalletConnectAccountForTopic(topic);
    return;
  }

  try {
    await walletKit.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
    forgetWalletConnectAccountForTopic(topic);
    addWalletConnectLog('sessions', 'auto-disconnected session', {
      topic,
      reason,
    });
  } catch (error: unknown) {
    addWalletConnectLog(
      'sessions',
      'failed to auto-disconnect session',
      {
        topic,
        reason,
        error,
      },
      'warn',
    );
  } finally {
    syncWalletConnectSessionsFromClient(walletKit);
  }
}

function scheduleInactiveDisconnect(walletKit: IWalletKit, topic: string) {
  const currentTimer = disconnectTimersByTopic.get(topic);
  if (currentTimer) {
    clearTimeout(currentTimer);
  }

  const timer = setTimeout(() => {
    if (!isAutoDisconnectEnabled()) {
      clearWalletConnectAutoDisconnectTopic(topic);
      return;
    }

    const lastActivityAt = lastActivityAtByTopic.get(topic);
    if (typeof lastActivityAt !== 'number') {
      clearWalletConnectAutoDisconnectTopic(topic);
      return;
    }

    const inactiveMs = Date.now() - lastActivityAt;
    if (inactiveMs < WALLETCONNECT_AUTO_DISCONNECT_INACTIVE_MS) {
      scheduleInactiveDisconnect(walletKit, topic);
      return;
    }

    void disconnectWalletConnectSessionForPolicy(walletKit, topic, 'inactive');
  }, WALLETCONNECT_AUTO_DISCONNECT_INACTIVE_MS);

  disconnectTimersByTopic.set(topic, timer);
}

export function recordWalletConnectSessionActivity(
  walletKit: IWalletKit,
  topic: string,
) {
  if (!isAutoDisconnectEnabled()) {
    return;
  }

  if (!hasActiveSession(walletKit, topic)) {
    clearWalletConnectAutoDisconnectTopic(topic);
    forgetWalletConnectAccountForTopic(topic);
    return;
  }

  lastActivityAtByTopic.set(topic, Date.now());
  scheduleInactiveDisconnect(walletKit, topic);
}

export async function disconnectRestoredWalletConnectSessionsForAutoDisconnect(
  walletKit: IWalletKit,
) {
  if (!isAutoDisconnectEnabled()) {
    return;
  }

  const topics = getActiveSessionTopics(walletKit);
  for (const topic of topics) {
    await disconnectWalletConnectSessionForPolicy(walletKit, topic, 'startup');
  }
}

export async function replaceWalletConnectSessionsForAutoDisconnect(
  walletKit: IWalletKit,
  activeTopic: string,
) {
  if (!isAutoDisconnectEnabled()) {
    return;
  }

  const topics = getActiveSessionTopics(walletKit);
  for (const topic of topics) {
    if (topic !== activeTopic) {
      await disconnectWalletConnectSessionForPolicy(
        walletKit,
        topic,
        'replace',
      );
    }
  }

  recordWalletConnectSessionActivity(walletKit, activeTopic);
}
