import { KeystoneKeyring } from '@rabby-wallet/eth-keyring-keystone';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { keyringService, preferenceService } from '../services/shared';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import {
  AcquireMemeStoreData,
  MemStoreDataReady,
} from '@rabby-wallet/eth-keyring-keystone/dist/KeystoneKeyring';
import { eventBus, EVENTS } from '@/utils/events';
import { createFreshKeystoneKeyring } from '../keyring-bridge/keystone/keystone-keyring-factory';

export type KeystoneDeviceSummary = {
  deviceId: number;
  primaryAddress: string | null;
  accountsCount: number;
  fingerprint: string;
};

// --- Multi-keyring support ---

/**
 * Tracks the keyring currently being configured during the import flow.
 * This is set by submitQRHardwareCryptoHDKey/Account and used by
 * import/address functions. It is cleared after the import flow completes.
 */
let activeKeystoneKeyring: KeystoneKeyring | null = null;

/**
 * Returns all existing Keystone keyrings.
 */
function getAllExistingKeystoneKeyrings(): KeystoneKeyring[] {
  return keyringService.getKeyringsByType(
    KEYRING_TYPE.KeystoneKeyring,
  ) as unknown as KeystoneKeyring[];
}

/**
 * Returns first existing Keystone keyring, if any.
 */
function getExistingKeystoneKeyring(): KeystoneKeyring | null {
  return getAllExistingKeystoneKeyrings()[0] ?? null;
}

/**
 * Returns the active keyring (during import flow) or an existing keyring.
 * Throws instead of creating an implicit keyring if no Keystone exists.
 */
function getActiveOrExistingKeyring(): KeystoneKeyring {
  if (activeKeystoneKeyring) {
    return activeKeystoneKeyring;
  }
  const keyring = getExistingKeystoneKeyring();
  if (!keyring) {
    throw new Error('No Keystone keyring found');
  }
  return keyring;
}

function getFingerprint(keyring: KeystoneKeyring, index: number): string {
  const xpub = (keyring as any).xpub;
  if (typeof xpub === 'string' && xpub.length > 10) {
    return `${xpub.slice(0, 6)}...${xpub.slice(-4)}`;
  }

  const pathsText = JSON.stringify((keyring as any).paths ?? {});
  if (pathsText !== '{}' && pathsText.length > 10) {
    return `${pathsText.slice(0, 6)}...${pathsText.slice(-4)}`;
  }

  return `device-${index + 1}`;
}

/**
 * Finds the keyring that has an active sign request.
 * Used by signing-related functions instead of the import-flow active keyring.
 */
function getKeystoneKeyringWithActiveSign(): KeystoneKeyring | null {
  const keyrings = getAllExistingKeystoneKeyrings();
  for (const kr of keyrings) {
    try {
      if (kr.getMemStore().getState().sign?.request) {
        return kr;
      }
    } catch {
      // ignore keyrings that fail to get memstore
    }
  }
  return null;
}

/**
 * Clears the active keyring reference. Should be called when the import
 * flow finishes (success or cancellation).
 */
export function clearActiveKeystoneKeyring() {
  activeKeystoneKeyring = null;
}

/**
 * Returns true if there is at least one Keystone keyring registered.
 */
export function hasAnyKeystoneKeyring(): boolean {
  return getAllExistingKeystoneKeyrings().length > 0;
}

/**
 * Returns true if at least one Keystone keyring has imported accounts.
 */
export async function hasAnyKeystoneAccount(): Promise<boolean> {
  const keyrings = getAllExistingKeystoneKeyrings();
  for (const keyring of keyrings) {
    try {
      const accounts = await keyring.getCurrentAccounts();
      if (accounts.length > 0) {
        return true;
      }
    } catch {
      // ignore broken keyrings
    }
  }
  return false;
}

/**
 * Returns the number of Keystone keyrings currently registered.
 */
export function getKeystoneKeyringsCount(): number {
  return getAllExistingKeystoneKeyrings().length;
}

/**
 * Returns existing Keystone devices for selection in UI.
 */
