import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  ARB_USDC_TOKEN_ITEM,
  PERPS_SEND_ARB_USDC_ADDRESS,
} from '@/constant/perps';
import { sendRequest } from '@/core/apis/sendRequest';
import { Account } from '@/core/services/preference';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
// import { useAuth } from '@/hooks/useAuth';

import {
  isAccountSupportDirectSign,
  isHardWareAccountAccountSupportMiniApproval,
} from '@/utils/account';
import { sleep } from '@/utils/async';
import { findChain } from '@/utils/chain';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useInterval, useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useAtom } from 'jotai';
import { useState } from 'react';
import abiCoderInst, { AbiCoder } from 'web3-eth-abi';
import { PerpBridgeHistory } from '../components/PerpsDepositPopup';
import { openapi } from '@/core/request';
import { last } from 'lodash';
import { useMiniSigner } from '@/hooks/useSigner';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
const abiCoder = abiCoderInst as unknown as AbiCoder;

export const usePerpsDeposit = ({
  currentPerpsAccount,
}: {
  currentPerpsAccount: Account | null;
}) => {
  const { setLocalLoadingHistory } = usePerpsStore();

  // const {
  //   sendMiniTransactions,
  //   prepareMiniTransactions,
  //   sendPrepareMiniTransactions,
  // } = useMiniApproval();

  const {
    prefetch,
    openUI,
    openDirect,
    close: closeMiniSign,
    resetGasStore,
  } = useMiniSigner({
    account: currentPerpsAccount!,
  });

  useClearMiniGasStateEffect({});

  // const runAuth = useAuth();

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

      // HYPE withdraw goes through `send` ledger update whose server-
      // side timestamp can be a few dozen ms earlier than the client
      // clock, leaving the time-based pending filter unable to clear
      // it. Backdate by 1s to absorb the drift (matches the desktop
      // deposit handler's `Date.now() - 1000` trick).
      const time = Date.now() - 1000;
      if (!currentPerpsAccount) {
        return;
      }
      const currentTxs = txs;

      const handleSetHistory = (hash: string) => {
        if (options?.skipHistory) {
          return;
        }
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

        postPerpBridgeQuote(hash, cacheBridgeHistory);
      };

      const handleFullback = async (): Promise<string | undefined> => {
        const results: string[] = [];
        for (const tx of currentTxs) {
          try {
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
          } catch (error) {
            throw error;
          }
        }
        const signature = last(results as Array<string>);
        handleSetHistory(signature as string);
        return signature;
      };

      if (isAccountSupportDirectSign(currentPerpsAccount.type)) {
        try {
          resetGasStore();
          closeMiniSign();
          const res = await openDirect({
            txs: currentTxs || [],
            ga: {
              category: 'Perps',
              source: 'Perps',
              trigger: 'Perps',
            },
          });
          const txHash = last(res) || '';
          handleSetHistory(txHash);
          return txHash;
        } catch (error) {
          console.error(error);

          if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
            closeMiniSign();
          } else {
            return await handleFullback();
          }
        }
      } else if (
        isHardWareAccountAccountSupportMiniApproval(currentPerpsAccount.type)
      ) {
        try {
          resetGasStore();
          closeMiniSign();
          const res = await openUI({
            txs: currentTxs || [],
            ga: {
              category: 'Perps',
              source: 'Perps',
              trigger: 'Perps',
            },
          });
          const txHash = last(res) || '';
          handleSetHistory(txHash);
          return txHash;
        } catch (error) {
          if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
            closeMiniSign();
          } else {
            return await handleFullback();
          }
        }
      } else {
        return await handleFullback();
      }
    },
  );

  return {
    handleDeposit,
  };
};
