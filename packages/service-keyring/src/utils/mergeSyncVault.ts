import { addressUtils } from '@rabby-wallet/base-utils';
import {
  KEYRING_CLASS,
  KEYRING_TYPE,
  type KeyringSerializedData,
} from '@rabby-wallet/keyring-utils';

const isPlainObject = (value: unknown): value is Record<string, any> => {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.keys(value).reduce<Record<string, unknown>>((result, key) => {
      result[key] = cloneValue(value[key]);
      return result;
    }, {}) as T;
  }

  return value;
};

const mergePrimitiveArrays = (
  current: (string | number)[],
  incoming: (string | number)[],
  key?: string,
) => {
  const result: (string | number)[] = [];

  [...current, ...incoming].forEach(item => {
    const exists = result.some(existing => {
      if (
        key === 'accounts' &&
        typeof existing === 'string' &&
        typeof item === 'string'
      ) {
        return addressUtils.isSameAddress(existing, item);
      }

      return existing === item;
    });

    if (!exists) {
      result.push(item);
    }
  });

  return result;
};

const mergeValue = (current: any, incoming: any, key?: string): any => {
  if (typeof current === 'undefined') {
    return cloneValue(incoming);
  }

  if (typeof incoming === 'undefined') {
    return cloneValue(current);
  }

  if (Array.isArray(current) && Array.isArray(incoming)) {
    const containsOnlyPrimitives = [...current, ...incoming].every(
      item => typeof item === 'string' || typeof item === 'number',
    );

    if (containsOnlyPrimitives) {
      return mergePrimitiveArrays(current, incoming, key);
    }

    return [...cloneValue(current), ...cloneValue(incoming)];
  }

  if (isPlainObject(current) && isPlainObject(incoming)) {
    const result = cloneValue(current) as Record<string, any>;

    Object.keys(incoming).forEach(childKey => {
      result[childKey] = mergeValue(
        result[childKey],
        incoming[childKey],
        childKey,
      );
    });

    return result;
  }

  return cloneValue(incoming);
};

const isUniqueKeyringType = (type: string) =>
  [KEYRING_CLASS.PRIVATE_KEY, KEYRING_CLASS.MNEMONIC].includes(type as any);

const isSameMnemonicKeyring = (
  current: KeyringSerializedData,
  incoming: KeyringSerializedData,
) => {
  if (
    current.type !== KEYRING_TYPE.HdKeyring ||
    incoming.type !== KEYRING_TYPE.HdKeyring
  ) {
    return false;
  }

  return Object.keys(incoming.data)
    .filter(
      key => !['accountDetails', 'accounts', 'activeIndexes'].includes(key),
    )
    .every(key => current.data?.[key] === incoming.data?.[key]);
};

/**
 * Merge imported sync keyrings without replacing keyrings that already exist.
 * Private-key and mnemonic keyrings have independent identities; other sync
 * keyring types are represented by one aggregate keyring.
 * @param currentVault - Serialized keyrings already in the wallet.
 * @param incomingVault - Serialized keyrings from the transfer payload.
 * @returns A cloned, merged vault.
 */
export const mergeSyncVault = (
  currentVault: KeyringSerializedData[],
  incomingVault: KeyringSerializedData[],
) => {
  const result = cloneValue(currentVault);

  incomingVault.forEach(incoming => {
    if (isUniqueKeyringType(incoming.type)) {
      if (incoming.type === KEYRING_TYPE.SimpleKeyring) {
        (Array.isArray(incoming.data) ? incoming.data : []).forEach(
          privateKey => {
            const alreadyExists = result.some(
              current =>
                current.type === incoming.type &&
                Array.isArray(current.data) &&
                current.data.some(item => item === privateKey),
            );

            if (!alreadyExists) {
              result.push({
                ...cloneValue(incoming),
                data: [cloneValue(privateKey)],
              });
            }
          },
        );
        return;
      }

      const targetIndex = result.findIndex(current =>
        isSameMnemonicKeyring(current, incoming),
      );

      if (targetIndex >= 0) {
        result[targetIndex] = mergeValue(result[targetIndex], incoming);
      } else {
        result.push(cloneValue(incoming));
      }
      return;
    }

    const targetIndex = result.findIndex(
      current => current.type === incoming.type,
    );

    if (targetIndex >= 0) {
      result[targetIndex] = mergeValue(result[targetIndex], incoming);
    } else {
      result.push(cloneValue(incoming));
    }
  });

  return result;
};
