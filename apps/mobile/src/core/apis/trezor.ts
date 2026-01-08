import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import type { TrezorKeyring } from '@/core/keyring-bridge/trezor/trezor-keyring';
import { keyringService, preferenceService } from '../services/shared';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
// import { bindOneKeyEvents } from '@/utils/onekey';

const trezorType = KEYRING_TYPE.TrezorKeyring;

export async function initTrezorKeyring() {
  return getKeyring<TrezorKeyring>(trezorType, keyring => {
    (keyring as unknown as TrezorKeyring).init();
  });
}

export async function importAddress(index: number) {
  const keyring = await getKeyring<TrezorKeyring>(trezorType);

  keyring.setAccountToUnlock(index.toString());
  const result = await keyringService.addNewAccount(keyring);
  preferenceService.initCurrentAccount();
  console.log('importAddress index', index, result);
  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<TrezorKeyring>(trezorType);
  const data = await keyring.getAddresses(start, end);
  return data;
}

export async function unlockDevice() {
  const keyring = await getKeyring<TrezorKeyring>(trezorType);

  await keyring.unlock();
}

export async function getAccounts() {
  const keyring = await getKeyring<TrezorKeyring>(trezorType);

  return keyring.getAccounts();
}

export async function setHDPathType(hdPathType: LedgerHDPathType) {
  const keyring = await getKeyring<TrezorKeyring>(trezorType);
  return keyring.setHDPathType(hdPathType);
}

export async function importFirstAddress({
  retryCount = 1,
}: {
  retryCount?: number;
}): Promise<string[]> {
  let address;

  const task = async () => {
    try {
      address = await importAddress(0);
    } catch (e: any) {
      // only catch not `duplicate import` error
      if (!e.message?.includes('import is invalid')) {
        throw e;
      }
      return [];
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
  const keyring = await getKeyring<TrezorKeyring>(trezorType);
  return keyring.getCurrentAccounts();
}

export async function cleanUp() {
  const keyring = await getKeyring<TrezorKeyring>(trezorType);
  // keyring.bridge.dispose();
  return keyring.cleanUp();
}

export async function isConnected(
  address: string,
): Promise<[boolean, string?]> {
  const keyring = await getKeyring<TrezorKeyring>(trezorType);
  const detail = keyring.getAccountInfo(address);

  console.log('TrezorKeyring isConnected', detail);

  return [false];
}

export function getMaxAccountLimit() {
  return undefined;
}
