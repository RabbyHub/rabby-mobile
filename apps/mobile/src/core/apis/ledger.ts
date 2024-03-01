import { bindLedgerEvents } from '@/utils/ledger';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { keyringService } from '../services';
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import PQueue from 'p-queue';

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
): Promise<[boolean, string?]> {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  const detail = keyring.getAccountInfo(address);

  if (!detail?.deviceId) {
    return [false];
  }

  keyring.setDeviceId(detail.deviceId);
  try {
    await TransportBLE.open(detail.deviceId, 1000);
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

export async function importFirstAddress(): Promise<string | false> {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  let address;
  try {
    await keyring.setHDPathType(LedgerHDPathType.LedgerLive);
    await keyring.setAccountToUnlock(0);
    address = (await keyringService.addNewAccount(keyring as any))[0];
  } catch (e) {
    // TODO Cannot read property 'getAddress' of null 如果是这个错误，报错并提示重新连接
    console.log('aaa', e);
    return false;
  }
  return address;
}
