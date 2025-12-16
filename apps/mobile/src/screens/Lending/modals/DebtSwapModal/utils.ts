import BigNumber from 'bignumber.js';
import {
  constants,
  BigNumber as EthersBigNumber,
  PopulatedTransaction,
} from 'ethers';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';

export const sliderHapticTriggerNumbers = [0, 50, 100];
export const DEFAULT_DEBT_SWAP_SLIPPAGE = 200; // 2%
export const ZERO_PERMIT = {
  value: '0',
  deadline: '0',
  v: 0,
  r: constants.HashZero,
  s: constants.HashZero,
};
export const maxInputAmountWithSlippage = (
  amount: string,
  slippageBps: number,
) => {
  const amt = new BigNumber(amount || 0);
  if (amt.lte(0)) {
    return '0';
  }
  return amt
    .multipliedBy(new BigNumber(1).plus(new BigNumber(slippageBps).div(10000)))
    .integerValue(BigNumber.ROUND_CEIL)
    .toFixed(0);
};

export const formatTx = (
  tx: PopulatedTransaction,
  fromAddr: string,
  chainId: number,
) => {
  if (tx.data) {
    const formattedTx = {
      from: tx.from || fromAddr,
      to: tx.to,
      data: tx.data || '0x',
      value:
        tx.value && EthersBigNumber.isBigNumber(tx.value)
          ? tx.value.toHexString()
          : tx.value ?? '0x0',
      chainId,
    };
    if (tx.nonce) {
      (formattedTx as any).nonce = tx.nonce;
    }
    return formattedTx as Tx;
  }
  return null;
};
