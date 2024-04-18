import { preferenceService } from '@/core/services';
import { findChainByServerID } from '@/utils/chain';
import { stats } from '@/utils/stats';
import { t } from 'i18next';
import abiCoder, { AbiCoder } from 'web3-eth-abi';
import { addHexPrefix, unpadHexString } from 'ethereumjs-util';
import { sendRequest } from '@/core/apis/provider';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { openapi } from '@/core/request';
import * as Sentry from '@sentry/react-native';
import { navigationRef } from '@/utils/navigation';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';

const sendToken = async ({
  to,
  chainServerId,
  tokenId,
  rawAmount,
  $ctx,
}: {
  to: string;
  chainServerId: string;
  tokenId: string;
  rawAmount: string;
  $ctx?: any;
}) => {
  const account = await preferenceService.getCurrentAccount();
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }
  const chain = findChainByServerID(chainServerId);
  const chainId = chain?.id;
  if (!chainId) {
    throw new Error(t('background.error.invalidChainId'));
  }
  const params: Record<string, any> = {
    chainId: chain.id,
    from: account!.address,
    to: tokenId,
    value: '0x0',
    data: (abiCoder as unknown as AbiCoder).encodeFunctionCall(
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
        ],
      },
      [to, rawAmount],
    ),
    isSend: true,
  };
  const isNativeToken = tokenId === chain.nativeTokenAddress;

  if (isNativeToken) {
    params.to = to;
    delete params.data;
    params.value = addHexPrefix(
      unpadHexString(
        (abiCoder as unknown as AbiCoder).encodeParameter('uint256', rawAmount),
      ),
    );
  }

  return await sendRequest(
    {
      method: 'eth_sendTransaction',
      params: [params],
      $ctx,
    },
    INTERNAL_REQUEST_SESSION,
  );
};

export const gasTopUp = async (params: {
  to: string;
  chainServerId: string;
  tokenId: string;
  rawAmount: string;
  gasPrice?: string;
  $ctx?: any;
  toChainId: string;
  toTokenAmount: string;
  fromTokenAmount: string;
  gasTokenSymbol: string;
  paymentTokenSymbol: string;
  fromUsdValue: number;
}) => {
  const {
    gasTokenSymbol,
    paymentTokenSymbol,
    fromUsdValue,
    toChainId,
    fromTokenAmount,
    toTokenAmount,
    ...others
  } = params;

  stats.report('gasTopUpConfirm', {
    topUpChain: toChainId,
    topUpAmount: fromUsdValue,
    topUpToken: gasTokenSymbol,
    paymentChain: others.chainServerId,
    paymentToken: paymentTokenSymbol,
  });

  const account = await preferenceService.getCurrentAccount();
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }
  const txId = await sendToken(others);

  stats.report('gasTopUpTxFinished', {
    topUpChain: toChainId,
    topUpAmount: fromUsdValue,
    paymentChain: others.chainServerId,
    paymentToken: paymentTokenSymbol,
  });

  const postGasStationOrder = async () =>
    await openapi.postGasStationOrder({
      userAddr: account.address,
      fromChainId: others.chainServerId,
      fromTxId: txId,
      toChainId: toChainId,
      toTokenAmount,
      fromTokenId: others.tokenId,
      fromTokenAmount: fromTokenAmount,
      fromUsdValue,
    });

  const reportGasTopUpPostGasStationOrder = () =>
    stats.report('gasTopUpPostGasStationOrder', {
      topUpChain: toChainId,
      topUpAmount: fromUsdValue,
      paymentChain: others.chainServerId,
      paymentToken: paymentTokenSymbol,
    });

  const gotoHome = () => {
    navigationRef.dispatch(
      StackActions.replace(RootNames.StackRoot, {
        screen: RootNames.Home,
      }),
    );
  };

  try {
    await postGasStationOrder();
    reportGasTopUpPostGasStationOrder();
    gotoHome();
  } catch (e) {
    try {
      await postGasStationOrder();
      reportGasTopUpPostGasStationOrder();
      gotoHome();
    } catch (error) {
      Sentry.captureException(
        new Error(
          'postGasStationOrder failed, params: ' +
            JSON.stringify({
              userAddr: account.address,
              fromChainId: others.chainServerId,
              fromTxId: txId,
              toChainId: toChainId,
              toTokenAmount,
              fromTokenId: others.tokenId,
              fromTokenAmount: fromTokenAmount,
              fromUsdValue,
            }),
        ),
      );
    }
  }
};
