import { KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { keyringService } from '../services';
import { ethErrors } from 'eth-rpc-errors';
import { getKeyringParams } from '../utils/getKeyringParams';

export async function getKeyring<T = KeyringInstance>(
  type: KeyringTypeName,
  callbackOnNewKeyring?: (keyring: KeyringInstance) => void,
): Promise<T> {
  let keyring = keyringService.getKeyringByType(type) as any as KeyringInstance;
  let isNewKey = false;

  if (!keyring) {
    const Keyring = keyringService.getKeyringClassForType(type);
    keyring = new Keyring(getKeyringParams(type));
    isNewKey = true;
  }

  if (isNewKey) {
    await keyringService.addKeyring(keyring);
    callbackOnNewKeyring?.(keyring);
  }

  return keyring as T;
}

const stashKeyrings: Record<string | number, any> = {};

function _getKeyringByType(type: KeyringTypeName) {
  const keyring = keyringService.getKeyringsByType(type)[0];

  if (keyring) {
    return keyring;
  }

  throw ethErrors.rpc.internal(`No ${type} keyring found`);
}

export function requestKeyring(
  type: KeyringTypeName,
  methodName: string,
  keyringId: number | null,
  ...params: any[]
) {
  let keyring: any;
  if (keyringId !== null && keyringId !== undefined) {
    keyring = stashKeyrings[keyringId];
  } else {
    try {
      keyring = _getKeyringByType(type);
    } catch {
      const Keyring = keyringService.getKeyringClassForType(type);
      keyring = new Keyring(getKeyringParams(type));
    }
  }
  if (keyring[methodName]) {
    return keyring[methodName].call(keyring, ...params);
  }
}
