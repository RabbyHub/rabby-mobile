import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { keyringService, preferenceService } from '../services/shared';
import { bindOneKeyEvents } from '@/utils/onekey';
import HardwareBleSdk from '@onekeyfe/hd-ble-sdk';
import { DEVICE } from '@onekeyfe/hd-core';
import { atom, useAtom } from 'jotai';
import type { SearchDevice } from '@onekeyfe/hd-core';
import React from 'react';
import { zCreate } from '../utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '../utils/store';

// export const oneKeyDevices = atom<SearchDevice[]>([]);

type OnekeyDevicesState = {
  devices: SearchDevice[];
};

const onekeyDevicesStore = zCreate<OnekeyDevicesState>(() => ({
  devices: [],
}));
function setDevices(
  valOrFunc: UpdaterOrPartials<OnekeyDevicesState['devices']>,
) {
  onekeyDevicesStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.devices, valOrFunc, {
      strict: false,
    });

    return {
      ...prev,
      devices: newVal,
    };
  });
}
export function useOneKeyDevices() {
  const devices = onekeyDevicesStore(s => s.devices);

  return {
    devices,
    setOneKeyDevices: setDevices,
  };
}

export function startSubscribeOnekeyDevices() {
  HardwareBleSdk.on(DEVICE.CONNECT, payload => {
    setDevices(prev => {
      if (prev.find(d => d.connectId === payload?.device?.connectId)) {
        return prev;
      }
      return [...prev, payload?.device];
    });
  });
  HardwareBleSdk.on(DEVICE.DISCONNECT, payload => {
    cleanUp();
    setDevices(prev =>
      prev.filter(d => d.connectId !== payload?.device?.connectId),
    );
  });
}

export async function initOneKeyKeyring() {
  return getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring, keyring => {
    bindOneKeyEvents(keyring);
  });
}

export async function importAddress(index: number) {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  keyring.setAccountToUnlock(index.toString());
  const result = await keyringService.addNewAccount(keyring as any);
  preferenceService.initCurrentAccount();
  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);
  return keyring.getAddresses(start, end);
}

export async function unlockDevice() {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  await keyring.unlock();
}

export async function fixConnectId(address: string, connectId: string) {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);

  await keyring.fixConnectId(address, connectId);
  await keyringService.persistAllKeyrings();

  return;
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
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);
  return keyring.getCurrentAccounts();
}

export async function cleanUp() {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);
  // keyring.bridge.dispose();
  return keyring.cleanUp();
}

export async function isConnected(
  address: string,
): Promise<[boolean, string?]> {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);
  const detail = keyring.getAccountInfo(address);

  if (!detail?.connectId) {
    return [false];
  }

  keyring.setDeviceConnectId(detail.connectId);

  try {
    await keyring.trySearchDevice(true);
    return [true, detail.connectId];
  } catch (e) {
    return [false, detail.connectId];
  }
}

export function getMaxAccountLimit() {
  return undefined;
}
