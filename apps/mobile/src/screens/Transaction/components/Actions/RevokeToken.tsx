/* eslint-disable react-native/no-inline-styles */
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { TransactionGroup } from '@/core/services/transactionHistory';

import { Text } from '@/components/Typography';
import { RootNames } from '@/constant/layout';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { naviPush } from '@/utils/navigation';
import { RevokeTokenApproveRequireData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn } from 'ahooks';
import { unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { HistoryItemIcon } from '../HistoryItemIcon';
import { HistoryItemCateType } from '../type';
import {
  ActionDetailItem,
  ActionDetailSection,
  ActionDetailText,
} from './components/ActionDetailSection';
import { ActionSpenderView } from './components/ActionSpenderView';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  account?: Account;
}

export const RevokeToken: React.FC<Props> = ({
  data,
  isSingleAddress,
  account,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const { actionData, requireData, chain } = useMemo(() => {
    const maxGasTx = data.maxGasTx;
    const actionData = maxGasTx.action!.actionData.revokeToken!;
    const requireData = maxGasTx.action
      ?.requiredData as RevokeTokenApproveRequireData;

    const chain =
      findChain({
        id: data.chainId,
      }) || undefined;
    return {
      maxGasTx,
      actionData,
      requireData,
      chain,
    };
  }, [data.chainId, data.maxGasTx]);

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const list = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(list, account => account.address.toLowerCase());
  }, [list]);

  const handleGotoTokenDetail = useMemoizedFn(() => {
    naviPush(RootNames.TokenDetail, {
      token: {
        ...tokenItemToITokenItem(actionData.token as TokenItem, ''),
        amount: 0,
      },
      needUseCacheToken: true,
      isSingleAddress,
      account,
    });
  });

  return (
    <>
      <TouchableOpacity onPress={handleGotoTokenDetail}>
        <View style={styles.card}>
          <View style={[styles.singleBox]}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HistoryItemIcon
                isInDetail={true}
                type={HistoryItemCateType.Revoke}
                token={actionData.token}
                isNft={false}
              />
              <View style={[styles.colomnBox]}>
                <Text style={[styles.tokenAmountText, styles.isSendTextColor]}>
                  {getTokenSymbol(actionData.token as TokenItem)}
                </Text>
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
          <View style={styles.extraItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.RevokeFrom')}
            </Text>
            <ActionSpenderView
              requireData={requireData}
              spender={actionData.spender}
              chain={chain}
            />
          </View>
        </View>
      </TouchableOpacity>
      <ActionDetailSection data={data} chain={chain} accounts={unionAccounts}>
        <ActionDetailItem label={t('page.transactions.detail.RevokeFrom')}>
          <ActionSpenderView
            requireData={requireData}
            spender={actionData.spender}
            chain={chain}
          />
        </ActionDetailItem>

        <ActionDetailItem label={t('page.transactions.detail.RevokeToken')}>
          <ActionDetailText>
            {getTokenSymbol(actionData.token)}
          </ActionDetailText>
        </ActionDetailItem>
      </ActionDetailSection>
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
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
    backgroundColor: colors2024['neutral-bg-2'],
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