export async function getKeystoneDevices(): Promise<KeystoneDeviceSummary[]> {
  const keyrings = getAllExistingKeystoneKeyrings();
  return Promise.all(
    keyrings.map(async (keyring, index) => {
      let accounts: { address: string }[] = [];
      try {
        accounts = await keyring.getCurrentAccounts();
      } catch {
        // ignore broken keyrings and still allow selection
      }
      return {
        deviceId: index,
        primaryAddress: accounts[0]?.address ?? null,
        accountsCount: accounts.length,
        fingerprint: getFingerprint(keyring, index),
      };
    }),
  );
}

export function setActiveKeystoneKeyringByDeviceId(deviceId: number): boolean {
  const keyring = getAllExistingKeystoneKeyrings()[deviceId];
  if (!keyring) {
    activeKeystoneKeyring = null;
    return false;
  }
  activeKeystoneKeyring = keyring;
  return true;
}

export async function setActiveKeystoneKeyringByAddress(
  address: string,
): Promise<boolean> {
  const keyrings = getAllExistingKeystoneKeyrings();
  for (const keyring of keyrings) {
    try {
      const accounts = await keyring.getCurrentAccounts();
      const matched = accounts.some(
        account => account.address?.toLowerCase() === address.toLowerCase(),
      );
      if (matched) {
        activeKeystoneKeyring = keyring;
        return true;
      }
    } catch {
      // ignore broken keyrings and continue matching
    }
  }
  return false;
}

// --- Submit functions (create or reuse keyrings) ---

export async function submitQRHardwareCryptoHDKey(cbor: string) {
  // Create a fresh keyring instance to avoid singleton reuse across devices.
  const tempKeyring = createFreshKeystoneKeyring();
  // Reset the shared interaction provider to clear stale sync listeners
  tempKeyring.getInteraction().reset();
  tempKeyring.readKeyring();
  await tempKeyring.submitCryptoHDKey(cbor);

  // Check if an existing keyring already has the same xpub (same device)
  const existingKeyrings = keyringService.getKeyringsByType(
    KEYRING_TYPE.KeystoneKeyring,
  ) as unknown as KeystoneKeyring[];
  const tempXpub = (tempKeyring as any).xpub;
  const matchingKeyring = existingKeyrings.find(
    kr => kr !== tempKeyring && (kr as any).xpub === tempXpub && tempXpub,
  );

  if (matchingKeyring) {
    // Same device - reuse existing keyring
    activeKeystoneKeyring = matchingKeyring as KeystoneKeyring;
  } else {
    // New device - register the new keyring
    await keyringService.addKeyring(tempKeyring as any);
    activeKeystoneKeyring = tempKeyring;
  }
}

export async function submitQRHardwareCryptoAccount(cbor: string) {
  // Create a fresh keyring instance to avoid singleton reuse across devices.
  const tempKeyring = createFreshKeystoneKeyring();
  // Reset the shared interaction provider to clear stale sync listeners
  tempKeyring.getInteraction().reset();
  tempKeyring.readKeyring();
  await tempKeyring.submitCryptoAccount(cbor);

  // For crypto-account mode, compare the derived paths/addresses
  // Since there's no xpub in pubkey mode, compare the paths keys
  const existingKeyrings = keyringService.getKeyringsByType(
    KEYRING_TYPE.KeystoneKeyring,
  ) as unknown as KeystoneKeyring[];
  const tempPaths = JSON.stringify((tempKeyring as any).paths);
  const matchingKeyring = existingKeyrings.find(
    kr =>
      kr !== tempKeyring &&
      JSON.stringify((kr as any).paths) === tempPaths &&
      tempPaths !== '{}',
  );

  if (matchingKeyring) {
    // Same device - reuse existing keyring
    activeKeystoneKeyring = matchingKeyring as KeystoneKeyring;
  } else {
    // New device - register the new keyring
    await keyringService.addKeyring(tempKeyring as any);
    activeKeystoneKeyring = tempKeyring;
  }
}

// --- Import functions (use active keyring) ---

