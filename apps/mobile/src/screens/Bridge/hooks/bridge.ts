import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { RootNames } from '@/constant/layout';
import { sendRequest } from '@/core/apis/provider';
import { bridgeService, preferenceService } from '@/core/services';
import { BridgeRecord } from '@/core/services/bridge';
import { approveToken } from '@/screens/Swap/hooks/swap';
import { findChain } from '@/utils/chain';
import i18n from '@/utils/i18n';
import { navigationRef } from '@/utils/navigation';
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
  },
  $ctx?: any,
) => {
  const account = await preferenceService.getCurrentAccount();
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
      await approveToken(
        payTokenChainServerId,
        payTokenId,
        to,
        0,
        {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndBridge|tokenApproval',
          },
        },
        gasPrice,
        { isBridge: true },
      );
    }

    if (shouldApprove) {
      await approveToken(
        payTokenChainServerId,
        payTokenId,
        to,
        payTokenRawAmount,
        {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndBridge|tokenApproval',
          },
        },
        gasPrice,
        { isBridge: true },
      );
    }

    if (info) {
      bridgeService.addTx(chainObj.enum, data, info);
    }
    await sendRequest(
      {
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
      INTERNAL_REQUEST_SESSION,
    ).then(() => {
      navigationRef.dispatch(
        StackActions.replace(RootNames.StackRoot, {
          screen: RootNames.Home,
        }),
      );
    });
  } catch (e) {}
};
