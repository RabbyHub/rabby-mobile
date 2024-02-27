import { bindLedgerEvents } from '@/utils/ledger';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { keyringService } from '../services';
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';

export async function initLedgerKeyring() {
  return getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring, keyring => {
    bindLedgerEvents(keyring);
  });
}

export async function importAddress(index: number) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  keyring.setAccountToUnlock(index);
  const result = await keyringService.addNewAccount(keyring as any);

  return result;
}

export async function getAddresses(start: number, end: number) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

  try {
    return keyring.getAddresses(start, end);
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

export async function isConnected(address: string) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  const detail = keyring.getAccountInfo(address);

  if (!detail?.deviceId) {
    return false;
  }

  keyring.setDeviceId(detail.deviceId);
  try {
    await TransportBLE.open(detail.deviceId);
    return true;
  } catch (e) {
    TransportBLE.disconnectDevice(detail.deviceId);
    console.log('ledger is disconnect', e);
    return false;
  }
}

export async function getCurrentUsedHDPathType() {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  try {
    await keyring.unlock();
    return keyring.getCurrentUsedHDPathType();
  } catch (e) {
    const deviceId = await keyring.getDeviceId();
    if (deviceId) {
      TransportBLE.disconnectDevice(deviceId);
    }
  }
}

export async function setHDPathType(hdPathType: LedgerHDPathType) {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  return keyring.setHDPathType(hdPathType);
}

export async function getInitialAccounts() {
  const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);
  return keyring.getInitialAccounts();
}