export async function importAddress(index: number) {
  const keyring = getActiveOrExistingKeyring();

  // Pre-check: derive the address and verify it doesn't already exist
  // in any Keystone keyring (prevents duplicate imports).
  // getAddresses also populates keyring.indexes as a side-effect.
  const [derived] = await keyring.getAddresses(index, index + 1);
  if (derived) {
    const allKeyrings = getAllExistingKeystoneKeyrings();
    for (const kr of allKeyrings) {
      const existing = await kr.getAccounts();
      if (
        existing.some(
          addr => addr.toLowerCase() === derived.address.toLowerCase(),
        )
      ) {
        throw new Error('import is invalid');
      }
    }
  }

  keyring.setAccountToUnlock(index);
  const res = ((await keyringService.addNewAccount(keyring as any))[0] as any)
    .address;

  preferenceService.initCurrentAccount();

  return res;
}

export async function importFirstAddress({
  retryCount = 1,
}: {
  retryCount?: number;
}): Promise<string | false> {
  let address;

  const task = async () => {
    try {
      address = await importAddress(0);
    } catch (e: any) {
      // only catch not `duplicate import` error
      if (!e.message?.includes('import is invalid')) {
        throw e;
      }
      return false;
    }
  };

  for (let i = 0; i < retryCount; i++) {
    try {
      await task();
      break;
    } catch (e) {
      if (i === retryCount - 1) {
        throw e;
      }
    }
  }

  return address;
}

export async function getCurrentUsedHDPathType() {
  const keyring = getActiveOrExistingKeyring();
  const res = await keyring.getCurrentUsedHDPathType();
  return res as unknown as LedgerHDPathType;
}

export async function isReady() {
  const keyring = getActiveOrExistingKeyring();
  return keyring.isReady();
}

export async function getAddresses(start: number, end: number) {
  const keyring = getActiveOrExistingKeyring();
  return keyring.getAddresses(start, end);
}

export async function getCurrentAccounts() {
  const keyring = getActiveOrExistingKeyring();
  return keyring.getCurrentAccounts();
}

export async function getMaxAccountLimit() {
  const keyring = getActiveOrExistingKeyring();
  return keyring.getMaxAccountLimit();
}

// --- Device removal (scoped to a specific keyring) ---

export async function removeAddressAndForgetDevice(
  targetKeyring?: KeystoneKeyring,
) {
  const explicit = targetKeyring || activeKeystoneKeyring;
  if (!explicit && getAllExistingKeystoneKeyrings().length > 1) {
    throw new Error(
      'Multiple Keystone keyrings exist. Specify which device to remove.',
    );
  }
  const keyring = explicit || getExistingKeystoneKeyring();

  if (!keyring) {
    return;
  }

  const accounts = await keyring.getCurrentAccounts();

  await Promise.all(
    accounts.map(async account =>
      keyringService.removeAccount(
        account.address,
        KEYRING_CLASS.HARDWARE.KEYSTONE,
        undefined,
        true,
      ),
    ),
  );

  await keyring.forgetDevice();
  if (activeKeystoneKeyring === keyring) {
    clearActiveKeystoneKeyring();
  }
}

// --- Signing functions (find keyring with active sign request) ---

export async function exportCurrentSignRequestIdIfExist() {
  const keyring =
    getKeystoneKeyringWithActiveSign() || getExistingKeystoneKeyring();
  if (!keyring) {
    return null;
  }

  return keyring.exportCurrentSignRequestIdIfExist();
}

export async function acquireKeystoneMemStoreData() {
  const keyring =
    getKeystoneKeyringWithActiveSign() || getExistingKeystoneKeyring();
  if (!keyring) {
    throw new Error('No Keystone keyring found');
  }

  keyring.getInteraction().once(MemStoreDataReady, request => {
    eventBus.emit(EVENTS.QRHARDWARE.ACQUIRE_MEMSTORE_SUCCEED, {
      request,
    });
  });
  keyring.getInteraction().emit(AcquireMemeStoreData);
}

export async function submitQRHardwareSignature(
  requestId: string,
  cbor: string,
) {
  const keyring =
    getKeystoneKeyringWithActiveSign() || getExistingKeystoneKeyring();
  if (!keyring) {
    throw new Error('No Keystone keyring found');
  }

  return keyring.submitSignature(requestId, cbor);
}
