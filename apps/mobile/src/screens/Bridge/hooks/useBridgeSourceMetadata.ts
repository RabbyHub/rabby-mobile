import { useRequest } from 'ahooks';
import { useEffect, useRef } from 'react';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { TxHistoryResult } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import { getTransactionHistoryTransactions } from '@/core/serviceApi/transactionHistory';
import { findChain } from '@/utils/chain';
import { sameBridgeHash } from '../utils/record';

export function useBridgeSourceMetadata({
  address,
  chainId,
  hash,
  enabled,
}: {
  address: string;
  chainId?: string;
  hash?: string;
  enabled: boolean;
}) {
  const request = useRef<AbortController | undefined>(undefined);
  // 优先复用本地交互地址，缺失时通过常规请求查询单笔历史。
  const { data: transaction, cancel } = useRequest(
    async () => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      try {
        const transactions = await getTransactionHistoryTransactions().catch(
          error => {
            console.warn('[Bridge] load source transaction failed', error);
            return [];
          },
        );
        // 本地读取无法中止，停用后不再继续发起网络请求。
        if (controller.signal.aborted) {
          return;
        }
        const chain = findChain({ serverId: chainId });
        const local = transactions.find(
          item =>
            isSameAddress(item.address, address) &&
            item.chainId === chain?.id &&
            sameBridgeHash(item.hash, hash),
        );
        if (local?.rawTx.to) {
          return { address, chainId, hash: local.hash, to: local.rawTx.to };
        }
        const { data: detail } =
          await openapi.request.get<TxHistoryResult | null>('/v1/user/tx', {
            signal: controller.signal,
            params: {
              chain_id: chainId,
              tx_id: hash,
              id: address.toLowerCase(),
            },
          });
        const history = detail?.history_list.find(
          item => item.chain === chainId && sameBridgeHash(item.id, hash),
        );
        return {
          address,
          chainId,
          hash: history?.id,
          to: history?.tx?.to_addr,
        };
      } finally {
        if (request.current === controller) {
          request.current = undefined;
        }
      }
    },
    {
      ready: enabled && !!address && !!hash && !!chainId,
      refreshDeps: [address, hash, chainId],
    },
  );
  // ready 只阻止新调用，停用或切换记录时还需中止在途请求。
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = undefined;
      cancel();
    },
    [address, hash, chainId, enabled, cancel],
  );
  // 只使用当前账户、链和哈希匹配的结果，避免切换记录后沿用旧地址。
  const to =
    transaction &&
    transaction.chainId === chainId &&
    isSameAddress(transaction.address, address) &&
    sameBridgeHash(transaction.hash, hash)
      ? transaction.to
      : undefined;
  return { to };
}
