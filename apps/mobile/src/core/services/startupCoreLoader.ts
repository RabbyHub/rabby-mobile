import {
  ContactBookService,
  ContactBookStore,
} from '@rabby-wallet/service-address';
import { GnosisKeyring } from '@rabby-wallet/eth-keyring-gnosis';
import { KeyringService } from '@rabby-wallet/service-keyring';
import WatchKeyring from '@rabby-wallet/eth-keyring-watch';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { KeystoneKeyring } from '@rabby-wallet/eth-keyring-keystone';
import SimpleKeyring from '@rabby-wallet/eth-simple-keyring';
import HDKeyring from '@rabby-wallet/eth-hd-keyring';
import type { KeyringIntf } from '@rabby-wallet/keyring-utils';

import { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { MockWalletConnectKeyring } from '@/core/keyring-bridge/walletconnect/mock-walletconnect-keyring';
import { TrezorKeyring } from '@/core/keyring-bridge/trezor/trezor-keyring';
import { migrateAppStorage, migrateService } from '@/migrations/migrations';
import { isNonPublicProductionEnv } from '@/constant';
import {
  setUserBehaviorTrackingOptOutCache,
  USER_BEHAVIOR_TRACKING_OPT_OUT_KEY,
} from '@/utils/trackingOptOut';
import { logger } from '@/utils/logger';

import {
  appMMKVInstance,
  appStorage,
  keyringCheckpointMMKV,
  keyringMMKVInstance,
  legacyKeyringMMKV,
  normalizeKeyringState,
  persistKeyringState,
} from '../storage/mmkv';
import { APP_MMKV_KEYS } from '../storage/mmkvConstants';
import { inspectPersistedKeyringState } from '../storage/keyringStateMigration';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { PreferenceService } from '../startupServices/preference';
import { openapi } from '../request';
import { setTxRpcClient } from '../utils/tx';
import { perfEvents } from '../utils/perf';
import { traceAndroidInstant } from '../utils/androidTrace';
import { recordKeyringRuntimePerfDiagnostic } from '../utils/startupDiagnostics';
import { onCreateKeyring, onSetAddressAlias } from './keyringParams';
import { callCoreService, registerCoreServices } from './serviceRegistry';
import RNEncryptor from './encryptor';

function captureStartupCoreException(error: Error) {
  void import('@sentry/react-native')
    .then(Sentry => Sentry.captureException(error))
    .catch(() => undefined);
}

function capturePreferenceStorageIssue(
  position: 'before_preference' | 'after_preference',
  keyringState: unknown,
) {
  try {
    const preferenceData = appStorage.getItem(APP_STORE_NAMES.preference);
    if (!preferenceData && keyringState) {
      const message = `[${position}] keyringState is not empty but preference is empty`;
      if (__DEV__) {
        console.error(message);
      }
      captureStartupCoreException(new Error(message));
    }
  } catch (error) {
    captureStartupCoreException(
      new Error(`Failed to get preference from appStorage: ${error}`),
    );
  }
}

function getKeyringStateSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valueType: Array.isArray(value) ? 'array' : typeof value };
  }

  const state = value as Record<string, unknown>;
  const publicAccountSnapshot = state.publicAccountSnapshot;
  const accounts =
    publicAccountSnapshot &&
    typeof publicAccountSnapshot === 'object' &&
    !Array.isArray(publicAccountSnapshot)
      ? (publicAccountSnapshot as Record<string, unknown>).accounts
      : undefined;

  return {
    valueType: 'record',
    hasBooted: typeof state.booted === 'string',
    hasVault: typeof state.vault === 'string',
    hasEncryptedKeyringData: state.hasEncryptedKeyringData === true,
    hasPasswordState:
      !!state.passwordState && typeof state.passwordState === 'object',
    unencryptedKeyringCount: Array.isArray(state.unencryptedKeyringData)
      ? state.unencryptedKeyringData.length
      : null,
    publicAccountCount: Array.isArray(accounts) ? accounts.length : null,
  };
}

function recordKeyringStorageDiagnostic(
  event: string,
  data: Record<string, unknown>,
) {
  if (!isNonPublicProductionEnv) {
    return;
  }

  logger.info(`[RabbyKeyringStorageDiagnostic] ${event}`, data);
  traceAndroidInstant(`keyring.storage.${event}`, data);
}

const keyringClasses = [
  MockWalletConnectKeyring,
  WatchKeyring,
  LedgerKeyring,
  KeystoneKeyring,
  OneKeyKeyring,
  GnosisKeyring,
  SimpleKeyring,
  HDKeyring,
  TrezorKeyring,
] as (typeof KeyringIntf)[];

