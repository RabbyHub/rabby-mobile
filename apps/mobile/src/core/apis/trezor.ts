import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import type { TrezorKeyring } from '@/core/keyring-bridge/trezor/trezor-keyring';
import { keyringService, preferenceService } from '../services/shared';
// import { bindOneKeyEvents } from '@/utils/onekey';

export async function initTrezorKeyring() {
  return getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring, keyring => {
    (keyring as unknown as TrezorKeyring).init();
  });
}

export async function importAddress(index: number) {
  const keyring = await getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring);

  keyring.setAccountToUnlock(index.toString());
  const result = await keyringService.addNewAccount(keyring as any);
  preferenceService.initCurrentAccount();
  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring);
  return keyring.getAddresses(start, end);
}

export async function unlockDevice() {
  const keyring = await getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring);

  await keyring.unlock();
}

export async function getAccounts() {
  const keyring = await getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring);

  return keyring.getAccounts();
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

export async function getCurrentAccounts() {
  const keyring = await getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring);
  return keyring.getCurrentAccounts();
}

export async function cleanUp() {
  const keyring = await getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring);
  // keyring.bridge.dispose();
  return keyring.cleanUp();
}

export async function isConnected(
  address: string,
): Promise<[boolean, string?]> {
  const keyring = await getKeyring<TrezorKeyring>(KEYRING_TYPE.TrezorKeyring);
  const detail = keyring.getAccountInfo(address);

  console.log('TrezorKeyring isConnected', detail);

  return [false];
  // if (!detail?.connectId) {
  //   return [false];
  // }

  // keyring.setDeviceConnectId(detail.connectId);

  // try {
  //   await keyring.trySearchDevice(true);
  //   return [true, detail.connectId];
  // } catch (e) {
  //   return [false, detail.connectId];
  // }
}

export function getMaxAccountLimit() {
  return undefined;
}
