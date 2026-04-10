import { findChain, findChainByServerID } from '@/utils/chain';
import { gasAccountService, transactionHistoryService } from '../services';
import { sendToken } from './token';
import { openapi } from '../request';
import * as Sentry from '@sentry/react-native';
import { t } from 'i18next';
import { Account } from '../services/preference';
import BigNumber from 'bignumber.js';
import { getERC20Allowance } from './provider';
import { approveToken } from './approvals';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { GasAccountBridgeQuote, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { ITokenItem } from '@/store/tokens';

type GasAccountBridgeToken = Pick<
  ITokenItem,
  'chain' | 'id' | 'decimals' | 'price'
>;

const getGasAccountBridgeRawAmount = ({
  token,
  usdValue,
}: {
  token: GasAccountBridgeToken;
  usdValue: number;
}) => {
  if (!token.price || token.price <= 0) {
    throw new Error('Invalid token price');
  }
  return new BigNumber(usdValue)
    .div(token.price)
    .times(10 ** token.decimals)
    .toFixed(0, BigNumber.ROUND_DOWN);
};

export const fetchGasAccountBridgeQuote = async ({
  token,
  account,
  usdValue,
}: {
  token: GasAccountBridgeToken;
  account: Account;
  usdValue: number;
}) => {
  const rawAmount = getGasAccountBridgeRawAmount({
    token,
    usdValue,
  });

  return openapi.getGasAccountBridgeQuote({
    user_addr: account.address,
    from_chain_id: token.chain,
    from_token_id: token.id,
    from_token_raw_amount: rawAmount,
  });
};

export const buildGasAccountBridgeTxs = async ({
  token,
  account,
  quote,
  usdValue,
}: {
  token: GasAccountBridgeToken;
  account: Account;
  quote: GasAccountBridgeQuote;
  usdValue: number;
}) => {
  const txs: Tx[] = [];
  const fromChain = findChain({ serverId: token.chain });
  const isNative =
    !!fromChain?.nativeTokenAddress &&
    isSameAddress(token.id, fromChain.nativeTokenAddress);

  if (!isNative && quote.approve_contract_id) {
    const rawAmount = getGasAccountBridgeRawAmount({
      token,
      usdValue,
    });
    const allowance = await getERC20Allowance(
      token.chain,
      token.id,
      quote.approve_contract_id,
      account.address,
      account,
    );
    const tokenApproved = new BigNumber(allowance).gte(
      new BigNumber(rawAmount),
    );

    if (!tokenApproved) {
      const approveResp = await approveToken({
        chainServerId: token.chain,
        id: token.id,
        spender: quote.approve_contract_id,
        amount: rawAmount,
        account,
        isBuild: true,
      });
      txs.push(approveResp.params[0] as Tx);
    }
  }

  txs.push({
    from: quote.tx.from,
    to: quote.tx.to,
    value: quote.tx.value,
    data: quote.tx.data,
    chainId: quote.tx.chainId,
  } as Tx);

  return txs;
};

export const topUpGasAccount = async ({
  to,
  chainServerId,
  tokenId,
  rawAmount,
  amount,
  account,
}: {
  to: string;
  chainServerId: string;
  tokenId: string;
  rawAmount: string;
  amount: number;
  account: Account;
}) => {
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }

  const { sig, accountId } = gasAccountService.getGasAccountSig();

  if (!sig || !accountId) {
    throw new Error('please login first');
  }

  const tx = await sendToken({
    to,
    chainServerId,
    tokenId,
    rawAmount,
    $ctx: {
      gasAccountTopUp: true,
    },
    account,
  });
  await afterTopUpGasAccount({
    to,
    chainServerId,
    tokenId,
    rawAmount,
    amount,
    tx,
    account,
  });
  return tx;
};