export function loadStartupCoreServices() {
  migrateAppStorage(appStorage);

  const normalizedKeyringState = normalizeKeyringState({
    onKeyringStateWrite(event) {
      recordKeyringStorageDiagnostic(`migration.${event.phase}`, {
        source: event.source,
        state: getKeyringStateSummary(event.value),
        ...(event.error
          ? {
              error:
                event.error instanceof Error
                  ? event.error.message.slice(0, 160)
                  : String(event.error).slice(0, 160),
            }
          : {}),
      });
    },
  });
  const keyringState = normalizedKeyringState.keyringData;

  recordKeyringStorageDiagnostic('normalize.result', {
    result: {
      hasKeyringData: !!normalizedKeyringState.keyringData,
      hasLegacyData: !!normalizedKeyringState.legacyData,
      recoverySource: normalizedKeyringState.recoverySource,
      persistenceBlocked: normalizedKeyringState.persistenceBlocked === true,
      keyringState: getKeyringStateSummary(normalizedKeyringState.keyringData),
    },
    keyring: inspectPersistedKeyringState(
      keyringMMKVInstance,
      APP_MMKV_KEYS.LEGACY_KEYRING_STATE,
    ),
    checkpoint: inspectPersistedKeyringState(
      keyringCheckpointMMKV,
      APP_MMKV_KEYS.LEGACY_KEYRING_STATE,
    ),
    legacyKeyring: inspectPersistedKeyringState(
      legacyKeyringMMKV,
      APP_MMKV_KEYS.LEGACY_KEYRING_STATE,
    ),
    legacy: inspectPersistedKeyringState(
      appMMKVInstance,
      APP_MMKV_KEYS.LEGACY_KEYRING_STATE,
    ),
  });
  capturePreferenceStorageIssue('before_preference', keyringState);

  GnosisKeyring.setOpenapiService(openapi);
  setTxRpcClient(payload =>
    callCoreService('customRPCService', service =>
      service.defaultEthRPC(payload),
    ),
  );

  const contactService = new ContactBookService({
    storageAdapter: appStorage,
  });
  contactService.subscribeStoreFields((key, value) => {
    if (key === 'aliases') {
      perfEvents.emit('CONTACTS_ALIASES_UPDATE', {
        nextState: value as unknown as ContactBookStore['aliases'],
      });
    }
  });
  migrateService(APP_STORE_NAMES.contactBook, contactService);

  const keyringService = new KeyringService({
    encryptor: new RNEncryptor(),
    keyringClasses,
    onSetAddressAlias,
    onCreateKeyring,
    contactService,
    perfLogger: {
      instant(event, data) {
        if (!isNonPublicProductionEnv) {
          return;
        }

        logger.info(`[RabbyKeyringPerf] ${event}`, data || {});
        traceAndroidInstant(`keyring.${event}`, data);
        recordKeyringRuntimePerfDiagnostic(event, data || {});
      },
    },
  });
  recordKeyringStorageDiagnostic('load-store', {
    input: getKeyringStateSummary(keyringState || {}),
  });
  keyringService.loadStore(keyringState || {});
  recordKeyringStorageDiagnostic('load-store.complete', {
    input: getKeyringStateSummary(keyringState || {}),
  });

  let keyringPersistSequence = 0;
  let keyringPersistenceBlocked =
    normalizedKeyringState.persistenceBlocked === true;
  keyringService.store.subscribe(value => {
    const sequence = ++keyringPersistSequence;
    const summary = getKeyringStateSummary(value);
    recordKeyringStorageDiagnostic('persist.request', {
      sequence,
      state: summary,
    });

    if (keyringPersistenceBlocked) {
      recordKeyringStorageDiagnostic('persist.blocked', {
        sequence,
        state: summary,
        reason: 'recovery-or-verification-required',
      });
      return;
    }

    try {
      persistKeyringState({
        key: APP_MMKV_KEYS.LEGACY_KEYRING_STATE,
        keyringStorage: keyringMMKVInstance,
        checkpointStorage: keyringCheckpointMMKV,
        value,
      });
      recordKeyringStorageDiagnostic('persist.complete', {
        sequence,
        state: summary,
      });
    } catch (error) {
      keyringPersistenceBlocked = true;
      recordKeyringStorageDiagnostic('persist.error', {
        sequence,
        state: summary,
        error:
          error instanceof Error
            ? error.message.slice(0, 160)
            : String(error).slice(0, 160),
      });
      throw error;
    }
  });

  const preferenceService = new PreferenceService({
    storageAdapter: appStorage,
    getAllVisibleAccountsArray: () =>
      keyringService.getAllVisibleAccountsArray(),
  });
  const keyringPasswordState = keyringService.getPasswordState();
  if (keyringPasswordState) {
    const expectedAutoGenerated =
      keyringPasswordState.origin === 'auto-generated' &&
      keyringPasswordState.pendingAuthTransition !== 'disable-biometrics';
    if (
      preferenceService.store.passwordIsAutoGenerated !== expectedAutoGenerated
    ) {
      preferenceService.setPasswordIsAutoGeneratedDurably(
        expectedAutoGenerated,
      );
    }
  }
  preferenceService.subscribeStoreFields((key, value) => {
    if (key === USER_BEHAVIOR_TRACKING_OPT_OUT_KEY) {
      setUserBehaviorTrackingOptOutCache(value !== false);
      void import('@/utils/analytics')
        .then(({ syncFirebaseAnalyticsCollectionWithOptOut }) =>
          syncFirebaseAnalyticsCollectionWithOptOut(),
        )
        .catch(error => {
          if (__DEV__) {
            console.error(
              '[startupCoreLoader] syncFirebaseAnalyticsCollectionWithOptOut error',
              error,
            );
          }
        });
      void import('@/core/sentry')
        .then(({ syncSentryUserBehaviorTrackingEnabled }) =>
          syncSentryUserBehaviorTrackingEnabled(),
        )
        .catch(error => {
          if (__DEV__) {
            console.error(
              '[startupCoreLoader] syncSentryUserBehaviorTrackingEnabled error',
              error,
            );
          }
        });
    }

    perfEvents.emit('PREFERENCE_UPDATED', {
      key,
      value,
    });
  });

  capturePreferenceStorageIssue('after_preference', keyringState);
  migrateService(APP_STORE_NAMES.preference, preferenceService);

  registerCoreServices({
    contactService,
    keyringService,
    preferenceService,
  });
}
