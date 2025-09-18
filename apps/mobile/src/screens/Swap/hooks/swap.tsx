import BigNumber from 'bignumber.js';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import { CHAINS_ENUM } from '@debank/common';
import { QuoteResult } from '@rabby-wallet/rabby-swap/dist/quote';
import { findChain, findChainByEnum } from '@/utils/chain';
import i18n from '@/utils/i18n';
import abiCoder, { AbiCoder } from 'web3-eth-abi';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  preferenceService,
  swapService,
  transactionHistoryService,
} from '@/core/services';
import { sendRequest } from '@/core/apis/provider';
import { navigationRef } from '@/utils/navigation';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { Account } from '@/core/services/preference';
import { SwapTxHistoryItem } from '@/core/services/transactionHistory';
import { matomoRequestEvent } from '@/utils/analytics';

const MAX_UNSIGNED_256_INT = new BigNumber(2).pow(256).minus(1).toString(10);

export const approveToken = async ({
  chainServerId,
  id,
  spender,
  amount,
  $ctx,
  gasPrice,
  extra,
  isBuild,
  account,
}: {
  chainServerId: string;
  id: string;
  spender: string;
  amount: number | string;
  $ctx?: any;
  gasPrice?: number;
  extra?: {
    isSwap?: boolean;
    swapPreferMEVGuarded?: boolean;
    isBridge?: boolean;
  };
  isBuild?: boolean;
  account: Account;
}) => {
  if (!account) {
    throw new Error(i18n.t('background.error.noCurrentAccount'));
  }

  const chainId = findChain({
    serverId: chainServerId,
  })?.id;
  if (!chainId) {
    throw new Error(i18n.t('background.error.invalidChainId'));
  }
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
  return await sendRequest(
    {
      data: {
        $ctx,
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: INTERNAL_REQUEST_SESSION,
      account,
    },
    isBuild,
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
    account,
    isTwoStep,
    isApprove,
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
    account: Account;
    isApprove?: boolean;
    isTwoStep?: boolean;
  },
  $ctx?: any,
  addSwapTxHistoryObj?: Omit<SwapTxHistoryItem, 'hash'>,
) => {
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

      await approveToken({
        chainServerId: chainObj.serverId,
        id: pay_token_id,
        spender,
        amount: 0,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndSwap|tokenApproval',
          },
        },
        gasPrice,
        extra: { isSwap: true, swapPreferMEVGuarded },
        account,
      });

      // unTriggerTxCounter.decrease();
    }

    if (needApprove) {
      if (!shouldTwoStepApprove) {
        // unTriggerTxCounter.increase(2);
      }
      await approveToken({
        chainServerId: chainObj.serverId,
        id: pay_token_id,
        spender,
        amount: quote.fromTokenAmount,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndSwap|tokenApproval',
          },
        },
        gasPrice,
        extra: { isSwap: true, swapPreferMEVGuarded },
        account,
      });

      // unTriggerTxCounter.decrease();
    }

    if (postSwapParams) {
      swapService.addTx(chain, quote.tx.data, postSwapParams);
    }

    await sendRequest({
      data: {
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
      session: INTERNAL_REQUEST_SESSION,
      account,
    })
      .then(res => {
        const hash = res as string;
        console.log('after swap  hash: ', hash);
        preferenceService.setReportActionTs(
          REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_SIGN,
          {
            chain: chainObj.serverId as string,
          },
        );
        if (addSwapTxHistoryObj) {
          const swapTxHistoryObj = {
            ...addSwapTxHistoryObj,
            hash,
          };
          transactionHistoryService.addSwapTxHistory(swapTxHistoryObj);

          if (swapTxHistoryObj.isFromCopyTrading) {
            matomoRequestEvent({
              category: 'CopyTrading',
              action:
                swapTxHistoryObj.copyTradingExtra?.type === 'Sell'
                  ? 'CopyTrading_SellCreateSwap'
                  : 'CopyTrading_BuyCreateSwap',
            });
          }
        }
        navigationRef.dispatch(
          StackActions.replace(RootNames.StackRoot, {
            screen: RootNames.Home,
          }),
        );
      })
      .catch(error => {
        console.log('swap error', error);
        throw error;
      });

    console.log('after sendRequest');
    // unTriggerTxCounter.decrease();
  } catch (e) {
    // unTriggerTxCounter.reset();
    throw e;
  }
};

export const buildDexSwap = async (
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
    account,
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
    account: Account;
  },
  $ctx?: any,
) => {
  if (!account) {
    throw new Error(i18n.t('background.error.noCurrentAccount'));
  }

  const chainObj = findChainByEnum(chain);
  if (!chainObj) {
    throw new Error(i18n.t('background.error.notFindChain', { chain }));
  }
  const txs: Tx[] = [];
  try {
    if (shouldTwoStepApprove) {
      // unTriggerTxCounter.increase(3);

      const res = await approveToken({
        chainServerId: chainObj.serverId,
        id: pay_token_id,
        spender,
        amount: 0,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndSwap|tokenApproval',
          },
        },
        gasPrice,
        extra: { isSwap: true, swapPreferMEVGuarded },
        isBuild: true,
        account,
      });

      txs.push(res.params[0]);
      // unTriggerTxCounter.decrease();
    }

    if (needApprove) {
      if (!shouldTwoStepApprove) {
        // unTriggerTxCounter.increase(2);
      }
      const res = await approveToken({
        chainServerId: chainObj.serverId,
        id: pay_token_id,
        spender,
        amount: quote.fromTokenAmount,
        $ctx: {
          ga: {
            ...$ctx?.ga,
            source: 'approvalAndSwap|tokenApproval',
          },
        },
        gasPrice,
        extra: { isSwap: true, swapPreferMEVGuarded },
        isBuild: true,
        account,
      });

      txs.push(res.params[0]);
      // unTriggerTxCounter.decrease();
    }

    if (postSwapParams) {
      swapService.addTx(chain, quote.tx.data, postSwapParams);
    }

    const res = await sendRequest(
      {
        data: {
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
        session: INTERNAL_REQUEST_SESSION,
        account,
      },
      true,
    );

    txs.push(res.params[0]);

    return txs;

    // unTriggerTxCounter.decrease();
  } catch (e) {
    // unTriggerTxCounter.reset();
  }
};
