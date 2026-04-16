import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { isHexString } from 'ethereumjs-util';

import { CHAINS_ENUM } from '@/constant/chains';
import { findChain } from '@/utils/chain';

export const is1559Tx = (tx: Tx) => {
  if (!('maxFeePerGas' in tx) || !('maxPriorityFeePerGas' in tx)) {
    return false;
  }

  return (
    isHexString(tx.maxFeePerGas || '') &&
    isHexString(tx.maxPriorityFeePerGas || '')
  );
};

export const is7702Tx = (tx?: { authorizationList?: unknown } | null) => {
  return (
    Array.isArray(tx?.authorizationList) && tx.authorizationList.length > 0
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
} as const;

export const validateGasPriceRange = (tx: Tx) => {
  const chain = findChain({
    id: tx.chainId,
  });
  if (!chain) {
    return true;
  }

  const range = GASPRICE_RANGE[chain.enum as keyof typeof GASPRICE_RANGE];
  if (!range) {
    return true;
  }

  const [min, max] = range;
  const gasPriceGwei = Number(tx.gasPrice || tx.maxFeePerGas) / 1e9;
  if (gasPriceGwei < min) {
    throw new Error('GasPrice too low');
  }
  if (gasPriceGwei > max) {
    throw new Error('GasPrice too high');
  }

  return true;
};
