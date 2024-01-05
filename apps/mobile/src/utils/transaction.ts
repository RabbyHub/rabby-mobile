import { CHAINS_ENUM } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import type { GasLevel, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { isHexString } from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
import { minBy } from 'lodash';
import { KEYRING_CATEGORY_MAP } from '@rabby-wallet/keyring-utils';

export const is1559Tx = (tx: Tx) => {
  if (!('maxFeePerGas' in tx) || !('maxPriorityFeePerGas' in tx)) {
    return false;
  }
  return (
    isHexString(tx.maxFeePerGas || '') &&
    isHexString(tx.maxPriorityFeePerGas || '')
  );
};
export const GASPRICE_RANGE = {
  [CHAINS_ENUM.ETH]: [0, 20000],
  [CHAINS_ENUM.BOBA]: [0, 20000],
  [CHAINS_ENUM.OP]: [0, 20000],
  [CHAINS_ENUM.BASE]: [0, 20000],
  [CHAINS_ENUM.ZORA]: [0, 20000],
  [CHAINS_ENUM.ERA]: [0, 20000],
  [CHAINS_ENUM.KAVA]: [0, 20000],
  [CHAINS_ENUM.ARBITRUM]: [0, 20000],
  [CHAINS_ENUM.AURORA]: [0, 20000],
  [CHAINS_ENUM.BSC]: [0, 20000],
  [CHAINS_ENUM.AVAX]: [0, 40000],
  [CHAINS_ENUM.POLYGON]: [0, 100000],
  [CHAINS_ENUM.FTM]: [0, 100000],
  [CHAINS_ENUM.GNOSIS]: [0, 500000],
  [CHAINS_ENUM.OKT]: [0, 50000],
  [CHAINS_ENUM.HECO]: [0, 100000],
  [CHAINS_ENUM.CELO]: [0, 100000],
  [CHAINS_ENUM.MOVR]: [0, 50000],
  [CHAINS_ENUM.CRO]: [0, 500000],
  [CHAINS_ENUM.BTT]: [0, 20000000000],
  [CHAINS_ENUM.METIS]: [0, 50000],
};
export const validateGasPriceRange = (tx: Tx) => {
  const chain = Object.values(CHAINS).find(c => c.id === tx.chainId);
  if (!chain) {
    return true;
  }
  const range = (GASPRICE_RANGE as any)[chain.enum];
  if (!range) {
    return true;
  }
  const [min, max] = range;
  if (Number((tx as Tx).gasPrice || tx.maxFeePerGas) / 1e9 < min) {
    throw new Error('GasPrice too low');
  }
  if (Number((tx as Tx).gasPrice || tx.maxFeePerGas) / 1e9 > max) {
    throw new Error('GasPrice too high');
  }
  return true;
};

export const convert1559ToLegacy = tx => {
  return {
    chainId: tx.chainId,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    data: tx.data,
    gas: tx.gas,
    gasPrice: tx.maxFeePerGas,
    nonce: tx.nonce,
  };
};

export const convertLegacyTo1559 = (tx: Tx) => {
  return {
    chainId: tx.chainId,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    data: tx.data,
    gas: tx.gas,
    maxFeePerGas: tx.gasPrice,
    maxPriorityFeePerGas: tx.gasPrice,
    nonce: tx.nonce,
  };
};

export function getKRCategoryByType(type?: string) {
  return KEYRING_CATEGORY_MAP[type as any] || null;
}

export const calcMaxPriorityFee = (
  gasList: GasLevel[],
  target: GasLevel,
  chainId: number,
  useMaxFee: boolean,
) => {
  if (chainId !== 1 || useMaxFee) {
    return target.price;
  }
  if (target.priority_price && target.priority_price !== null) {
    return target.priority_price;
  }
  // only enable auto-priorityFee for ETH currently
  const min = minBy(
    gasList.filter(item => item.level !== 'custom'),
    'price',
  );
  if (min) {
    if (target.price < min.price) return target.price / 10;
    const basePriorityFee = target.price / 10;
    if (min.level === target.level) {
      return basePriorityFee;
    } else {
      const gap = target.price - min.price;
      const value = new BigNumber(gap)
        .times(0.8)
        .plus(basePriorityFee)
        .toFixed(1);
      return Number(value);
    }
  } else {
    return target.price;
  }
};

export function makeTransactionId(
  fromAddr: string,
  nonce: number | string,
  chainEnum: string,
) {
  if (typeof nonce === 'number') {
    nonce = `0x${nonce.toString(16)}`;
  } else if (typeof nonce === 'string') {
    nonce = nonce.startsWith('0x') ? nonce : `0x${nonce}`;
  }
  return `${fromAddr}_${nonce}_${chainEnum}`;
}
