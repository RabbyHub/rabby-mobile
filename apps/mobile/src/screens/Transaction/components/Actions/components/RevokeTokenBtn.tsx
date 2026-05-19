import { approveToken } from '@/core/apis/approvals';
import { getERC20Allowance } from '@/core/apis/provider';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, ViewStyle } from 'react-native';
import { RevokeApprovalCard } from './RevokeApprovalCard';
import { useRevokeApproval } from './useRevokeApproval';

interface Props {
  account: KeyringAccountWithAlias;
  token: TokenItem;
  spender: string;
  style?: StyleProp<ViewStyle>;
}

export const RevokeTokenBtn = ({ token, account, spender, style }: Props) => {
  const { t } = useTranslation();
  const { data: allowance, loading } = useRequest(async () => {
    const res = await getERC20Allowance(
      token.chain,
      token.id,
      spender,
      account.address,
      account,
    );

    const amount = new BigNumber(res)
      .div(new BigNumber(10).pow(token.decimals))
      .toNumber();

    return amount;
  });

  const handleRevoke = useRevokeApproval({
    account,
    buildMiniSignTx: () =>
      approveToken({
        chainServerId: token.chain,
        id: token.id,
        spender,
        amount: 0,
        account,
        isBuild: true,
      }),
    revoke: () =>
      approveToken({
        chainServerId: token.chain,
        id: token.id,
        spender,
        amount: 0,
        account,
      }),
  });

  return (
    <RevokeApprovalCard
      style={style}
      loading={loading}
      disabled={!allowance}
      onPress={handleRevoke}
      value={
        <>
          {(allowance || 0) >= 1e9
            ? t('global.unlimited')
            : formatAmount(allowance || 0)}{' '}
          {getTokenSymbol(token)}
        </>
      }
    />
  );
};
