import BigNumber from 'bignumber.js';

import { openapi } from '@/core/request';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

export const getRecommendGas = async ({
  gas,
  tx,
  gasUsed,
  preparedHistoryGasUsed,
}: {
  gasUsed: number;
  gas: number;
  tx: Tx;
  chainId: number;
  preparedHistoryGasUsed?:
    | ReturnType<typeof openapi.historyGasUsed>
    | Awaited<ReturnType<typeof openapi.historyGasUsed>>;
}) => {
  if (gas > 0) {
    return {
      needRatio: true,
      gas: new BigNumber(gas),
      gasUsed,
    };
  }
  const txGas = tx.gasLimit || tx.gas;
  if (txGas && new BigNumber(txGas).gt(0)) {
    return {
      needRatio: true,
      gas: new BigNumber(txGas),
      gasUsed: Number(txGas),
    };
  }
  try {
    let res: Awaited<ReturnType<typeof openapi.historyGasUsed>>;
    if (!preparedHistoryGasUsed) {
      res = await openapi.historyGasUsed({
        tx: {
          ...tx,
          nonce: tx.nonce || '0x1', // set a mock nonce for explain if dapp not set it
          data: tx.data,
          value: tx.value || '0x0',
          gas: tx.gas || '', // set gas limit if dapp not set
        },
        user_addr: tx.from,
      });
    } else {
      res = await preparedHistoryGasUsed;
    }
    if (res.gas_used > 0) {
      return {
        needRatio: true,
        gas: new BigNumber(res.gas_used),
        gasUsed: res.gas_used,
      };
    }
  } catch (e) {
    // NOTHING
  }

  return {
    needRatio: false,
    gas: new BigNumber(1000000),
    gasUsed: 1000000,
  };
};
