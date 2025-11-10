import { preferenceService } from '@/core/services';
import { bindLedgerEvents } from '@/utils/ledger';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { keyringService } from '../services/shared';
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import PQueue from 'p-queue';
import { t } from 'i18next';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { UpdateFirmwareAlert } from '@/utils/bluetoothPermissions';

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
    return queue.add(() => keyring.getAddresses(start, end));
  } catch (e) {
    const deviceId = await keyring.getDeviceId();
    if (deviceId) {
      TransportBLE.disconnectDevice(deviceId);
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
  try {
    if (!skipBLEOpen) {
      await TransportBLE.open(detail.deviceId, 1000);
    }
    return [true, detail.deviceId];
  } catch (e) {
    TransportBLE.disconnectDevice(detail.deviceId);
    console.log('ledger is disconnect', e);
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
      TransportBLE.disconnectDevice(deviceId);
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
  } catch (e: any) {
    const message = ledgerErrorHandler(e);

    if (message === LEDGER_ERROR_CODES.FIRMWARE_OR_APP_UPDATE_REQUIRED) {
      UpdateFirmwareAlert();
      throw new Error(message);
    }
  }
  const { appName } = await keyring.getAppAndVersion();

  if (appName === 'BOLOS') {
    try {
      cb(false);
      await keyring.openEthApp();
      return false;
    } catch (e: any) {
      if (e.name === 'TransportStatusError') {
        switch (e.statusCode) {
          case 0x6984:
          case 0x6807:
            throw new Error(
              t(
                'page.newAddress.ledger.error.ethereum_app_not_installed_error',
              ),
            );
          case 0x6985:
          case 0x5501:
            throw new Error(
              t('page.newAddress.ledger.error.ethereum_app_unconfirmed_error'),
            );
        }
      }

      throw new Error(
        t('page.newAddress.ledger.error.ethereum_app_open_error'),
      );
    }
  } else if (appName !== 'Ethereum') {
    try {
      await keyring.quitApp();
    } catch (e) {
      throw new Error(
        t('page.newAddress.ledger.error.running_app_close_error'),
      );
    }

    return checkEthApp(cb);
  }

  return true;
}

export function getMaxAccountLimit() {
  return undefined;
}

export async function fixDeviceId(address: string, deviceId: string) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  await keyring.fixDeviceId(address, deviceId);
  await keyringService.persistAllKeyrings();
  return;
}
