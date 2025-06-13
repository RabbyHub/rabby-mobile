import { getKeyring } from './keyring';
import { KeystoneKeyring } from '@rabby-wallet/eth-keyring-keystone';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { keyringService, preferenceService } from '../services/shared';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import {
  AcquireMemeStoreData,
  MemStoreDataReady,
} from '@rabby-wallet/eth-keyring-keystone/dist/KeystoneKeyring';
import { eventBus, EVENTS } from '@/utils/events';

export async function submitQRHardwareCryptoHDKey(cbor: string) {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  keyring.readKeyring();
  return keyring.submitCryptoHDKey(cbor);
}

export async function submitQRHardwareCryptoAccount(cbor: string) {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  keyring.readKeyring();
  return keyring.submitCryptoAccount(cbor);
}

export async function importAddress(index: number) {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

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
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );
  const res = await keyring.getCurrentUsedHDPathType();
  return res as unknown as LedgerHDPathType;
}

export async function isReady() {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  return keyring.isReady();
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  return keyring.getAddresses(start, end);
}

export async function getCurrentAccounts() {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  return keyring.getCurrentAccounts();
}
export async function removeAddressAndForgetDevice() {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );
  const accounts = await getCurrentAccounts();

  await Promise.all(
    accounts.map(
      async account =>
        await keyringService.removeAccount(
          account.address,
          KEYRING_CLASS.HARDWARE.KEYSTONE,
          undefined,
          true,
        ),
    ),
  );

  await keyring.forgetDevice();
  return;
}

export async function exportCurrentSignRequestIdIfExist() {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  return keyring.exportCurrentSignRequestIdIfExist();
}

export async function acquireKeystoneMemStoreData() {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

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
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  return keyring.submitSignature(requestId, cbor);
}

export async function getMaxAccountLimit() {
  const keyring = await getKeyring<KeystoneKeyring>(
    KEYRING_TYPE.KeystoneKeyring,
  );

  return keyring.getMaxAccountLimit();
}
