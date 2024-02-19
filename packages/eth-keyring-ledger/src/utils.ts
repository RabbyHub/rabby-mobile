import { isHexString } from 'ethereumjs-util';

export const wait = (fn: () => void, ms = 1000) => {
  return new Promise(resolve => {
    setTimeout(() => {
      fn();
      resolve(true);
    }, ms);
  });
};

export type Tx = {
  chainId: number;
  data: string;
  from: string;
  gas?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
  nonce: string;
  to: string;
  value: string;
  r?: string;
  s?: string;
  v?: string;
};

export const is1559Tx = (tx: Tx) => {
  if (!('maxFeePerGas' in tx) || !('maxPriorityFeePerGas' in tx)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return isHexString(tx.maxFeePerGas!) && isHexString(tx.maxPriorityFeePerGas!);
};

export enum LedgerHDPathType {
  LedgerLive = 'LedgerLive',
  Legacy = 'Legacy',
  BIP44 = 'BIP44',
}
