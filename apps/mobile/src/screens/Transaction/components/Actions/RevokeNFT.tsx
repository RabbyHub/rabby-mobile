/* eslint-disable react-native/no-inline-styles */
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { TransactionGroup } from '@/core/services/transactionHistory';

import { RootNames } from '@/constant/layout';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { naviPush } from '@/utils/navigation';
import { RevokeNFTRequireData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn } from 'ahooks';
import { unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { HistoryItemIcon } from '../HistoryItemIcon';
import { HistoryItemCateType } from '../type';
import { Account } from '@/core/services/preference';
import { Text } from '@/components/Typography';
import { ActionDetailSection } from './components/ActionDetailSection';
import { ActionSpenderView } from './components/ActionSpenderView';
import { ProjectItemInDetail } from '../ProjectItemInDetail';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  account?: Account;
}

export const RevokeNFT: React.FC<Props> = ({
  data,
  isSingleAddress,
  account,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const { actionData, requireData, chain } = useMemo(() => {
    const maxGasTx = data.maxGasTx;
    const actionData = maxGasTx.action!.actionData.revokeNFT!;
    const requireData = maxGasTx.action?.requiredData as RevokeNFTRequireData;

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
  }, [data]);

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const list = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(list, account => account.address.toLowerCase());
  }, [list]);

  const handleGotoDetail = useMemoizedFn(() => {
    naviPush(RootNames.NftDetail, {
      token: actionData.nft,
      isSingleAddress,
      account,
    });
  });

  if (!chain) {
    return null;
  }

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handleGotoDetail}>
          <View style={styles.card}>
            <View style={[styles.singleBox]}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <HistoryItemIcon
                  isInDetail={true}
                  type={HistoryItemCateType.Revoke}
                  token={actionData.nft as unknown as TokenItem}
                  isNft={true}
                />
                <View style={[styles.colomnBox]}>
                  <>
                    <Text
                      style={[styles.tokenAmountText, styles.isSendTextColor]}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {/* todo amount */}
                      {actionData?.nft?.amount || 1} NFT
                    </Text>
                  </>
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
                type="nftSpender"
              />
            </View>
          </View>
        </TouchableOpacity>
        <ActionDetailSection data={data} chain={chain} accounts={unionAccounts}>
          {/* <ActionDetailItem label={t('page.transactions.detail.name')}>
            <ActionDetailText numberOfLines={1} ellipsizeMode="tail">
              {actionData?.nft?.name || '-'}
            </ActionDetailText>
          </ActionDetailItem> */}
          <ProjectItemInDetail
            title={t('page.transactions.detail.InteractedContract')}
            name={actionData.nft?.collection?.name}
            logo={actionData.nft?.collection?.logo_url}
            address={actionData.nft?.contract_id}
            chain={chain}
          />
        </ActionDetailSection>
      </ScrollView>
    </>
  );
};

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    scrollView: {
      paddingHorizontal: 16,
      paddingBottom: Math.max(safeAreaInsets.bottom, 24),
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
      fontWeight: '800',
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
  }),
);
