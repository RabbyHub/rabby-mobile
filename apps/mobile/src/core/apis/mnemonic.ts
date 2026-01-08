import { RootNames } from '@/constant/layout';
import { navigateDeprecated, replaceToFirst } from '@/utils/navigation';
import HdKeyring from '@rabby-wallet/eth-hd-keyring';
import {
  KEYRING_CLASS,
  KEYRING_TYPE,
  KeyringTypeName,
} from '@rabby-wallet/keyring-utils';
import { t } from 'i18next';
import {
  contactService,
  hdKeyringService,
  keyringService,
  preferenceService,
} from '../services';
import { onSetAddressAlias } from '../services/keyringParams';
import { Account } from '../services/preference';
import {
  _getKeyringByType,
  addKeyringToStash,
  stashKeyrings,
  requestKeyring,
} from './keyring';
import { throwErrorIfInvalidPwd } from './lock';
import { accountEvents } from '@/core/apis/account';

export const getMnemonics = async (password: string, address: string) => {
  await throwErrorIfInvalidPwd(password);
  const keyring = await keyringService.getKeyringForAccount(
    address,
    KEYRING_CLASS.MNEMONIC,
  );
  const serialized = await keyring.serialize();
  const seedWords = serialized.mnemonic;

  return seedWords;
};
export const generateMnemonic = () => keyringService.generateMnemonic();
export const getPreMnemonics = () => keyringService.getPreMnemonics();
export const generatePreMnemonic = () => keyringService.generatePreMnemonic();
export const removePreMnemonics = () => keyringService.removePreMnemonics();
export const createKeyringWithMnemonics = async (mnemonic: string) => {
  const keyring = await keyringService.createKeyringWithMnemonics(mnemonic);
  keyringService.removePreMnemonics();
  // return this._setCurrentAccountFromKeyring(keyring);
};

export const getKeyringByMnemonic = (
  mnemonic: string,
  passphrase = '',
): HdKeyring | undefined => {
  const keyring = keyringService.keyrings.find(item => {
    const k = item as unknown as HdKeyring;
    return (
      k.type === KEYRING_CLASS.MNEMONIC &&
      k.mnemonic === mnemonic &&
      (passphrase ? k.checkPassphrase(passphrase) : true)
    );
  }) as unknown as HdKeyring;

  if (passphrase) {
    keyring?.setPassphrase(passphrase);
  }
  return keyring;
};

const _getMnemonicKeyringByAddress = (address: string) => {
  return keyringService.keyrings.find(item => {
    const k = item as unknown as HdKeyring;

    return (
      k.type === KEYRING_CLASS.MNEMONIC &&
      k.mnemonic &&
      k.accounts.includes(address)
    );
  }) as unknown as HdKeyring;
};

const updateKeyringInStash = keyring => {
  let keyringId = Object.keys(stashKeyrings).find(key => {
    return (
      stashKeyrings[key].mnemonic === keyring.mnemonic &&
      stashKeyrings[key].publicKey === keyring.publicKey
    );
  }) as number | undefined;

  if (!keyringId) {
    keyringId = addKeyringToStash(keyring);
  }

  return Number(keyringId);
};

const removeMnemonicKeyringFromStash = keyring => {
  const keyringId = Object.keys(stashKeyrings).find(key => {
    return (
      stashKeyrings[key]?.mnemonic &&
      stashKeyrings[key].mnemonic === keyring.mnemonic
    );
  });
  if (keyringId) {
    delete stashKeyrings[keyringId];
  }
};

const removePublicKeyFromStash = (publicKey: string) => {
  const keyring = getMnemonicKeyRingFromPublicKey(publicKey);
  if (keyring) {
    removeMnemonicKeyringFromStash(keyring);
  }
};

export const removeMnemonicsKeyRingByPublicKey = async (publicKey: string) => {
  removePublicKeyFromStash(publicKey);
  keyringService.removeKeyringByPublicKey(publicKey);
};

