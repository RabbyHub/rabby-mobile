import { KeyringTypeName, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import {
  keyringService,
  notificationService,
  preferenceService,
} from '../services';
import { ethErrors } from 'eth-rpc-errors';
import { getKeyringParams } from '../utils/getKeyringParams';
import { EVENTS, eventBus } from '@/utils/events';
import { t } from 'i18next';
import { waitSignComponentAmounted } from '../utils/signEvent';

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

export const stashKeyrings: Record<string | number, any> = {};

export function _getKeyringByType(type: KeyringTypeName) {
  const keyring = keyringService.getKeyringsByType(type)[0];

  if (keyring) {
    return keyring;
  }

  throw ethErrors.rpc.internal(`No ${type} keyring found`);
}

export async function requestKeyring(
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

export const addKeyringToStash = keyring => {
  const stashId = Object.values(stashKeyrings).length + 1;
  stashKeyrings[stashId] = keyring;

  return stashId;
};

export async function _setCurrentAccountFromKeyring(keyring, index = 0) {
  const accounts = keyring.getAccountsWithBrand
    ? await keyring.getAccountsWithBrand()
    : await keyring.getAccounts();
  const account = accounts[index < 0 ? index + accounts.length : index];

  if (!account) {
    throw new Error(t('background.error.emptyAccount'));
  }

  const _account = {
    address: typeof account === 'string' ? account : account.address,
    type: keyring.type,
    brandName: typeof account === 'string' ? keyring.type : account.brandName,
  };
  preferenceService.setCurrentAccount(_account);

  return [_account];
}

export const apisKeyring = {
  signTypedData: async (
    type: string,
    from: string,
    data: string,
    options?: any,
  ) => {
    const keyring = await keyringService.getKeyringForAccount(from, type);
    const res = await keyringService.signTypedMessage(
      keyring,
      { from, data },
      options,
    );
    eventBus.emit(EVENTS.SIGN_FINISHED, {
      success: true,
      data: res,
    });
    return res;
  },

  signTypedDataWithUI: async (
    type: string,
    from: string,
    data: string,
    options?: any,
  ) => {
    const fn = () =>
      waitSignComponentAmounted().then(() => {
        apisKeyring.signTypedData(type, from, data as any, options);
      });

    notificationService.setCurrentRequestDeferFn(fn);
    return fn();
  },
};

export const addKeyring = async (
  keyringId: keyof typeof stashKeyrings,
  byImport = true,
) => {
  const keyring = stashKeyrings[keyringId];
  if (keyring) {
    keyring.byImport = byImport;
    // If keyring exits, just save
    if (keyringService.keyrings.find(item => item === keyring)) {
      await keyringService.persistAllKeyrings();
    } else {
      await keyringService.addKeyring(keyring);
    }
    _setCurrentAccountFromKeyring(keyring, -1);
  } else {
    throw new Error(t('background.error.addKeyring404'));
  }
};

export const hasPrivateKeyInWallet = async (address: string) => {
  let pk: any = null;
  try {
    pk = await keyringService.getKeyringForAccount(
      address,
      KEYRING_TYPE.SimpleKeyring,
    );
  } catch (e) {
    // just ignore the error
  }
  let mnemonic: any = null;
  try {
    mnemonic = await keyringService.getKeyringForAccount(
      address,
      KEYRING_TYPE.HdKeyring,
    );
  } catch (e) {
    // just ignore the error
  }
  if (!pk && !mnemonic) {
    return false;
  }
  return pk?.type || mnemonic?.type;
};
