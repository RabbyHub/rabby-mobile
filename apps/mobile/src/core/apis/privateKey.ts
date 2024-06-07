import * as ethUtil from 'ethereumjs-util';
import { keyringService } from '../services';
import { t } from 'i18next';
import { _setCurrentAccountFromKeyring } from './keyring';

export const getPrivateKey = async (
  password: string,
  { address, type }: { address: string; type: string },
) => {
  await keyringService.verifyPassword(password);
  const keyring = await keyringService.getKeyringForAccount(address, type);
  if (!keyring) {
    return null;
  }
  return await keyring.exportAccount(address);
};

export const importPrivateKey = async data => {
  const privateKey = ethUtil.stripHexPrefix(data);
  const buffer = Buffer.from(privateKey, 'hex');

  const error = new Error(t('background.error.invalidPrivateKey'));
  try {
    if (!ethUtil.isValidPrivate(buffer)) {
      throw error;
    }
  } catch {
    throw error;
  }

  const keyring = await keyringService.importPrivateKey(privateKey);
  return _setCurrentAccountFromKeyring(keyring);
};
