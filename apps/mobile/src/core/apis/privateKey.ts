import * as ethUtil from 'ethereumjs-util';
import { keyringService } from '../services';
import { t } from 'i18next';
import { _setCurrentAccountFromKeyring } from './keyring';
import { throwErrorIfInvalidPwd } from './lock';
import { accountEvents } from './account';

/**
 * Validates and cleans a private key string.
 * Strips hex prefix, removes whitespace/newlines, and validates the key format.
 * @param privateKey - The raw private key string (with or without 0x prefix)
 * @returns The cleaned private key string
 * @throws Error if the private key is invalid
 */
export function validateAndCleanPrivateKey(privateKey: string): string {
  const privateKeyPrefix = ethUtil.stripHexPrefix(privateKey);
  const cleanedPrivateKey = privateKeyPrefix
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .trim();

  const buffer = Buffer.from(cleanedPrivateKey, 'hex');

  if (!ethUtil.isValidPrivate(buffer)) {
    throw new Error(t('background.error.invalidPrivateKey'));
  }

  return cleanedPrivateKey;
}

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

export const importPrivateKey = async (data: string) => {
  const cleanedPrivateKey = validateAndCleanPrivateKey(data);

  const keyring = await keyringService.importPrivateKey(cleanedPrivateKey);
  const accounts = await _setCurrentAccountFromKeyring(keyring);

  // accountEvents.emit('ACCOUNT_ADDED', {
  //   accounts,
  //   scene: 'privateKey',
  // });

  return accounts;
};
