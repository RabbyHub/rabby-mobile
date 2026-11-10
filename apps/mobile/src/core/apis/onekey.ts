import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import { preferenceServiceApi } from '@/core/serviceApi/preference';
import { bindOneKeyEvents } from '@/utils/onekey';
import { getOneKeyErrorCode, isOneKeyBleSetupError } from '@/utils/onekeyError';
import HardwareBleSdk from '@onekeyfe/hd-ble-sdk';
import { DEVICE } from '@onekeyfe/hd-core';
import { atom, useAtom } from 'jotai';
import type { SearchDevice } from '@onekeyfe/hd-core';
import React from 'react';
import { zCreate } from '../utils/reexports';
import type { UpdaterOrPartials } from '../utils/store';
import { resolveValFromUpdater } from '../utils/store';

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

async function getOneKeyKeyring() {
  const keyring = await getKeyring<OneKeyKeyring>(KEYRING_TYPE.OneKeyKeyring);
  bindOneKeyEvents(keyring);
  return keyring;
}

export async function initOneKeyKeyring() {
  return getOneKeyKeyring();
}

export async function importAddress(index: number) {
  const keyring = await getOneKeyKeyring();

  keyring.setAccountToUnlock(index.toString());
  const result = await keyringServiceApi.addNewAccount(keyring as any);
  await preferenceServiceApi.initCurrentAccount();
  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getOneKeyKeyring();
  return keyring.getAddresses(start, end);
}

export async function unlockDevice() {
  const keyring = await getOneKeyKeyring();

  await keyring.unlock();
}

export async function fixConnectId(address: string, connectId: string) {
  const keyring = await getOneKeyKeyring();

  await keyring.fixConnectId(address, connectId);
  await keyringServiceApi.persistKeyringsForKeyring(keyring);

  return;
}

type SearchDevicesResult = Awaited<
  ReturnType<OneKeyKeyring['bridge']['searchDevices']>
>;

/**
 * Scan for OneKey devices over BLE.
 *
 * Each SDK scan is one short window (about 3s). Scan again while nothing is
 * found or the scan failed for a transient reason, but stop right away on
 * Bluetooth setup errors (off, no permission, location services off,
 * unsupported) since scanning again cannot fix them, and when the caller no
 * longer wants the result (e.g. the sheet was closed).
 */
export async function searchDevices({
  maxAttempts = 8,
  retryDelayMs = 1000,
  shouldStop,
}: {
  maxAttempts?: number;
  retryDelayMs?: number;
  shouldStop?: () => boolean;
} = {}): Promise<SearchDevicesResult> {
  const keyring = await getOneKeyKeyring();
  await keyring.init();

  let res = await keyring.bridge.searchDevices();
  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    if (shouldStop?.()) {
      break;
    }
    if (res.success && res.payload.length > 0) {
      break;
    }
    if (!res.success && isOneKeyBleSetupError(getOneKeyErrorCode(res))) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    if (shouldStop?.()) {
      break;
    }
    res = await keyring.bridge.searchDevices();
  }

  return res;
}

/**
 * Release the device from whatever it is waiting for (PIN, passphrase,
 * on-device confirmation) so the next request does not hit "device busy".
 * Safe to call when nothing is pending.
 */
export async function cancel() {
  const keyring = await getOneKeyKeyring();
  const connectId = keyring.connectId || keyring._deviceConnectId;
  if (!connectId) {
    return;
  }
  try {
    await keyring.bridge.cancel(connectId);
  } catch (e) {
    console.warn('[OneKey] cancel failed', e);
  }
}

export async function setDeviceConnectId(deviceConnectId: string) {
  const keyring = await getOneKeyKeyring();

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
  const keyring = await getOneKeyKeyring();
  return keyring.getCurrentAccounts();
}

export async function cleanUp() {
  const keyring = await getOneKeyKeyring();
  // keyring.bridge.dispose();
  return keyring.cleanUp();
}

export async function isConnected(
  address: string,
): Promise<[boolean, string?]> {
  const keyring = await getOneKeyKeyring();
  const detail = keyring.getAccountInfo(address);

  if (!detail?.connectId) {
    return [false];
  }

  keyring.setDeviceConnectId(detail.connectId);

  try {
    await keyring.trySearchDevice();
    return [true, detail.connectId];
  } catch (e) {
    return [false, detail.connectId];
  }
}

export function getMaxAccountLimit() {
  return undefined;
}
