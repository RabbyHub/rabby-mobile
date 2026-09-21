import { InteractionManager } from 'react-native';

import { isUnlockSessionValid } from '@/core/apis/lock';
import {
  bindKeyringEventAfterRegistration,
  bindKeyringEventOnceAfterRegistration,
  isKeyringUnlockedSnapshot,
} from '@/core/serviceApi/keyring';
import { traceAndroidInstant } from '@/core/utils/androidTrace';
import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';

const UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS = 800;
const WALLETCONNECT_RESTORE_AFTER_HOME_IDLE_DELAY_MS = 60000;
const WALLETCONNECT_RESTORE_HOME_READY_FALLBACK_MS = 10000;
const WALLETCONNECT_RESTORE_IDLE_TIMEOUT_MS = 10000;

let unlockPoliciesStarted = false;
let walletConnectRestoreScheduled = false;

async function startInitStores() {
  traceAndroidInstant('global_task.init_persisted_stores.start');
  const { startInitPersistedStores } = await import(
    '@/setup-readable-account-bootstrap-warmups'
  );
  await startInitPersistedStores();
  traceAndroidInstant('global_task.init_persisted_stores.end');
}

function startInitStoresAfterUnlockInteractions(reason: string) {
  traceAndroidInstant('global_task.init_persisted_stores.schedule', {
    reason,
    delayMs: UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS,
  });
  return InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      traceAndroidInstant('global_task.init_persisted_stores.fire', {
        reason,
      });
      startInitStores().catch(error => {
        traceAndroidInstant('global_task.init_persisted_stores.error', {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`startInitStoresOnUnlock::${reason}::error`, error);
      });
    }, UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS);
  });
}

function startInitStoresOnUnlock() {
  if (isKeyringUnlockedSnapshot()) {
    startInitStoresAfterUnlockInteractions('already_unlocked');
    return;
  }

  bindKeyringEventOnceAfterRegistration('unlock', () => {
    startInitStoresAfterUnlockInteractions('unlock_event');
  });
}

function startWalletConnectRestore(reason: string) {
  traceAndroidInstant('global_task.walletconnect_restore.fire', {
    reason,
  });
  import('@/core/walletconnect/client')
    .then(({ startRestoreWalletConnectSessions }) => {
      startRestoreWalletConnectSessions();
    })
    .catch(error => {
      traceAndroidInstant('global_task.walletconnect_restore.error', {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      console.warn('startWalletConnectRestoreAfterHomeReady::error', error);
    });
}

function startWalletConnectRestoreAfterIdle(reason: string) {
  InteractionManager.runAfterInteractions(() => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(
        () => {
          startWalletConnectRestore(reason);
        },
        {
          timeout: WALLETCONNECT_RESTORE_IDLE_TIMEOUT_MS,
        },
      );
      return;
    }

    startWalletConnectRestore(reason);
  });
}

function startWalletConnectRestoreAfterHomeReady(reason: string) {
  if (walletConnectRestoreScheduled) {
    traceAndroidInstant('global_task.walletconnect_restore.schedule_skipped', {
      reason,
    });
    return;
  }

  walletConnectRestoreScheduled = true;
  traceAndroidInstant('global_task.walletconnect_restore.schedule', {
    reason,
    delayMs: WALLETCONNECT_RESTORE_AFTER_HOME_IDLE_DELAY_MS,
    idleTimeoutMs: WALLETCONNECT_RESTORE_IDLE_TIMEOUT_MS,
  });

  runAfterHomePostStartupReady(
    () => {
      setTimeout(() => {
        traceAndroidInstant(
          'global_task.walletconnect_restore.idle_wait_start',
          {
            reason,
          },
        );
        startWalletConnectRestoreAfterIdle(reason);
      }, WALLETCONNECT_RESTORE_AFTER_HOME_IDLE_DELAY_MS);
    },
    {
      label: 'walletconnect_restore',
      fallbackMs: WALLETCONNECT_RESTORE_HOME_READY_FALLBACK_MS,
    },
  );
}

function startWalletConnectStartupPolicy() {
  if (isKeyringUnlockedSnapshot() || isUnlockSessionValid()) {
    traceAndroidInstant('global_task.walletconnect_restore.already_unlocked');
    startWalletConnectRestoreAfterHomeReady('already_unlocked');
  }

  bindKeyringEventAfterRegistration('unlock', () => {
    traceAndroidInstant('global_task.walletconnect_restore.unlock_event');
    startWalletConnectRestoreAfterHomeReady('unlock_event');
  });
}

export function startSetupRuntimeUnlockPolicies() {
  if (unlockPoliciesStarted) {
    return;
  }

  unlockPoliciesStarted = true;
  startInitStoresOnUnlock();
  startWalletConnectStartupPolicy();
}
