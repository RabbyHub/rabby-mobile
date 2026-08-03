import { addressUtils } from '@rabby-wallet/base-utils';
import { isValidAddress, isValidChecksumAddress } from 'ethereumjs-util';

const KEYSTONE_KEEP_KEYS = ['paths', 'indexes'];

const isAddress = (value: unknown): value is string => {
  if (typeof value !== 'string' || !isValidAddress(value)) {
    return false;
  }

  const address = value.slice(2);
  return address === address.toLowerCase() || isValidChecksumAddress(value);
};

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

/**
 * Mirrors Rabby extension's account-scoped keyring serialization filter.
 * The serialized object is mutated in place, matching keyring serialization
 * behavior in the extension.
 * @param data - Serialized keyring data.
 * @param addresses - Addresses selected from this keyring.
 * @returns The filtered serialized keyring data.
 */
export const filterKeyringData = (
  data: string[] | Record<string, any>,
  addresses: string[],
) => {
  if (Array.isArray(data)) {
    return data;
  }

  Object.keys(data).forEach(key => {
    const value = data[key];

    if (Array.isArray(value)) {
      if (isAddress(value[0])) {
        data[key] = value.filter(item =>
          addresses.some(address => addressUtils.isSameAddress(item, address)),
        );
      }
      return;
    }

    if (!isObject(value)) {
      return;
    }

    const subKeys = Object.keys(value);
    const isKeystonePubkey =
      data.keyringMode === 'pubkey' && data.name === 'Keystone';
    const shouldSkipAddressFiltering =
      isKeystonePubkey && KEYSTONE_KEEP_KEYS.includes(key);

    if (
      !shouldSkipAddressFiltering &&
      subKeys.length > 0 &&
      isAddress(subKeys[0])
    ) {
      data[key] = subKeys.reduce<Record<string, any>>((result, subKey) => {
        if (
          addresses.some(address => addressUtils.isSameAddress(subKey, address))
        ) {
          result[subKey] = value[subKey];
        }
        return result;
      }, {});
    }
  });

  return data;
};
