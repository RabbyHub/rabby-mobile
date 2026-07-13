import type { KeyringTypeName } from '@rabby-wallet/keyring-utils';
import type {
  KeyringInstance,
  KeyringService,
} from '@rabby-wallet/service-keyring';
import {
  callCoreService,
  getRegisteredService,
  waitForCoreServiceRegistration,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type KeyringServiceApiContract = KeyringService;

type KeyringServiceWithVaultDebug = KeyringService & {
  getVaultStorageDebugState: () => {
    hasVault: boolean;
    vaultBytes: number;
    vaultHash: string | null;
    hasBooted: boolean;
    hasUnencryptedKeyringData: boolean;
    unencryptedKeyringCount: number;
    hasEncryptedKeyringData: boolean;
  };
  debugMeasureUnlockPaths: (options: {
    password?: string;
    trustedVaultKeyString?: string;
    measurePassword?: boolean;
    measureCachedKey?: boolean;
  }) => Promise<
    Array<{
      label: string;
      source: 'password' | 'cachedKey';
      success: boolean;
      durationMs: number;
      error?: string;
      keyringCount?: number;
    }>
  >;
  debugExportTrustedVaultKeyString: (password: string) => Promise<string>;
};

type KeyringSubmitPasswordOptions = {
  trustedPassword?: boolean;
  trustedVaultKeyString?: string;
  onTrustedVaultKeyString?: (vaultKeyString: string) => void | Promise<void>;
  deferMemStoreKeyringsUpdate?: boolean;
  deferKeyringRuntimeRestore?: boolean;
};

type KeyringServiceWithUnlockOptions = KeyringService & {
  submitPassword: (
    password: string,
    options?: KeyringSubmitPasswordOptions,
  ) => ReturnType<KeyringService['submitPassword']>;
  refreshMemStoreKeyrings?: () => Promise<unknown>;
};

registerLegacyCoreServiceLoader('keyringService');

export const keyringServiceApi = createDeferredServiceApi<
  'keyringService',
  KeyringServiceApiContract
>('keyringService');

type KeyringMemStoreState = ReturnType<KeyringService['memStore']['getState']>;
type KeyringMemStoreListener = (state: KeyringMemStoreState) => void;
type KeyringStoreState = Parameters<
  KeyringService['store']['subscribe']
>[0] extends (state: infer State, ...args: any[]) => any
  ? State
  : unknown;
type KeyringStoreListener = (state: KeyringStoreState) => void;

function assertKeyringServiceSnapshot() {
  const service = getRegisteredService('keyringService');
  if (!service) {
    throw new Error('keyringService is not ready');
  }
  return service;
}

export function isKeyringUnlockedSnapshot() {
  return getRegisteredService('keyringService')?.isUnlocked() || false;
}

export function isKeyringBootedSnapshot() {
  return getRegisteredService('keyringService')?.isBooted() || false;
}

export function isKeyringRuntimeReadySnapshot() {
  return (
    getRegisteredService('keyringService')?.isKeyringRuntimeReady() || false
  );
}

export function hasKeyringPublicAccountSnapshot() {
  return (
    getRegisteredService('keyringService')?.hasPublicAccountSnapshot() || false
  );
}

export function getPublicAccountSnapshotAccounts() {
  return (
    getRegisteredService(
      'keyringService',
    )?.getPublicAccountSnapshotAccounts() || []
  );
}

export function getKeyringByTypeSnapshot(type: KeyringTypeName) {
  return assertKeyringServiceSnapshot().getKeyringByType(type);
}

export function getKeyringInstancesSnapshot() {
  return assertKeyringServiceSnapshot().keyrings;
}

export function getKeyringsByTypeSnapshot(type: KeyringTypeName) {
  return assertKeyringServiceSnapshot().getKeyringsByType(type);
}

export function hasKeyringInstanceSnapshot(keyring: KeyringInstance) {
  return assertKeyringServiceSnapshot().keyrings.some(item => item === keyring);
}

export function assertKeyringUnlockedSync() {
  assertKeyringServiceSnapshot().assertUnlocked();
}

export function generateMnemonicSync() {
  return assertKeyringServiceSnapshot().generateMnemonic();
}

export function removePreMnemonicsSync() {
  assertKeyringServiceSnapshot().removePreMnemonics();
}

export function getKeyringClassForTypeSnapshot(
  ...args: Parameters<KeyringService['getKeyringClassForType']>
) {
  return assertKeyringServiceSnapshot().getKeyringClassForType(...args);
}

export function updateHdKeyringIndexSync(
  ...args: Parameters<KeyringService['updateHdKeyringIndex']>
) {
  assertKeyringServiceSnapshot().updateHdKeyringIndex(...args);
}

export async function ensureKeyringRuntimeReadyForApi(label: string) {
  await callCoreService('keyringService', async service => {
    if (service.isUnlocked() && !service.isKeyringRuntimeReady()) {
      await service.ensureKeyringRuntimeReady(label);
    }
  });
}

export function getKeyringMemStoreStateSnapshot() {
  return getRegisteredService('keyringService')?.memStore.getState();
}

export async function submitKeyringPasswordForUnlock(
  password: string,
  options?: KeyringSubmitPasswordOptions,
) {
  await callCoreService('keyringService', service =>
    (service as KeyringServiceWithUnlockOptions).submitPassword(
      password,
      options,
    ),
  );
}

export async function refreshKeyringMemStoreKeyringsIfPossible() {
  await callCoreService('keyringService', service =>
    (service as KeyringServiceWithUnlockOptions).refreshMemStoreKeyrings?.(),
  );
}

export async function bindKeyringMemStore(listener: KeyringMemStoreListener) {
  const service = await callCoreService('keyringService', keyring => keyring);

  listener(service.memStore.getState());
  service.memStore.subscribe(listener);

  return () => {
    service.memStore.unsubscribe(listener);
  };
}

export async function bindKeyringStore(listener: KeyringStoreListener) {
  const service = await callCoreService('keyringService', keyring => keyring);

  service.store.subscribe(listener);

  return () => {
    service.store.unsubscribe(listener);
  };
}

export async function bindKeyringEvent(
  event: string,
  listener: (...args: any[]) => void,
) {
  await callCoreService('keyringService', service => {
    service.on(event, listener);
  });

  return () => {
    void callCoreService('keyringService', service => {
      service.off(event, listener);
    }).catch(console.error);
  };
}

export function bindKeyringEventAfterRegistration(
  event: string,
  listener: (...args: any[]) => void,
) {
  const service = getRegisteredService('keyringService');
  if (service) {
    service.on(event, listener);

    return () => {
      service.off(event, listener);
    };
  }

  let disposed = false;
  let disposeRegisteredListener: null | (() => void) = null;

  void waitForCoreServiceRegistration('keyringService')
    .then(registeredService => {
      if (disposed) {
        return;
      }

      registeredService.on(event, listener);
      disposeRegisteredListener = () => {
        registeredService.off(event, listener);
      };
    })
    .catch(error => {
      if (!disposed) {
        console.error('[keyringServiceApi] bind event after registration', error);
      }
    });

  return () => {
    disposed = true;
    disposeRegisteredListener?.();
  };
}

export function bindKeyringEventOnceAfterRegistration(
  event: string,
  listener: (...args: any[]) => void,
) {
  const service = getRegisteredService('keyringService');
  if (service) {
    service.once(event, listener);

    return () => {
      service.off(event, listener);
    };
  }

  let disposed = false;
  let disposeRegisteredListener: null | (() => void) = null;

  void waitForCoreServiceRegistration('keyringService')
    .then(registeredService => {
      if (disposed) {
        return;
      }

      registeredService.once(event, listener);
      disposeRegisteredListener = () => {
        registeredService.off(event, listener);
      };
    })
    .catch(error => {
      if (!disposed) {
        console.error(
          '[keyringServiceApi] bind once after registration',
          error,
        );
      }
    });

  return () => {
    disposed = true;
    disposeRegisteredListener?.();
  };
}

export function bindKeyringEventSync(
  event: string,
  listener: (...args: any[]) => void,
) {
  const service = assertKeyringServiceSnapshot();
  service.on(event, listener);

  return () => {
    service.off(event, listener);
  };
}

export async function getUnencryptedKeyringDataForDev() {
  return keyringServiceApi.DEV_GET_UNENCRYPTED_KEYRING_DATA();
}

export function getKeyringVaultDebugStateSnapshot() {
  return (
    getRegisteredService('keyringService') as
      | KeyringServiceWithVaultDebug
      | undefined
  )?.getVaultStorageDebugState();
}

export async function measureKeyringUnlockPathsForDebug(
  ...args: Parameters<KeyringServiceWithVaultDebug['debugMeasureUnlockPaths']>
) {
  return callCoreService('keyringService', service =>
    (service as KeyringServiceWithVaultDebug).debugMeasureUnlockPaths(...args),
  );
}

export async function exportTrustedVaultKeyStringForDebug(
  ...args: Parameters<
    KeyringServiceWithVaultDebug['debugExportTrustedVaultKeyString']
  >
) {
  return callCoreService('keyringService', service =>
    (service as KeyringServiceWithVaultDebug).debugExportTrustedVaultKeyString(
      ...args,
    ),
  );
}

export async function bindKeyringEventOnce(
  event: string,
  listener: (...args: any[]) => void,
) {
  await callCoreService('keyringService', service => {
    service.once(event, listener);
  });

  return () => {
    void callCoreService('keyringService', service => {
      service.off(event, listener);
    }).catch(console.error);
  };
}
