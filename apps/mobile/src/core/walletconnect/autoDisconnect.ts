import type { IWalletKit } from '@reown/walletkit';
import { getSdkError } from '@walletconnect/utils';

import { forgetWalletConnectAccountForTopic } from './accountSelection';
import { addWalletConnectLog } from './debugLog';
import {
  getWalletConnectAutoDisconnectEnabled as getAutoDisconnectEnabledSetting,
  getWalletConnectAutoDisconnectInactiveMinutes as getAutoDisconnectInactiveMinutesSetting,
  setWalletConnectAutoDisconnectEnabled as setAutoDisconnectEnabledSetting,
  setWalletConnectAutoDisconnectInactiveMinutes as setAutoDisconnectInactiveMinutesSetting,
} from './settings';
import { syncWalletConnectSessionsFromClient } from './sessions';

type WalletConnectAutoDisconnectReason = 'inactive' | 'startup' | 'replace';
type TimerRef = ReturnType<typeof setTimeout>;

const lastActivityAtByTopic = new Map<string, number>();
const disconnectTimersByTopic = new Map<string, TimerRef>();

export function getWalletConnectAutoDisconnectEnabled() {
  return getAutoDisconnectEnabledSetting();
}

export function getWalletConnectAutoDisconnectInactiveMinutes() {
  return getAutoDisconnectInactiveMinutesSetting();
}

function minutesToMs(minutes: number) {
  return Math.max(1, Math.round(minutes * 60 * 1000));
}

function getWalletConnectAutoDisconnectInactiveMs() {
  return minutesToMs(getWalletConnectAutoDisconnectInactiveMinutes());
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
  setAutoDisconnectEnabledSetting(enabled);
  if (!enabled) {
    clearWalletConnectAutoDisconnectState();
  }
  addWalletConnectLog('sessions', 'auto-disconnect setting changed', {
    enabled,
  });
}

export function setWalletConnectAutoDisconnectInactiveMinutes(
  minutes: number,
  walletKit?: IWalletKit,
) {
  const settings = setAutoDisconnectInactiveMinutesSetting(minutes);
  const inactiveMinutes = settings.autoDisconnect.inactiveMinutes;

  addWalletConnectLog('sessions', 'auto-disconnect expiry changed', {
    minutes: inactiveMinutes,
    inactiveMs: minutesToMs(inactiveMinutes),
  });

  if (walletKit && getWalletConnectAutoDisconnectEnabled()) {
    for (const topic of lastActivityAtByTopic.keys()) {
      if (hasActiveSession(walletKit, topic)) {
        scheduleInactiveDisconnect(walletKit, topic);
      } else {
        clearWalletConnectAutoDisconnectTopic(topic);
        forgetWalletConnectAccountForTopic(topic);
      }
    }
  }
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

  const inactiveLimitMs = getWalletConnectAutoDisconnectInactiveMs();
  const lastActivityAt = lastActivityAtByTopic.get(topic);
  const inactiveMs =
    typeof lastActivityAt === 'number' ? Date.now() - lastActivityAt : 0;
  const delayMs = Math.max(0, inactiveLimitMs - inactiveMs);

  const timer = setTimeout(() => {
    if (!getWalletConnectAutoDisconnectEnabled()) {
      clearWalletConnectAutoDisconnectTopic(topic);
      return;
    }

    const lastActivityAt = lastActivityAtByTopic.get(topic);
    if (typeof lastActivityAt !== 'number') {
      clearWalletConnectAutoDisconnectTopic(topic);
      return;
    }

    const inactiveMs = Date.now() - lastActivityAt;
    if (inactiveMs < getWalletConnectAutoDisconnectInactiveMs()) {
      scheduleInactiveDisconnect(walletKit, topic);
      return;
    }

    disconnectWalletConnectSessionForPolicy(walletKit, topic, 'inactive').catch(
      error => {
        addWalletConnectLog(
          'sessions',
          'failed to run inactive auto-disconnect',
          {
            topic,
            error,
          },
          'warn',
        );
      },
    );
  }, delayMs);

  disconnectTimersByTopic.set(topic, timer);
}

export function recordWalletConnectSessionActivity(
  walletKit: IWalletKit,
  topic: string,
) {
  if (!getWalletConnectAutoDisconnectEnabled()) {
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
  if (!getWalletConnectAutoDisconnectEnabled()) {
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
  if (!getWalletConnectAutoDisconnectEnabled()) {
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
