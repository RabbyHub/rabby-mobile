import { getKeyring } from './keyring';
import { KeystoneKeyring } from '@rabby-wallet/eth-keyring-keystone';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { keyringService } from '../services/shared';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';

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
  return ((await keyringService.addNewAccount(keyring as any))[0] as any)
    .address;
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
  await keyring.readKeyring();
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
