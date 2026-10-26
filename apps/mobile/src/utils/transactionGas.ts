import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

type TxWithAuthorizationList = Tx & {
  authorizationList?: unknown;
};

export const convert1559ToLegacy = (tx: Tx) => {
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

/**
 * Applies the selected gas price without losing typed-transaction fields.
 *
 * Most legacy transactions should keep the existing whitelist conversion.
 * Tempo transactions preserve their extra signed fields (such as `calls`) and
 * use the canonical Tempo type before the EIP-1559 fee fields overwrite the
 * legacy gas price.
 */
export const applySelectedGasToTx = <T extends Tx>({
  tx,
  gasPrice,
  support1559,
  enable7702,
  isTempoTransaction = false,
}: {
  tx: T;
  gasPrice: string;
  support1559: boolean;
  enable7702?: boolean;
  isTempoTransaction?: boolean;
}): T => {
  if (!support1559) {
    return {
      ...tx,
      ...(isTempoTransaction ? { type: '0x76' } : {}),
      gasPrice,
    };
  }

  const nextTx = {
    ...(isTempoTransaction ? tx : {}),
    ...convertLegacyTo1559({
      ...tx,
      gasPrice,
    }),
    ...(isTempoTransaction ? { type: '0x76' } : {}),
    authorizationList: (tx as TxWithAuthorizationList).authorizationList,
  } as T & TxWithAuthorizationList;

  delete nextTx.gasPrice;
  if (!enable7702) {
    delete nextTx.authorizationList;
  }

  return nextTx;
};
