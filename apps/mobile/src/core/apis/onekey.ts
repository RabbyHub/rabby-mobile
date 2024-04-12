import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { keyringService } from '../services/shared';
import { bindOneKeyEvents } from '@/utils/onekey';

export async function initOneKeyKeyring() {
  return getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring, keyring => {
    bindOneKeyEvents(keyring);
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

export async function unlockDevice() {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  return keyring.unlock();
}

export async function searchDevices() {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  let retryCount = 0;
  const MAX_RETRY_COUNT = 10;
  const pollScan = () => {
    return keyring.bridge.searchDevices().then(res => {
      if (!res.success) {
        if (retryCount >= MAX_RETRY_COUNT) {
          return res;
        }
        retryCount++;
        return new Promise(resolve => setTimeout(resolve, 1000)).then(pollScan);
      }

      return res;
    });
  };

  return pollScan();
}

export async function setDeviceConnectId(deviceConnectId: string) {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  return keyring.setDeviceConnectId(deviceConnectId);
}

export async function importFirstAddress({
  retryCount = 1,
}: {
  retryCount?: number;
}): Promise<string | false> {
  let address;

  const task = async () => {
    try {
      address = await importAddress('0');
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