const getMnemonicKeyRingFromPublicKey = (publicKey: string) => {
  const targetKeyring = keyringService.keyrings?.find(item => {
    const k = item as unknown as HdKeyring;
    if (
      k.type === KEYRING_CLASS.MNEMONIC &&
      k.mnemonic &&
      k.publicKey === publicKey
    ) {
      return true;
    }
    return false;
  }) as unknown as HdKeyring;

  return targetKeyring;
};

export const getMnemonicFromPublicKey = (publicKey: string) => {
  const targetKeyring = getMnemonicKeyRingFromPublicKey(publicKey);

  return targetKeyring?.mnemonic;
};

export const getMnemonicKeyRingIdFromPublicKey = (publicKey: string) => {
  const targetKeyring = getMnemonicKeyRingFromPublicKey(publicKey);
  let keyringId;
  if (targetKeyring) {
    keyringId = updateKeyringInStash(targetKeyring);
  }
  return keyringId;
};

export const getMnemonicByAddress = (address: string) => {
  const keyring = _getMnemonicKeyringByAddress(address);
  if (!keyring) {
    throw new Error(t('background.error.notFoundKeyringByAddress'));
  }
  return keyring.mnemonic;
};

export const getMnemonicKeyring = async (
  type: 'address' | 'publickey',
  value: string,
) => {
  let keyring: HdKeyring;
  if (type === 'address') {
    keyring = await _getMnemonicKeyringByAddress(value);
  } else {
    keyring = await getMnemonicKeyRingFromPublicKey(value);
  }

  if (!keyring) {
    throw new Error(t('background.error.notFoundKeyringByAddress'));
  }

  return keyring;
};

export const getMnemonicKeyringIfNeedPassphrase = async (
  type: 'address' | 'publickey',
  value: string,
) => {
  const keyring = await getMnemonicKeyring(type, value);
  return keyring.needPassphrase;
};

export const getMnemonicKeyringPassphrase = async (
  type: 'address' | 'publickey',
  value: string,
) => {
  const keyring = await getMnemonicKeyring(type, value);
  return keyring.passphrase;
};

export const checkPassphraseBelongToMnemonic = async (
  type: 'address' | 'publickey',
  value: string,
  passphrase: string,
) => {
  const keyring = await getMnemonicKeyring(type, value);
  const result = keyring.checkPassphrase(passphrase);
  if (result) {
    keyring.setPassphrase(passphrase);
  }
  return result;
};

export const getMnemonicAddressInfo = async (address: string) => {
  const keyring = _getMnemonicKeyringByAddress(address);
  if (!keyring) {
    throw new Error(t('background.error.notFoundKeyringByAddress'));
  }
  return await keyring.getInfoByAddress(address);
};

export const generateKeyringWithMnemonic = async (
  mnemonic: string,
  passphrase?: string,
  byImport = false,
) => {
  // keep passphrase is empty string if not set
  passphrase = passphrase || '';

  if (!HdKeyring.validateMnemonic(mnemonic)) {
    throw new Error(t('background.error.invalidMnemonic'));
  }
  // If import twice use same keyring
  let keyring = getKeyringByMnemonic(mnemonic, passphrase);
  const result = {
    keyringId: null as number | null,
    isExistedKR: false,
  };
  if (!keyring) {
    const Keyring = keyringService.getKeyringClassForType(
      KEYRING_CLASS.MNEMONIC,
    ) as any;

    keyring = new Keyring({ mnemonic, passphrase });
    if (byImport) {
      (keyring as any).byImport = true;
    }
    keyringService.updateHdKeyringIndex(keyring as any);
    result.keyringId = addKeyringToStash(keyring);
    keyringService.addKeyring(keyring as any);
  } else {
    result.isExistedKR = true;
    result.keyringId = updateKeyringInStash(keyring);
  }

  return result;
};

export const slip39DecodeMnemonics = (secretShares: string[]) => {
  return HdKeyring.slip39DecodeMnemonics(secretShares);
};

export const slip39DecodeMnemonic = (secretShare: string) => {
  return HdKeyring.slip39DecodeMnemonic(secretShare);
};

