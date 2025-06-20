import { findChainByServerID } from '@/utils/chain';
import {
  gasAccountService,
  preferenceService,
  transactionHistoryService,
} from '../services';
import { sendToken } from './token';
import { openapi } from '../request';
import * as Sentry from '@sentry/react-native';
import { t } from 'i18next';
import { Account } from '../services/preference';

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
};

export const afterTopUpGasAccount = async ({
  to,
  chainServerId,
  tokenId,
  rawAmount,
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
      sig: sig!,
      account_id: accountId!,
      tx_id: tx,
      chain_id: chainServerId,
      amount,
      user_addr: account?.address,
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
            amount: amount,
          }),
      ),
    );
  }
};

export const buildTopUpGasAccount = async ({
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

  const res = await sendToken({
    to,
    chainServerId,
    tokenId,
    rawAmount,
    isBuild: true,
    account,
  });

  return res?.params?.[0];

  // const chain = findChainByServerID(chainServerId);

  // const nonce = await transactionHistoryService.getNonceByChain(
  //   account.address,
  //   chain!.id,
  // );

  // if (tx) {
  //   gasAccountService.setLastDepositAccount(account);

  //   openapi.rechargeGasAccount({
  //     sig: sig!,
  //     account_id: accountId!,
  //     tx_id: tx,
  //     chain_id: chainServerId,
  //     amount,
  //     user_addr: account?.address,
  //     nonce: nonce! - 1,
  //   });
  // } else {
  //   Sentry.captureException(
  //     new Error(
  //       'topUp GasAccount tx failed, params: ' +
  //         JSON.stringify({
  //           userAddr: account.address,
  //           gasAccount: accountId,
  //           chain: chainServerId,
  //           amount: amount,
  //         }),
  //     ),
  //   );
  // }
};
