import { getRecommendNonce } from '@/core/apis/recommendNonce';
import type { Account } from '@/types/account';
import { findChainByServerID } from '@/utils/chain';
import type { TxWithTempoExtras } from '@/utils/tempo';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

export type GasAccountTopUpResult =
  | {
      type: 'token';
      ownerAddress: string;
      chainServerId: string;
    }
  | {
      type: 'pay';
    };

export type GasAccountTopUpWaitCallback = (
  result: GasAccountTopUpResult,
) => Promise<void> | void;

export const shouldUpdateOriginalTxNonceAfterTopUp = ({
  originalAccountAddress,
  originalChainServerId,
  topUpResult,
}: {
  originalAccountAddress: string;
  originalChainServerId: string;
  topUpResult: GasAccountTopUpResult;
}) => {
  if (topUpResult.type !== 'token') {
    return false;
  }

  return (
    topUpResult.chainServerId === originalChainServerId &&
    isSameAddress(topUpResult.ownerAddress, originalAccountAddress)
  );
};

const parseNonce = (nonce: string) => {
  if (nonce.startsWith('0x')) {
    return new BigNumber(nonce.slice(2), 16);
  }

  return new BigNumber(nonce);
};

const incrementNonce = (nonce: string, step = 1) =>
  `0x${parseNonce(nonce).plus(step).toString(16)}`;

const getTxNonceKey = (tx?: Tx) =>
  (tx as TxWithTempoExtras<Tx> | undefined)?.nonceKey as
    | string
    | number
    | bigint
    | undefined;

export const getTopUpResumedNonce = async ({
  tx,
  originalAccount,
  originalChainServerId,
  topUpResult,
}: {
  tx?: Tx;
  originalAccount: Account;
  originalChainServerId: string;
  topUpResult: GasAccountTopUpResult;
}) => {
  if (
    !shouldUpdateOriginalTxNonceAfterTopUp({
      originalAccountAddress: originalAccount.address,
      originalChainServerId,
      topUpResult,
    })
  ) {
    return undefined;
  }

  const chainId = findChainByServerID(originalChainServerId)?.id;
  if (!chainId) {
    return undefined;
  }

  return getRecommendNonce({
    from: originalAccount.address,
    chainId,
    account: originalAccount,
    nonceKey: getTxNonceKey(tx),
  });
};

export const getBumpedNonceAfterTopUp = async ({
  currentNonce,
  tx,
  originalAccount,
  originalChainServerId,
  topUpResult,
}: {
  currentNonce?: string;
  tx?: Tx;
  originalAccount: Account;
  originalChainServerId: string;
  topUpResult: GasAccountTopUpResult;
}) => {
  const resumedNonce = await getTopUpResumedNonce({
    tx,
    originalAccount,
    originalChainServerId,
    topUpResult,
  });

  return resumedNonce ?? currentNonce;
};

export const buildTopUpResumedTxs = async ({
  txs,
  originalAccount,
  originalChainServerId,
  topUpResult,
}: {
  txs: Tx[];
  originalAccount: Account;
  originalChainServerId: string;
  topUpResult: GasAccountTopUpResult;
}) => {
  if (!txs.length) {
    return txs;
  }

  const resumedNonce = await getTopUpResumedNonce({
    tx: txs[0],
    originalAccount,
    originalChainServerId,
    topUpResult,
  });

  if (!resumedNonce) {
    return txs;
  }

  return txs.map((tx, index) => {
    return {
      ...tx,
      nonce: incrementNonce(resumedNonce, index),
    };
  });
};