export const checkHasMnemonic = () => {
  try {
    const keyring = _getKeyringByType(
      KEYRING_CLASS.MNEMONIC,
    ) as unknown as HdKeyring;
    return !!keyring.mnemonic;
  } catch (e) {
    return false;
  }
};

export const requestHDKeyringByMnemonics = (
  mnemonics: string,
  methodName: string,
  passphrase: string,
  ...params: any[]
) => {
  const keyring = getKeyringByMnemonic(mnemonics, passphrase);
  if (!keyring) {
    throw new Error('failed to requestHDKeyringByMnemonics, no keyring found.');
  }
  if (keyring[methodName]) {
    return keyring[methodName].call(keyring, ...params);
  }
};

export const addKeyringAndactiveAndPersistAccounts = async (
  mnemonic: string,
  passphrase: string,
  accountsToImport: Pick<Account, 'address' | 'aliasName' | 'index'>[],
  addAlias: boolean,
) => {
  try {
    const Keyring = keyringService.getKeyringClassForType(
      KEYRING_CLASS.MNEMONIC,
    );

    const keyring = new Keyring({ mnemonic, passphrase });

    keyringService.updateHdKeyringIndex(keyring);
    keyringService.addKeyring(keyring);

    await keyring.activeAccounts?.(accountsToImport.map(acc => acc.index! - 1));

    const detail = keyring.getInfoByAddress(accountsToImport[0].address);
    if (detail?.basePublicKey) {
      hdKeyringService.addUnixRecord(detail.basePublicKey);
    }

    await keyringService.persistAllKeyrings();

    const _account = {
      address: accountsToImport[0].address,
      type: keyring.type,
      brandName: keyring.type,
    };
    if (addAlias) {
      accountsToImport.forEach(({ address, aliasName }) => {
        const curAccount = {
          address,
          type: keyring.type as KeyringTypeName,
          brandName: keyring.type,
        };
        onSetAddressAlias(undefined, curAccount, contactService);
      });
    }
    preferenceService.setCurrentAccount(_account as any);
  } catch (e) {
    console.error('addKeyringAndactiveAndPersistAccounts error', e);
  }
};

export const activeAndPersistAccountsByMnemonics = async (
  mnemonics: string,
  passphrase: string,
  accountsToImport: Required<Pick<Account, 'address'>>[],
  addDefaultAlias = false,
) => {
  const keyring = getKeyringByMnemonic(mnemonics, passphrase);

  if (!keyring) {
    throw new Error('[activeAndPersistAccountsByMnemonics] no keyring found.');
  }

  const accounts: string[] = [...(await (keyring as any).getAccounts())];

  const currentLength = accounts.length;

  // await requestHDKeyringByMnemonics(
  //   mnemonics,
  //   'activeAccounts',
  //   passphrase,
  //   accountsToImport.map(acc => (acc as any).index! - 1),
  // );

  keyring.activeAccounts(accountsToImport.map(acc => (acc as any).index! - 1));

  // accountEvents.emit('ACCOUNT_ADDED', {
  //   accounts: accountsToImport.map(acc => ({
  //     address: acc.address,
  //     type: keyring.type as KeyringTypeName,
  //     brandName: keyring.type,
  //   })),
  //   scene: 'memonics',
  // });

  const detail = keyring.getInfoByAddress(accountsToImport[0].address);
  if (detail?.basePublicKey) {
    hdKeyringService.addUnixRecord(detail.basePublicKey);
  }

  await keyringService.persistAllKeyrings();

  const _account = {
    address: accountsToImport[0].address,
    type: keyring.type,
    brandName: keyring.type,
  };
  if (addDefaultAlias) {
    accountsToImport.forEach(({ address }) => {
      const curAccount = {
        address,
        type: keyring.type as KeyringTypeName,
        brandName: keyring.type,
      };
      onSetAddressAlias(undefined, curAccount, contactService);
    });
  }
  preferenceService.setCurrentAccount(_account as any);
};

export const getKeyringAccountsByAddress = async (address: string) => {
  const keyring = _getMnemonicKeyringByAddress(address);
  if (!keyring) {
    throw new Error(t('background.error.notFoundKeyringByAddress'));
  }
  return await keyring.getAccounts();
};

