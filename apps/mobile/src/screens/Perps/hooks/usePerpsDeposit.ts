import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  ARB_USDC_TOKEN_ITEM,
  PERPS_SEND_ARB_USDC_ADDRESS,
} from '@/constant/perps';
import { sendRequest } from '@/core/apis/sendRequest';
import { Account } from '@/core/services/preference';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useAuth } from '@/hooks/useAuth';
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
  const [miniSignTx, setMiniSignTx] = useState<Tx | null>(null);
  const [cacheAmount, setCacheAmount] = useState<number>(0);

  const {
    sendMiniTransactions,
    prepareMiniTransactions,
    sendPrepareMiniTransactions,
  } = useMiniApproval();

  useClearMiniGasStateEffect({});

  const runAuth = useAuth();
  const [isDirectSigning, setDirectSigning] = useAtom(directSigningAtom);

  const updateMiniSignTx = useMemoizedFn((amount: number) => {
    const token = ARB_USDC_TOKEN_ITEM;
    const to = PERPS_SEND_ARB_USDC_ADDRESS;

    const chain = findChain({
      serverId: token.chain,
    })!;
    const sendValue = new BigNumber(amount || 0)
      .multipliedBy(10 ** token.decimals)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);
    const dataInput = [
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          {
            type: 'address',
            name: 'to',
          },
          {
            type: 'uint256',
            name: 'value',
          },
        ] as any[],
      } as const,
      [to, sendValue.toFixed(0)] as any[],
    ] as const;
    const params: Record<string, any> = {
      chainId: chain.id,
      from: currentPerpsAccount!.address,
      to: token.id,
      value: '0x0',
      data: abiCoder.encodeFunctionCall(dataInput[0], dataInput[1]),
      isSend: true,
    };

    setCacheAmount(amount);
    setMiniSignTx(params as Tx);
    return params;
  });

  const buildTx = useMemoizedFn((amount: number | string) => {
    const token = ARB_USDC_TOKEN_ITEM;
    const to = PERPS_SEND_ARB_USDC_ADDRESS;

    const chain = findChain({
      serverId: token.chain,
    })!;
    const sendValue = new BigNumber(amount || 0)
      .multipliedBy(10 ** token.decimals)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);
    const dataInput = [
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          {
            type: 'address',
            name: 'to',
          },
          {
            type: 'uint256',
            name: 'value',
          },
        ] as any[],
      } as const,
      [to, sendValue.toFixed(0)] as any[],
    ] as const;
    const params: Record<string, any> = {
      chainId: chain.id,
      from: currentPerpsAccount!.address,
      to: token.id,
      value: '0x0',
      data: abiCoder.encodeFunctionCall(dataInput[0], dataInput[1]),
      isSend: true,
    };

    return params;
  });

  const clearMiniSignTx = useMemoizedFn(() => {
    setMiniSignTx(null);
  });

  const handleDeposit = useMemoizedFn(async (amount: number | string) => {
    // if (!miniSignTx) {
    //   throw new Error('No miniSignTx');
    // }

    if (!currentPerpsAccount) {
      return;
    }
    const currentTxs = [buildTx(amount) as Tx];

    const handleSetHistory = (hash: string) => {
      setLocalLoadingHistory([
        {
          time: Date.now(),
          hash,
          type: 'deposit',
          status: 'pending',
          usdValue: amount.toString(),
        },
      ]);
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

      handleSetHistory(res);
    };

    if (isAccountSupportDirectSign(currentPerpsAccount.type)) {
      if (isDirectSigning) {
        return;
      }
      try {
        await runAuth();
        prepareMiniTransactions({
          txs: currentTxs || [],
          ga: {
            category: 'Perps',
            source: 'Perps',
            trigger: 'Perps',
          },
          directSubmit: true,
          account: currentPerpsAccount!,
        });
        setDirectSigning(true);
        await sleep(500);
        const res = await sendPrepareMiniTransactions({
          directSubmit: true,
        });
        handleSetHistory(res[0].txHash);
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
        handleSetHistory(res[0].txHash);
      } catch (error) {
        if ((error as any).name === 'SimulateError') {
          await handleFullback();
        }
      }
    } else {
      await handleFullback();
    }

    // console.log('fallback res tx', tx);
  });

  useInterval(
    () => {
      fetchUserNonFundingLedgerUpdates();
    },
    perpsState.localLoadingHistory.length > 0 ? 60 * 1000 : undefined,
  );

  const handleSignDepositDirect = useMemoizedFn(async (hash: string) => {
    if (!hash) {
      throw new Error('No hash tx');
    }

    setLocalLoadingHistory([
      {
        time: Date.now(),
        hash,
        type: 'deposit',
        status: 'pending',
        usdValue: cacheAmount.toString(),
      },
    ]);
  });

  return {
    miniSignTx,
    clearMiniSignTx,
    updateMiniSignTx,
    handleDeposit,
    handleSignDepositDirect,
  };
};
