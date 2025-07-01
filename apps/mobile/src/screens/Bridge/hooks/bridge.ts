import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { RootNames } from '@/constant/layout';
import { sendRequest } from '@/core/apis/provider';
import {
  bridgeService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { BridgeRecord } from '@/core/services/bridge';
import { Account } from '@/core/services/preference';
import { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { approveToken } from '@/screens/Swap/hooks/swap';
import { findChain } from '@/utils/chain';
import i18n from '@/utils/i18n';
import { navigationRef } from '@/utils/navigation';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { StackActions } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

export const bridgeToken = async (
  {
    to,
    data,
    payTokenRawAmount,
    payTokenId,
    payTokenChainServerId,
    shouldApprove,
    shouldTwoStepApprove,
    gasPrice,
    info,
    value,
    account,
  }: {
    data: string;
    to: string;
    value: string;
    chainId: number;
    shouldApprove: boolean;
    shouldTwoStepApprove: boolean;
    payTokenId: string;
    payTokenChainServerId: string;
    payTokenRawAmount: string;
    gasPrice?: number;
    info: BridgeRecord;
    account: Account;
  },
  $ctx?: any,
  addBridgeTxHistoryObj?: Omit<BridgeTxHistoryItem, 'hash'>,
) => {
  if (!account) {
    throw new Error(i18n.t('background.error.noCurrentAccount'));
  }
  const chainObj = findChain({ serverId: payTokenChainServerId });
  if (!chainObj) {
    throw new Error(
      i18n.t('background.error.notFindChain', { payTokenChainServerId }),
    );
  }
  try {
    if (shouldTwoStepApprove) {
      await approveToken({
        chainServerId: payTokenChainServerId,
        id: payTokenId,
        spender: to,
        amount: 0,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndBridge|tokenApproval',
          },
        },
        gasPrice,
        extra: { isBridge: true },
        account,
      });
    }

    if (shouldApprove) {
      await approveToken({
        chainServerId: payTokenChainServerId,
        id: payTokenId,
        spender: to,
        amount: payTokenRawAmount,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndBridge|tokenApproval',
          },
        },
        gasPrice,
        extra: { isBridge: true },
        account,
      });
    }

    if (info) {
      bridgeService.addTx(chainObj.enum, data, info);
    }
    await sendRequest({
      data: {
        $ctx:
          shouldApprove && payTokenId !== chainObj.nativeTokenAddress
            ? {
                ga: {
                  ...$ctx?.ga,
                  source: 'approvalAndBridge|bridge',
                },
              }
            : $ctx,
        method: 'eth_sendTransaction',
        params: [
          {
            from: account.address,
            to: to,
            data: data || '0x',
            value: `0x${new BigNumber(value || '0').toString(16)}`,
            chainId: chainObj.id,
            gasPrice: gasPrice
              ? `0x${new BigNumber(gasPrice).toString(16)}`
              : undefined,
            isBridge: true,
          },
        ],
      },
      session: INTERNAL_REQUEST_SESSION,
      account,
    }).then(res => {
      const hash = res as string;
      if (addBridgeTxHistoryObj) {
        transactionHistoryService.addBridgeTxHistory({
          ...addBridgeTxHistoryObj,
          hash,
        });
      }
      navigationRef.dispatch(
        StackActions.replace(RootNames.StackRoot, {
          screen: RootNames.Home,
        }),
      );
    });
  } catch (e) {}
};

export const buildBridgeToken = async (
  {
    to,
    data,
    payTokenRawAmount,
    payTokenId,
    payTokenChainServerId,
    shouldApprove,
    shouldTwoStepApprove,
    gasPrice,
    info,
    value,
    account,
  }: {
    data: string;
    to: string;
    value: string;
    chainId: number;
    shouldApprove: boolean;
    shouldTwoStepApprove: boolean;
    payTokenId: string;
    payTokenChainServerId: string;
    payTokenRawAmount: string;
    gasPrice?: number;
    info: BridgeRecord;
    account: Account;
  },
  $ctx?: any,
) => {
  if (!account) {
    throw new Error(i18n.t('background.error.noCurrentAccount'));
  }
  const chainObj = findChain({ serverId: payTokenChainServerId });
  if (!chainObj) {
    throw new Error(
      i18n.t('background.error.notFindChain', { payTokenChainServerId }),
    );
  }
  const txs: Tx[] = [];
  try {
    if (shouldTwoStepApprove) {
      const res = await approveToken({
        chainServerId: payTokenChainServerId,
        id: payTokenId,
        spender: to,
        amount: 0,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndBridge|tokenApproval',
          },
        },
        gasPrice,
        extra: { isBridge: true },
        isBuild: true,
        account,
      });

      txs.push(res.params[0]);
    }

    if (shouldApprove) {
      const res = await approveToken({
        chainServerId: payTokenChainServerId,
        id: payTokenId,
        spender: to,
        amount: payTokenRawAmount,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndBridge|tokenApproval',
          },
        },
        gasPrice,
        extra: { isBridge: true },
        isBuild: true,
        account,
      });
      txs.push(res.params[0]);
    }

    if (info) {
      bridgeService.addTx(chainObj.enum, data, info);
    }
    const res = await sendRequest(
      {
        data: {
          $ctx:
            shouldApprove && payTokenId !== chainObj.nativeTokenAddress
              ? {
                  ga: {
                    ...$ctx?.ga,
                    source: 'approvalAndBridge|bridge',
                  },
                }
              : $ctx,
          method: 'eth_sendTransaction',
          params: [
            {
              from: account.address,
              to: to,
              data: data || '0x',
              value: `0x${new BigNumber(value || '0').toString(16)}`,
              chainId: chainObj.id,
              gasPrice: gasPrice
                ? `0x${new BigNumber(gasPrice).toString(16)}`
                : undefined,
              isBridge: true,
            },
          ],
        },
        session: INTERNAL_REQUEST_SESSION,
        account,
      },
      true,
    );
    txs.push(res.params[0]);

    return txs;
  } catch (e) {
    return [];
  }
};
