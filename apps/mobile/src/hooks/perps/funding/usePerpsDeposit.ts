import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { sendRequest } from '@/core/apis/sendRequest';
import type { Account } from '@/core/startupServices/preference';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { perpsStore, usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useMiniSigner } from '@/hooks/useSigner';
import {
  isAccountSupportDirectSign,
  isHardWareAccountAccountSupportMiniApproval,
} from '@/utils/account';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { last } from 'lodash';

import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { openapi } from '@/core/request';

import { isSamePerpsFundingAccount } from './accountGuard';
import type { PerpBridgeHistory } from './types';

export const usePerpsDeposit = ({
  currentPerpsAccount,
}: {
  currentPerpsAccount: Account | null;
}) => {
  const { setLocalLoadingHistory } = usePerpsStore();
  const {
    openUI,
    openDirect,
    close: closeMiniSign,
    resetGasStore,
  } = useMiniSigner({
    account: currentPerpsAccount!,
  });

  useClearMiniGasStateEffect({});

  const postPerpBridgeQuote = useMemoizedFn(
    async (hash: string, cacheBridgeHistory?: PerpBridgeHistory) => {
      if (!hash || !cacheBridgeHistory) {
        throw new Error('No hash tx');
      }

      const res = await openapi.postPerpBridgeHistory({
        from_chain_id: cacheBridgeHistory.from_chain_id,
        from_token_id: cacheBridgeHistory.from_token_id,
        from_token_amount: cacheBridgeHistory.from_token_amount,
        to_token_amount: cacheBridgeHistory.to_token_amount,
        tx_id: hash,
        tx: cacheBridgeHistory.tx,
      });
      console.log('postPerpBridgeQuote res', res);
    },
  );

  const handleDeposit = useMemoizedFn(
    async (
      txs: Tx[],
      amount: string,
      cacheBridgeHistory?: PerpBridgeHistory,
      options?: { skipHistory?: boolean; isHypeDeposit?: boolean },
    ): Promise<string | undefined> => {
      if (!txs || txs.length === 0) {
        throw new Error('No txs');
      }

      const time = Date.now() - 1000;
      if (!currentPerpsAccount) {
        return;
      }

      const handleSetHistory = (hash: string) => {
        if (options?.skipHistory) {
          return;
        }
        const activeAccount = perpsStore.getState().currentPerpsAccount;
        if (isSamePerpsFundingAccount(activeAccount, currentPerpsAccount)) {
          setLocalLoadingHistory(
            [
              {
                time,
                hash,
                type:
                  cacheBridgeHistory || options?.isHypeDeposit
                    ? 'receive'
                    : 'deposit',
                status: 'pending',
                usdValue: amount.toString(),
              },
            ],
            false,
          );
        }
        if (cacheBridgeHistory) {
          postPerpBridgeQuote(hash, cacheBridgeHistory).catch(error => {
            console.error('[perpsDeposit] post bridge history failed', error);
          });
        }
      };

      const handleFallback = async (): Promise<string | undefined> => {
        const results: string[] = [];
        for (const tx of txs) {
          const result = await sendRequest({
            data: {
              method: 'eth_sendTransaction',
              params: [tx],
              $ctx: {
                ga: {
                  category: 'Perps',
                  source: 'Perps',
                  trigger: 'Perps',
                },
              },
            },
            session: INTERNAL_REQUEST_SESSION,
            account: currentPerpsAccount,
          });
          results.push(result);
        }
        const signature = last(results);
        handleSetHistory(signature || '');
        return signature;
      };

      if (isAccountSupportDirectSign(currentPerpsAccount.type)) {
        try {
          resetGasStore();
          closeMiniSign();
          const result = await openDirect({
            txs,
            ga: {
              category: 'Perps',
              source: 'Perps',
              trigger: 'Perps',
            },
          });
          const txHash = last(result) || '';
          handleSetHistory(txHash);
          return txHash;
        } catch (error) {
          console.error(error);
          if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
            closeMiniSign();
            return;
          }
          return handleFallback();
        }
      }

      if (
        isHardWareAccountAccountSupportMiniApproval(currentPerpsAccount.type)
      ) {
        try {
          resetGasStore();
          closeMiniSign();
          const result = await openUI({
            txs,
            ga: {
              category: 'Perps',
              source: 'Perps',
              trigger: 'Perps',
            },
          });
          const txHash = last(result) || '';
          handleSetHistory(txHash);
          return txHash;
        } catch (error) {
          if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
            closeMiniSign();
            return;
          }
          return handleFallback();
        }
      }

      return handleFallback();
    },
  );

  return { handleDeposit };
};