export const afterTopUpGasAccount = async ({
  to: _to,
  chainServerId,
  tokenId: _tokenId,
  rawAmount: _rawAmount,
  amount,
  tx,
  account,
}: {
  to: string;
  chainServerId: string;
  tokenId: string;
  rawAmount: string;
  amount: number;
  tx?: string;
  account: Account;
}) => {
  const chain = findChainByServerID(chainServerId);
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }
  const { sig, accountId } = gasAccountService.getGasAccountSig();

  if (!sig || !accountId) {
    throw new Error('please login first');
  }

  const nonce = await transactionHistoryService.getNonceByChain(
    account.address,
    chain!.id,
  );

  if (tx) {
    gasAccountService.setLastDepositAccount(account);

    openapi.rechargeGasAccount({
      sig,
      account_id: accountId,
      tx_id: tx,
      chain_id: chainServerId,
      amount,
      user_addr: account.address,
      nonce: nonce! - 1,
    });
  } else {
    Sentry.captureException(
      new Error(
        'topUp GasAccount tx failed, params: ' +
          JSON.stringify({
            userAddr: account.address,
            gasAccount: accountId,
            chain: chainServerId,
            amount,
          }),
      ),
    );
  }
};

export const afterBridgeTopUpGasAccount = async ({
  chainServerId,
  tokenId,
  tokenAmount,
  usdValue,
  txId,
  account,
}: {
  chainServerId: string;
  tokenId: string;
  tokenAmount: number;
  usdValue: number;
  txId: string;
  account: Account;
}) => {
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }

  const { sig, accountId } = gasAccountService.getGasAccountSig();

  if (!sig || !accountId) {
    throw new Error('please login first');
  }

  gasAccountService.setLastDepositAccount(account);

  return openapi.createGasAccountBridgeRecharge({
    sig,
    gas_account_id: accountId,
    user_addr: account.address,
    from_chain_id: chainServerId,
    from_token_id: tokenId,
    from_token_amount: tokenAmount,
    from_usd_value: usdValue,
    tx_id: txId,
  });
};

export type BridgeStatusParams = Parameters<
  typeof openapi.getGasAccountBridgeStatus
>[0];

/**
 * Poll `openapi.getGasAccountBridgeStatus` until the deposit is confirmed
 * or fails.  Returns `{ promise, cancel }` so the caller can abort on unmount.
 *
 * - `promise` resolves `true` on success, `false` on failure / timeout / cancel.
 * - Calling `cancel()` stops all future polling and resolves the promise with `false`.
 */
export const pollDepositStatus = ({
  params,
  intervalMs = 3000,
  maxAttempts = 100,
}: {
  params: BridgeStatusParams;
  intervalMs?: number;
  maxAttempts?: number;
}): { promise: Promise<boolean | 'cancel'>; cancel: () => void } => {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wakeSleep: (() => void) | null = null;

  const cancel = () => {
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (wakeSleep) {
      wakeSleep();
      wakeSleep = null;
    }
  };

  const promise = (async () => {
    for (let i = 0; i < maxAttempts && !cancelled; i++) {
      try {
        const result = await openapi.getGasAccountBridgeStatus(params);
        console.debug('pollDepositStatus result', { attempt: i + 1, result });
        if (cancelled) {
          return 'cancel';
        }
        if (result.status === 'success') {
          return true;
        }
        if (result.status === 'failed') {
          return false;
        }
      } catch (error) {
        console.error('pollDepositStatus error', error);
      }
      if (cancelled) {
        break;
      }
      await new Promise<void>(r => {
        wakeSleep = () => {
          wakeSleep = null;
          timer = null;
          r();
        };
        timer = setTimeout(() => {
          wakeSleep?.();
        }, intervalMs);
      });
    }
    return 'cancel';
  })();

  return { promise, cancel };
};

export const buildTopUpGasAccount = async ({
  to,
  chainServerId,
  tokenId,
  rawAmount,
  amount: _amount,
  account,
}: {
  to: string;
  chainServerId: string;
  tokenId: string;
  rawAmount: string;
  amount: number;
  account: Account;
}) => {
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }

  const { sig, accountId } = gasAccountService.getGasAccountSig();

  if (!sig || !accountId) {
    throw new Error('please login first');
  }

  const res = await sendToken({
    to,
    chainServerId,
    tokenId,
    rawAmount,
    isBuild: true,
    account,
  });

  return res?.params?.[0];
};
