import BigNumber from 'bignumber.js';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import { CHAINS_ENUM } from '@debank/common';
import { QuoteResult } from '@rabby-wallet/rabby-swap/dist/quote';
import { findChain, findChainByEnum } from '@/utils/chain';
import i18n from '@/utils/i18n';
import abiCoder, { AbiCoder } from 'web3-eth-abi';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { preferenceService, swapService } from '@/core/services';
import { sendRequest } from '@/core/apis/provider';
import { navigationRef } from '@/utils/navigation';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';

const MAX_UNSIGNED_256_INT = new BigNumber(2).pow(256).minus(1).toString(10);

export const approveToken = async (
  chainServerId: string,
  id: string,
  spender: string,
  amount: number | string,
  $ctx?: any,
  gasPrice?: number,
  extra?: {
    isSwap?: boolean;
    swapPreferMEVGuarded?: boolean;
    isBridge?: boolean;
  },
) => {
  const account = await preferenceService.getCurrentAccount();
  if (!account) throw new Error(i18n.t('background.error.noCurrentAccount'));

  const chainId = findChain({
    serverId: chainServerId,
  })?.id;
  if (!chainId) throw new Error(i18n.t('background.error.invalidChainId'));
  let tx: any = {
    from: account.address,
    to: id,
    chainId: chainId,
    data: (abiCoder as unknown as AbiCoder).encodeFunctionCall(
      {
        constant: false,
        inputs: [
          {
            name: '_spender',
            type: 'address',
          },
          {
            name: '_value',
            type: 'uint256',
          },
        ],
        name: 'approve',
        outputs: [
          {
            name: '',
            type: 'bool',
          },
        ],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function',
      },
      [spender, amount] as any,
    ),
  };
  if (gasPrice) {
    tx.gasPrice = gasPrice;
  }
  if (extra) {
    tx = {
      ...tx,
      ...extra,
    };
  }
  await sendRequest(
    {
      $ctx,
      method: 'eth_sendTransaction',
      params: [tx],
    },
    INTERNAL_REQUEST_SESSION,
  );
};

export const dexSwap = async (
  {
    chain,
    quote,
    needApprove,
    spender,
    pay_token_id,
    unlimited,
    gasPrice,
    shouldTwoStepApprove,
    postSwapParams,
    swapPreferMEVGuarded,
  }: {
    chain: CHAINS_ENUM;
    quote: QuoteResult;
    needApprove: boolean;
    spender: string;
    pay_token_id: string;
    unlimited: boolean;
    gasPrice?: number;
    shouldTwoStepApprove: boolean;
    swapPreferMEVGuarded: boolean;

    postSwapParams?: Omit<
      Parameters<OpenApiService['postSwap']>[0],
      'tx_id' | 'tx'
    >;
  },
  $ctx?: any,
) => {
  const account = await preferenceService.getCurrentAccount();
  if (!account) {
    throw new Error(i18n.t('background.error.noCurrentAccount'));
  }

  const chainObj = findChainByEnum(chain);
  if (!chainObj) {
    throw new Error(i18n.t('background.error.notFindChain', { chain }));
  }
  try {
    if (shouldTwoStepApprove) {
      // unTriggerTxCounter.increase(3);

      await approveToken(
        chainObj.serverId,
        pay_token_id,
        spender,
        0,
        {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndSwap|tokenApproval',
          },
        },
        gasPrice,
        { isSwap: true, swapPreferMEVGuarded },
      );

      // unTriggerTxCounter.decrease();
    }

    if (needApprove) {
      if (!shouldTwoStepApprove) {
        // unTriggerTxCounter.increase(2);
      }
      await approveToken(
        chainObj.serverId,
        pay_token_id,
        spender,
        quote.fromTokenAmount,
        {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndSwap|tokenApproval',
          },
        },
        gasPrice,
        { isSwap: true, swapPreferMEVGuarded },
      );

      // unTriggerTxCounter.decrease();
    }

    if (postSwapParams) {
      swapService.addTx(chain, quote.tx.data, postSwapParams);
    }

    await sendRequest(
      {
        $ctx:
          needApprove && pay_token_id !== chainObj.nativeTokenAddress
            ? {
                ga: {
                  ...$ctx?.ga,
                  source: 'approvalAndSwap|swap',
                },
              }
            : $ctx,
        method: 'eth_sendTransaction',
        params: [
          {
            from: quote.tx.from,
            to: quote.tx.to,
            data: quote.tx.data || '0x',
            value: `0x${new BigNumber(quote.tx.value || '0').toString(16)}`,
            chainId: chainObj.id,
            gasPrice: gasPrice
              ? `0x${new BigNumber(gasPrice).toString(16)}`
              : undefined,
            isSwap: true,
            swapPreferMEVGuarded,
          },
        ],
      },
      INTERNAL_REQUEST_SESSION,
    )
      .then(() => {
        console.log('after swap');
        navigationRef.dispatch(
          StackActions.replace(RootNames.StackRoot, {
            screen: RootNames.Home,
          }),
        );
      })
      .catch(error => {
        console.log('swap error', error);
      });

    console.log('after sendRequest');
    // unTriggerTxCounter.decrease();
  } catch (e) {
    // unTriggerTxCounter.reset();
  }
};
