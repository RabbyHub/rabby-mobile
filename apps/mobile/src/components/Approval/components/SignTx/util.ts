import * as Sentry from '@sentry/react-native';
import { intToHex } from '@/utils/number';
import { addHexPrefix, isHexPrefixed } from 'ethereumjs-util';
import { stringUtils } from '@rabby-wallet/base-utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { keyringService } from '@/core/services';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

const { isStringOrNumber } = stringUtils;

export const normalizeHex = (value: string | number) => {
  if (typeof value === 'number') {
    return intToHex(Math.floor(value));
  }
  if (typeof value === 'string') {
    if (!isHexPrefixed(value)) {
      return addHexPrefix(value);
    }
    return value;
  }
  return value;
};

export const normalizeTxParams = tx => {
  const copy = tx;
  try {
    if ('nonce' in copy && isStringOrNumber(copy.nonce)) {
      copy.nonce = normalizeHex(copy.nonce);
    }
    if ('gas' in copy && isStringOrNumber(copy.gas)) {
      copy.gas = normalizeHex(copy.gas);
    }
    if ('gasLimit' in copy && isStringOrNumber(copy.gasLimit)) {
      copy.gas = normalizeHex(copy.gasLimit);
    }
    if ('gasPrice' in copy && isStringOrNumber(copy.gasPrice)) {
      copy.gasPrice = normalizeHex(copy.gasPrice);
    }
    if ('maxFeePerGas' in copy && isStringOrNumber(copy.maxFeePerGas)) {
      copy.maxFeePerGas = normalizeHex(copy.maxFeePerGas);
    }
    if (
      'maxPriorityFeePerGas' in copy &&
      isStringOrNumber(copy.maxPriorityFeePerGas)
    ) {
      copy.maxPriorityFeePerGas = normalizeHex(copy.maxPriorityFeePerGas);
    }
    if ('value' in copy) {
      if (!isStringOrNumber(copy.value)) {
        copy.value = '0x0';
      } else {
        copy.value = normalizeHex(copy.value);
      }
    }
    if ('data' in copy) {
      if (!tx.data.startsWith('0x')) {
        copy.data = `0x${tx.data}`;
      }
    }

    if ('authorizationList' in copy) {
      copy.authorizationList = copy.authorizationList.map(item => {
        return normalizeHex(item);
      });
    }
  } catch (e) {
    Sentry.captureException(
      new Error(`normalizeTxParams failed, ${JSON.stringify(e)}`),
    );
    console.error(`normalizeTxParams failed, ${JSON.stringify(e)}`);
  }
  return copy;
};

export const toType = async (toAddress: string, hasCex?: boolean) => {
  if (hasCex) {
    return 'Exchange';
  }
  try {
    const toAddr = toAddress.toLowerCase();
    const existAccountType = (await keyringService.getAllAddresses())?.find(
      item => isSameAddress(item.address, toAddr),
    )?.type;
    if (!existAccountType) {
      return 'Unknown';
    }
    if (existAccountType === KEYRING_CLASS.MNEMONIC) {
      return 'SeedPhrase';
    }
    if (existAccountType === KEYRING_CLASS.PRIVATE_KEY) {
      return 'PrivateKey';
    }
    if (
      Object.values(KEYRING_CLASS.HARDWARE).includes(
        existAccountType as KEYRING_TYPE,
      )
    ) {
      return 'Hardware';
    }
  } catch (error) {
    console.error(error);
  }
  return 'Unknown';
};
