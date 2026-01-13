import * as ethUtil from 'ethereumjs-util';
import { keyringService } from '../services';
import { t } from 'i18next';
import { _setCurrentAccountFromKeyring } from './keyring';
import { throwErrorIfInvalidPwd } from './lock';
import { accountEvents } from './account';

export const getPrivateKey = async (
  password: string,
  { address, type }: { address: string; type: string },
) => {
  await throwErrorIfInvalidPwd(password);
  const keyring = await keyringService.getKeyringForAccount(address, type);
  if (!keyring) {
    return null;
  }
  return await keyring.exportAccount(address);
};

export const importPrivateKey = async data => {
  const privateKey = ethUtil.stripHexPrefix(data);
  const cleanedPrivateKey = privateKey
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .trim();

  const buffer = Buffer.from(cleanedPrivateKey, 'hex');

  const error = new Error(t('background.error.invalidPrivateKey'));
  try {
    if (!ethUtil.isValidPrivate(buffer)) {
      throw error;
    }
  } catch {
    throw error;
  }

  const keyring = await keyringService.importPrivateKey(cleanedPrivateKey);
  const accounts = await _setCurrentAccountFromKeyring(keyring);

  // accountEvents.emit('ACCOUNT_ADDED', {
  //   accounts,
  //   scene: 'privateKey',
  // });

  return accounts;
};