// TODO: if address is existed, return keyringId
export const addMnemonicKeyringAndGotoSuccessScreen = async (
  input: string | string[],
  passphrase = '',
) => {
  const arr = Array.isArray(input) ? input : [input];
  const addresses: string[] = [];
  const currentAddressInfo = {
    keyringId: null,
    isExistedKR: false,
  } as {
    keyringId: number | null;
    isExistedKR: boolean;
  };

  for (let i = 0; i < arr.length; i++) {
    const mnemonics = arr[i];
    const { keyringId, isExistedKR } = await generateKeyringWithMnemonic(
      mnemonics,
      passphrase,
    );

    const firstAddress = await requestKeyring(
      KEYRING_TYPE.HdKeyring,
      'getAddresses',
      keyringId ?? null,
      0,
      1,
    );

    addresses.push(firstAddress[0].address);
    currentAddressInfo.keyringId = keyringId;
    currentAddressInfo.isExistedKR = isExistedKR;

    await new Promise(resolve => setTimeout(resolve, 1));
    await activeAndPersistAccountsByMnemonics(
      mnemonics,
      passphrase,
      firstAddress as any,
      true,
    );
  }

  keyringService.removePreMnemonics();

  if (addresses.length === 1) {
    return navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.ImportSuccess,
      params: {
        type: KEYRING_TYPE.HdKeyring,
        brandName: KEYRING_CLASS.MNEMONIC,
        isFirstImport: true,
        address: addresses,
        mnemonics: arr[0],
        passphrase,
        keyringId: currentAddressInfo.keyringId || undefined,
        isExistedKR: currentAddressInfo.isExistedKR,
      },
    });
  }

  return navigateDeprecated(RootNames.StackAddress, {
    screen: RootNames.ImportSuccess,
    params: {
      type: KEYRING_TYPE.HdKeyring,
      brandName: KEYRING_CLASS.MNEMONIC,
      isFirstImport: false,
      address: addresses,
    },
  });
};

// TODO: if address is existed, return keyringId
export const addMnemonicKeyringAndGotoSuccessScreen2024 = async (
  input: string | string[],
  passphrase = '',
) => {
  const arr = Array.isArray(input) ? input : [input];
  const addresses: string[] = [];
  const currentAddressInfo = {
    keyringId: null,
    isExistedKR: false,
  } as {
    keyringId: number | null;
    isExistedKR: boolean;
  };

  for (let i = 0; i < arr.length; i++) {
    const mnemonics = arr[i];
    const { keyringId, isExistedKR } = await generateKeyringWithMnemonic(
      mnemonics,
      passphrase,
    );

    const firstAddress = await requestKeyring(
      KEYRING_TYPE.HdKeyring,
      'getAddresses',
      keyringId ?? null,
      0,
      1,
    );

    addresses.push(firstAddress[0].address);
    currentAddressInfo.keyringId = keyringId;
    currentAddressInfo.isExistedKR = isExistedKR;

    await new Promise(resolve => setTimeout(resolve, 1));
    await activeAndPersistAccountsByMnemonics(
      mnemonics,
      passphrase,
      firstAddress as any,
      true,
    );
  }

  keyringService.removePreMnemonics();

  if (addresses.length === 1) {
    return replaceToFirst(RootNames.StackAddress, {
      screen: RootNames.ImportSuccess2024,
      params: {
        type: KEYRING_TYPE.HdKeyring,
        brandName: KEYRING_CLASS.MNEMONIC,
        isFirstImport: true,
        address: addresses,
        mnemonics: arr[0],
        passphrase,
        keyringId: currentAddressInfo.keyringId || undefined,
        isExistedKR: currentAddressInfo.isExistedKR,
      },
    });
  }

  return replaceToFirst(RootNames.StackAddress, {
    screen: RootNames.ImportSuccess2024,
    params: {
      type: KEYRING_TYPE.HdKeyring,
      brandName: KEYRING_CLASS.MNEMONIC,
      isFirstImport: false,
      address: addresses,
    },
  });
};
