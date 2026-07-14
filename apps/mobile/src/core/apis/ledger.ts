import { bindLedgerEvents } from '@/utils/ledger';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import type { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import { preferenceServiceApi } from '@/core/serviceApi/preference';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import type PQueue from 'p-queue';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { UpdateFirmwareAlert } from '@/utils/bluetoothPermissions';
import {
  connectLedgerDevice,
  connectKnownLedgerDeviceById,
  disconnectLedgerDevice,
  getLedgerAppAndVersion,
  getLedgerDeviceSessionState,
  getKnownLedgerDevice,
  resetLedgerDeviceSession,
  subscribeLedgerDevices,
  type LedgerDmkDevice,
} from '@/core/keyring-bridge/ledger/ledger-dmk';

let queue: PQueue;
setTimeout(() => {
  queue = new (require('p-queue/dist').default)({ concurrency: 1 });
}, 0);
export async function initLedgerKeyring() {
  return getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring, keyring => {
    bindLedgerEvents(keyring);
  });
}

export async function importAddress(index: number) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  keyring.setAccountToUnlock(index);
  await queue.clear();
  const result = await queue.add(() =>
    keyringServiceApi.addNewAccount(keyring as any),
  );
  await preferenceServiceApi.initCurrentAccount();
  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  try {
    return await queue.add(() => keyring.getAddresses(start, end));
  } catch (e) {
    const deviceId = await keyring.getDeviceId();
    if (deviceId) {
      resetLedgerDeviceSession(deviceId);
    }
    throw e;
  }
}

export async function setDeviceId(deviceId: string) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  return keyring.setDeviceId(deviceId);
}

export async function cleanUp() {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  return keyring.cleanUp();
}

export async function isConnected(
  address: string,
): Promise<[boolean, string?]> {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  const detail = keyring.getAccountInfo(address);

  if (!detail?.deviceId) {
    return [false];
  }

  keyring.setDeviceId(detail.deviceId);

  const state = await getLedgerDeviceSessionState(detail.deviceId);
  if (state?.deviceStatus === 'CONNECTED') {
    return [true, detail.deviceId];
  }

  try {
    await connectKnownLedgerDeviceById(detail.deviceId);
    const connectedState = await getLedgerDeviceSessionState(detail.deviceId);
    return [connectedState?.deviceStatus === 'CONNECTED', detail.deviceId];
  } catch {
    return [false, detail.deviceId];
  }
}

export async function getCurrentUsedHDPathType() {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  try {
    await queue.add(() => keyring.unlock());
    const res = await queue.add(() => keyring.getCurrentUsedHDPathType());
    return res;
  } catch (e) {
    const deviceId = await keyring.getDeviceId();
    if (deviceId) {
      resetLedgerDeviceSession(deviceId);
    }
  }
}

export async function setCurrentUsedHDPathType(hdPathType: LedgerHDPathType) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  await keyring.setHDPathType(hdPathType);
  return queue.add(() => keyring.setCurrentUsedHDPathType());
}

export async function setHDPathType(hdPathType: LedgerHDPathType) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  return keyring.setHDPathType(hdPathType);
}

export async function getInitialAccounts() {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  return queue.add(() => keyring.getInitialAccounts());
}

export async function getCurrentAccounts() {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  return queue.add(() => keyring.getCurrentAccounts());
}

export async function importFirstAddress({
  retryCount = 1,
}: {
  retryCount?: number;
}): Promise<string | false> {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  let address;

  const task = async () => {
    try {
      await keyring.setHDPathType(LedgerHDPathType.LedgerLive);
      await keyring.setAccountToUnlock(0);
      address = (await keyringServiceApi.addNewAccount(keyring as any))[0];
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
  await preferenceServiceApi.initCurrentAccount();

  return address;
}

// Fork from https://github.com/MetaMask/metamask-mobile/blob/0c45fbfb082da964403fc230e84f20921d980598/app/components/hooks/Ledger/useLedgerBluetooth.ts#L151
export async function checkEthApp(cb: (result: boolean) => void) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  try {
    const deviceId = await keyring.getDeviceId();
    let appAndVersion: { appName: string; version: string };

    if (deviceId) {
      appAndVersion = await getLedgerAppAndVersion(deviceId);
    } else {
      await keyring.makeApp();
      appAndVersion = await keyring.getAppAndVersion();
    }

    const { appName } = appAndVersion;
    const isEthApp = appName === 'Ethereum';

    cb(isEthApp);
    return isEthApp;
  } catch (e: any) {
    const message = ledgerErrorHandler(e);

    if (message === LEDGER_ERROR_CODES.FIRMWARE_OR_APP_UPDATE_REQUIRED) {
      UpdateFirmwareAlert();
      throw new Error(message);
    }

    throw e;
  }
}

export function searchDevices({
  next,
  error,
}: {
  next(device: LedgerDmkDevice): void;
  error(error: Error): void;
}) {
  return subscribeLedgerDevices({ next, error });
}

export async function connectDevice(device: LedgerDmkDevice) {
  return connectLedgerDevice(device);
}

export async function connectDeviceById(deviceId: string) {
  return connectKnownLedgerDeviceById(deviceId);
}

export function getKnownDevice(deviceId: string) {
  return getKnownLedgerDevice(deviceId);
}

export function getMaxAccountLimit() {
  return undefined;
}

export async function fixDeviceId(address: string, deviceId: string) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  keyring.setDeviceId(deviceId);
  await keyring.fixDeviceId(address, deviceId);
  await keyringServiceApi.persistKeyringsForKeyring(keyring);
  return;
}
