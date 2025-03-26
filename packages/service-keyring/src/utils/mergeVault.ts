import { addressUtils } from '@rabby-wallet/base-utils';
import {
  KEYRING_CLASS,
  KEYRING_TYPE,
  type KeyringSerializedData,
} from '@rabby-wallet/keyring-utils';
import { deepmergeCustom } from 'deepmerge-ts';

const isUniqKeyringType = (keyringtype: KEYRING_TYPE) =>
  [KEYRING_CLASS.PRIVATE_KEY, KEYRING_CLASS.MNEMONIC].includes(keyringtype);

export const mergeVault = (
  origin: KeyringSerializedData[],
  merge: KeyringSerializedData[],
) => {
  const newData = [...origin];
  const customDeepmerge = deepmergeCustom({
    mergeArrays: (values, utils, meta) => {
      const isStringOrNumberArray = values.every(
        arr =>
          Array.isArray(arr) &&
          arr.every(
            item => typeof item === 'string' || typeof item === 'number',
          ),
      );

      if (isStringOrNumberArray) {
        const flatArray = values.flat();

        if (meta?.key === 'accounts') {
          const newArr: (string | number)[] = [];
          flatArray.forEach(item => {
            if (
              typeof item === 'string' &&
              newArr.some(
                e =>
                  typeof e === 'string' && addressUtils.isSameAddress(e, item),
              )
            ) {
              return;
            }
            newArr.push(item);
          });
          return newArr;
        }
        return Array.from(new Set(flatArray));
      }

      return utils.defaultMergeFunctions.mergeArrays(values);
    },
  });
  merge.forEach(item => {
    const isUniq = isUniqKeyringType(item.type);
    if (isUniq) {
      if (item.type === KEYRING_TYPE.SimpleKeyring) {
        const exist = newData.some(e => {
          if (e.type === item.type) {
            return (
              Boolean(e?.data?.[0]) &&
              Boolean(item?.data?.[0]) &&
              e.data?.[0] === item.data?.[0]
            );
          }
          return false;
        });
        if (!exist) {
          newData.push(item);
        }
      }
      if (item.type === KEYRING_TYPE.HdKeyring) {
        const isSameHdKeyring = (
          hd1: KeyringSerializedData,
          hd2: KeyringSerializedData,
        ) => {
          if (
            hd1.type === KEYRING_TYPE.HdKeyring &&
            hd2.type === KEYRING_TYPE.HdKeyring
          ) {
            return Object.keys(hd2.data)
              .filter(
                key =>
                  !['accountDetails', 'accounts', 'activeIndexes'].includes(
                    key,
                  ),
              )
              .every(key => hd1?.data?.[key] === hd2?.data?.[key]);
          }
          return false;
        };
        const targetIdx = newData.findIndex(old => isSameHdKeyring(old, item));
        if (targetIdx > -1 && newData[targetIdx]) {
          newData[targetIdx] = customDeepmerge(newData[targetIdx], item);
        } else {
          newData.push(item);
        }
      }
    } else {
      const targetIdx = newData.findIndex(old => old.type === item.type);
      if (targetIdx > -1) {
        newData[targetIdx] = customDeepmerge(newData[targetIdx], item);
      } else {
        newData.push(item);
      }
    }
  });

  return newData;
};
