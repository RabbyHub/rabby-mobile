import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { keyringService } from '../services/shared';

export async function initOneKeyKeyring() {
  return getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring, keyring => {
    (keyring as unknown as OneKeyKeyring).init();
  });
}

export async function importAddress(index: string) {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  keyring.setAccountToUnlock(index);
  const result = await keyringService.addNewAccount(keyring as any);
  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  return keyring.getAddresses(start, end);
}

export async function unlock() {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  return keyring.unlock();
}

export async function searchDevices() {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  console.log('keyring.bridge.searchDevices');
  return keyring.bridge.searchDevices();
}
