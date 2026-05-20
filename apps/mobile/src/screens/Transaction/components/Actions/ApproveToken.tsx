/* eslint-disable react-native/no-inline-styles */
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { TransactionGroup } from '@/core/services/transactionHistory';

import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { naviPush } from '@/utils/navigation';
import { ApproveTokenRequireData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import { unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { HistoryItemIcon } from '../HistoryItemIcon';
import { HistoryItemCateType } from '../type';
import { RevokeTokenBtn } from './components/RevokeTokenBtn';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { findAccountByPriority } from '@/utils/account';
import { Account } from '@/core/services/preference';
import { Text } from '@/components/Typography';
import {
  ActionDetailItem,
  ActionDetailSection,
  ActionDetailText,
} from './components/ActionDetailSection';
import { ActionSpenderView } from './components/ActionSpenderView';
import { ProjectItemInDetail } from '../ProjectItemInDetail';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  account?: Account;
}

export const ApproveToken: React.FC<Props> = ({
  data,
  isSingleAddress,
  account,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const {
    actionData,
    requireData,
    approveAmount,
    approveUsdValue,
    isUnlimited,
    chain,
  } = useMemo(() => {
    const maxGasTx = data.maxGasTx;
    const actionData = maxGasTx.action!.actionData.approveToken!;
    const requireData = maxGasTx.action
      ?.requiredData as ApproveTokenRequireData;

    const amount = new BigNumber(actionData.token.raw_amount || '0').div(
      10 ** actionData.token.decimals,
    );
    const isUnlimited = amount.isGreaterThan(1e9);
    const approveAmount = isUnlimited
      ? t('page.transactions.detail.Unlimited')
      : formatTokenAmount(amount);

    const approveUsdValue = formatUsdValue(
      amount.times(actionData.token.price).toString(),
    );

    const chain =
      findChain({
        id: data.chainId,
      }) || undefined;
    return {
      maxGasTx,
      actionData,
      requireData,
      approveAmount,
      approveUsdValue,
      isUnlimited,
      chain,
    };
  }, [data.chainId, data.maxGasTx, t]);

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const list = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(list, account => account.address.toLowerCase());
  }, [list]);

  const txAccount = useMemo(() => {
    let account: KeyringAccountWithAlias | undefined;
    const canUseAccountList = accounts.filter(acc => {
      return (
        isSameAddress(acc.address, data.address) &&
        acc.type !== KEYRING_TYPE.WatchAddressKeyring
      );
    });
    if (data.keyringType) {
      account = canUseAccountList.find(acc => acc.type === data.keyringType);
    }
    if (!account) {
      account = findAccountByPriority(canUseAccountList);
    }
    return account;
  }, [accounts, data.address, data.keyringType]);

  const handleGotoTokenDetail = useMemoizedFn(() => {
    naviPush(RootNames.TokenDetail, {
      token: {
        ...tokenItemToITokenItem(actionData.token as TokenItem, ''),
        amount: 0,
      },
      account,
      needUseCacheToken: true,
      isSingleAddress,
    });
  });

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <TouchableOpacity onPress={handleGotoTokenDetail}>
            <View style={[styles.singleBox]}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <HistoryItemIcon
                  isInDetail={true}
                  type={HistoryItemCateType.Approve}
                  token={actionData.token}
                  isNft={false}
                />
                <View style={[styles.colomnBox]}>
                  {isUnlimited ? (
                    <>
                      <Text
                        style={[
                          styles.tokenAmountText,
                          styles.isSendTextColor,
                        ]}>
                        {approveAmount} {getTokenSymbol(actionData.token)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.tokenAmountText,
                          styles.isSendTextColor,
                        ]}>
                        {approveAmount}{' '}
                        {getTokenSymbol(actionData.token as TokenItem)}
                      </Text>
                      <Text style={styles.usdValue}>≈{approveUsdValue}</Text>
                    </>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <RcIconSingleArrow
                  width={26}
                  height={26}
                  color={colors2024['neutral-bg-2']}
                />
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.extraItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.ApproveTo')}
            </Text>
            <ActionSpenderView
              requireData={requireData}
              spender={actionData.spender}
              chain={chain}
            />
          </View>
        </View>
        <ActionDetailSection data={data} chain={chain} accounts={unionAccounts}>
          <ActionDetailItem label={t('page.transactions.detail.ApproveToken')}>
            <ActionDetailText>
              {isUnlimited ? (
                t('page.transactions.detail.Unlimited')
              ) : (
                <>
                  {approveAmount} {getTokenSymbol(actionData.token)}
                </>
              )}
            </ActionDetailText>
          </ActionDetailItem>
          <ProjectItemInDetail
            title={t('page.transactions.detail.InteractedContract')}
            name={getTokenSymbol(actionData.token)}
            logo={actionData.token.logo_url}
            address={actionData.token.id}
            chain={chain}
          />
        </ActionDetailSection>
      </ScrollView>
      {data.isPending ? null : (
        <RevokeTokenBtn
          token={actionData.token}
          spender={actionData.spender}
          account={txAccount}
        />
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  scrollView: {
    paddingHorizontal: 16,
  },
  colomnBox: {
    flexDirection: 'column',
  },
  isSendTextColor: {
    color: colors2024['neutral-title-1'],
  },
  card: {
    width: '100%',
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    borderRadius: 16,
  },
  singleBox: {
    justifyContent: 'space-between',
    alignContent: 'center',
    flexDirection: 'row',
    padding: 16,
  },
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  usdValue: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 2,
  },

  extraItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    borderRadius: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 12,
    marginBottom: 12,
  },
  itemTitleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    maxWidth: '45%',
  },
}));
