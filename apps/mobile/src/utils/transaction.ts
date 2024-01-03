import { CHAINS_ENUM } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { isHexString } from 'ethereumjs-util';
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
