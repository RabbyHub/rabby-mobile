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
import { useMiniApproval } from '@/hooks/useMiniApproval';
import {
  directSigningAtom,
  isAbortedDirectSubmitError,
} from '@/hooks/useMiniApprovalDirectSign';
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
const abiCoder = abiCoderInst as unknown as AbiCoder;

export const usePerpsDeposit = ({
  currentPerpsAccount,
}: {
  currentPerpsAccount: Account | null;
}) => {
  const {
    state: perpsState,
    fetchUserNonFundingLedgerUpdates,
    setLocalLoadingHistory,
  } = usePerpsStore();

  const {
    sendMiniTransactions,
    prepareMiniTransactions,
    sendPrepareMiniTransactions,
  } = useMiniApproval();

  useClearMiniGasStateEffect({});

  // const runAuth = useAuth();
  const [isDirectSigning, setDirectSigning] = useAtom(directSigningAtom);

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
    ) => {
      if (!txs || txs.length === 0) {
        throw new Error('No txs');
      }

      if (!currentPerpsAccount) {
        return;
      }
      const currentTxs = txs;

      const handleSetHistory = (hash: string) => {
        setLocalLoadingHistory(
          [
            {
              time: Date.now(),
              hash,
              type: 'deposit',
              status: 'pending',
              usdValue: amount.toString(),
            },
          ],
          false,
        );

        postPerpBridgeQuote(hash, cacheBridgeHistory);
      };

      const handleFullback = async () => {
        const res = await sendRequest({
          data: {
            method: 'eth_sendTransaction',
            params: currentTxs,
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

        const txHash = last(res) as string;
        handleSetHistory(txHash);
      };

      if (isAccountSupportDirectSign(currentPerpsAccount.type)) {
        if (isDirectSigning) {
          return;
        }
        try {
          // await runAuth();
          prepareMiniTransactions({
            txs: currentTxs || [],
            ga: {
              category: 'Perps',
              source: 'Perps',
              trigger: 'Perps',
            },
            directSubmit: true,
            account: currentPerpsAccount!,
            showMaskLoading: false,
          });
          setDirectSigning(true);
          await sleep(500);
          const res = await sendPrepareMiniTransactions({
            directSubmit: true,
          });
          const txHash = last(res)?.txHash || '';
          handleSetHistory(txHash);
        } catch (e) {
          setDirectSigning(false);
          console.error(e);
          if (
            (e as any).name === 'SimulateError' ||
            isAbortedDirectSubmitError(e)
          ) {
            await handleFullback();
          }
        }
      } else if (
        isHardWareAccountAccountSupportMiniApproval(currentPerpsAccount.type)
      ) {
        try {
          const res = await sendMiniTransactions({
            txs: currentTxs || [],
            ga: {
              category: 'Perps',
              source: 'Perps',
              trigger: 'Perps',
            },
            directSubmit: false,
            account: currentPerpsAccount!,
          });
          const txHash = last(res)?.txHash || '';
          handleSetHistory(txHash);
        } catch (error) {
          if ((error as any).name === 'SimulateError') {
            await handleFullback();
          }
        }
      } else {
        await handleFullback();
      }
    },
  );

  useInterval(
    () => {
      fetchUserNonFundingLedgerUpdates();
    },
    perpsState.localLoadingHistory.length > 0 ? 30 * 1000 : undefined,
  );

  return {
    handleDeposit,
  };
};
