import { preferenceService } from '@/core/services';
import { bindLedgerEvents } from '@/utils/ledger';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { keyringService } from '../services/shared';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import PQueue from 'p-queue';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { UpdateFirmwareAlert } from '@/utils/bluetoothPermissions';
import {
  connectLedgerDevice,
  connectLedgerDeviceById,
  disconnectLedgerDevice,
  isLedgerDeviceConnected,
  isLedgerDeviceReachable,
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
    keyringService.addNewAccount(keyring as any),
  );
  preferenceService.initCurrentAccount();
  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  try {
    return await queue.add(() => keyring.getAddresses(start, end));
  } catch (e) {
    const deviceId = await keyring.getDeviceId();
    if (deviceId) {
      await disconnectLedgerDevice(deviceId);
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
  skipBLEOpen = false,
): Promise<[boolean, string?]> {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  const detail = keyring.getAccountInfo(address);

  if (!detail?.deviceId) {
    return [false];
  }

  keyring.setDeviceId(detail.deviceId);
  if (skipBLEOpen) {
    return [true, detail.deviceId];
  }

  if (
    isLedgerDeviceConnected(detail.deviceId) &&
    (await isLedgerDeviceReachable(detail.deviceId))
  ) {
    return [true, detail.deviceId];
  }

  try {
    await connectLedgerDeviceById(detail.deviceId);
    if (await isLedgerDeviceReachable(detail.deviceId)) {
      return [true, detail.deviceId];
    }
  } catch {
    return [false, detail.deviceId];
  }

  return [false, detail.deviceId];
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
      disconnectLedgerDevice(deviceId);
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
      address = (await keyringService.addNewAccount(keyring as any))[0];
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
  preferenceService.initCurrentAccount();

  return address;
}

// Fork from https://github.com/MetaMask/metamask-mobile/blob/0c45fbfb082da964403fc230e84f20921d980598/app/components/hooks/Ledger/useLedgerBluetooth.ts#L151
export async function checkEthApp(cb: (result: boolean) => void) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  try {
    await keyring.makeApp();
    const { appName } = await keyring.getAppAndVersion();
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

export function getMaxAccountLimit() {
  return undefined;
}

export async function fixDeviceId(address: string, deviceId: string) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  keyring.setDeviceId(deviceId);
  await keyring.fixDeviceId(address, deviceId);
  await keyringService.persistKeyringsForKeyring(keyring);
  return;
}
