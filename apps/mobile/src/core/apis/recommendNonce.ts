import BigNumber from 'bignumber.js';
import { t } from 'i18next';
import { decodeFunctionResult, encodeFunctionData } from 'viem';
import { Abis as TempoAbis, Addresses as TempoAddresses } from 'viem/tempo';

import { transactionHistoryService } from '@/core/services';
import type { Account } from '@/types/account';
import { findChain } from '@/utils/chain';
import { isTempoChain } from '@/utils/tempoChain';
import { requestReadOnlyETHRpc } from './readOnlyRpc';

export const getRecommendNonce = async ({
  from,
  chainId,
  account,
  nonceKey,
}: {
  from: string;
  chainId: number;
  account: Account | null;
  nonceKey?: string | number | bigint;
}) => {
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error(t('background.error.invalidChainId'));
  }
  const normalizedNonceKey = (() => {
    if (!isTempoChain(chain.serverId)) {
      return undefined;
    }
    if (typeof nonceKey === 'undefined' || nonceKey === null) {
      return undefined;
    }
    if (typeof nonceKey === 'bigint') {
      return nonceKey > 0n ? nonceKey : undefined;
    }
    if (typeof nonceKey === 'number') {
      if (!Number.isFinite(nonceKey) || nonceKey <= 0) {
        return undefined;
      }
      return BigInt(Math.trunc(nonceKey));
    }
    if (typeof nonceKey === 'string') {
      const trimmed = nonceKey.trim();
      if (!trimmed || trimmed === '0x' || trimmed === '0X') {
        return undefined;
      }
      const value = BigInt(trimmed);
      return value > 0n ? value : undefined;
    }
    return undefined;
  })();

  if (typeof normalizedNonceKey !== 'undefined') {
    const data = encodeFunctionData({
      abi: TempoAbis.nonce,
      functionName: 'getNonce',
      args: [from as `0x${string}`, normalizedNonceKey],
    });
    const result = await requestReadOnlyETHRpc<string>(
      {
        method: 'eth_call',
        params: [
          {
            to: TempoAddresses.nonceManager,
            data,
          },
          'latest',
        ],
      },
      chain.serverId,
      account,
    );
    const onChainNonce = decodeFunctionResult({
      abi: TempoAbis.nonce,
      functionName: 'getNonce',
      data: result as `0x${string}`,
    }) as bigint;
    return `0x${onChainNonce.toString(16)}`;
  }

  const onChainNonce = await requestReadOnlyETHRpc(
    {
      method: 'eth_getTransactionCount',
      params: [from, 'latest'],
    },
    chain.serverId,
    account,
  );
  const localNonce =
    (await transactionHistoryService.getNonceByChain(from, chainId)) || 0;
  return `0x${BigNumber.max(onChainNonce, localNonce).toString(16)}`;
};
