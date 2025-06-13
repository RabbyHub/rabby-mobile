/* eslint-disable react-native/no-inline-styles */
import { RcIconExternalLinkCC, RcIconRightCC } from '@/assets/icons/common';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { TransactionGroup } from '@/core/services/transactionHistory';

import ViewMore from '@/components/Approval/components/Actions/components/ViewMore';
import { AssetAvatar } from '@/components/AssetAvatar';
import { toast } from '@/components2024/Toast';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { TransactionPendingDetail } from '@/screens/TransactionRecord/components/TransactionPendingDetail';
import { ellipsisAddress } from '@/utils/address';
import { openTxExternalUrl } from '@/utils/transaction';
import { ApproveNFTRequireData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn } from 'ahooks';
import { unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { AddressItemInDetail, TxStatusItem } from '../../HistoryDetailScreen';
import { HistoryItemIcon } from '../HistoryItemIcon';
import { HistoryItemCateType } from '../type';
import { RevokeNFTCollectionBtn } from './components/RevokeNFTCollectionBtn';
import { formatIntlTimestamp } from '@/utils/time';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { findAccountByPriority } from '@/utils/account';
import { formatAmount } from '@/utils/number';
import { Account } from '@/core/services/preference';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  account?: Account;
}

export const ApproveNFTCollection: React.FC<Props> = ({
  data,
  isSingleAddress,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const { actionData, requireData, chain } = useMemo(() => {
    const maxGasTx = data.maxGasTx;
    const actionData = maxGasTx.action!.actionData.approveNFTCollection!;
    const requireData = maxGasTx.action?.requiredData as ApproveNFTRequireData;

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

  const handleOpenTxId = useMemoizedFn(() => {
    const tx = data.maxGasTx.hash;

    if (chain?.scanLink) {
      openTxExternalUrl({ chain, txHash: tx });
    } else {
      toast.error('Unknown chain');
    }
  });

  // const handleGotoDetail = useMemoizedFn(() => {
  //   naviPush(RootNames.NftDetail, {
  //     token: actionData.nft,
  //     isSingleAddress,
  //   });
  // });

  if (!chain) {
    return null;
  }

  return (
    <>
      <TouchableOpacity>
        <View style={[styles.singleBox]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* todo  */}
            <HistoryItemIcon
              isInDetail={true}
              type={HistoryItemCateType.Approve}
              token={
                {
                  ...actionData.collection,
                  content: (actionData.collection as any)?.logo_url,
                } as unknown as TokenItem
              }
              isNft={true}
            />
            <View style={[styles.colomnBox]}>
              <>
                <Text
                  style={[styles.tokenAmountText, styles.isSendTextColor]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  1 NFT Collection
                </Text>
              </>
            </View>
          </View>
          {/* <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RcIconSingleArrow
              width={32}
              height={32}
              color={colors2024['neutral-bg-2']}
            />
          </View> */}
        </View>
      </TouchableOpacity>
      <View style={styles.detailContainer}>
        {!data.isPending && data.maxGasTx.completedAt && (
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.Date')}
            </Text>
            <View>
              <Text style={styles.itemContentText}>
                {formatIntlTimestamp(data?.maxGasTx.completedAt)}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {t('page.transactions.detail.Status')}
          </Text>
          <View>
            <TxStatusItem
              status={data.isFailed ? 0 : 1}
              isPending={data.isPending}
              withText={true}
            />
          </View>
        </View>
        {data.isPending ? <TransactionPendingDetail data={data} /> : null}

        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {t('page.transactions.detail.ApproveTo')}
          </Text>
          <ViewMore
            type="nftSpender"
            data={{
              ...requireData,
              spender: actionData.spender,
              chain,
            }}>
            <View style={{ alignItems: 'flex-end' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}>
                <AssetAvatar logo={requireData?.protocol?.logo_url} size={16} />
                <Text style={[styles.itemContentText]}>
                  {requireData?.protocol?.name || t('global.Unknown')}
                </Text>
                <RcIconRightCC
                  width={14}
                  height={14}
                  color={colors2024['neutral-foot']}
                />
              </View>
              <Text style={styles.itemAddressText}>
                {ellipsisAddress(actionData.spender)}
              </Text>
            </View>
          </ViewMore>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {t('page.transactions.detail.name')}
          </Text>
          <Text
            style={styles.itemContentText}
            numberOfLines={1}
            ellipsizeMode="tail">
            {actionData?.collection?.name || '-'}
          </Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {t('page.transactions.detail.Chain')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <ChainIconImage
              size={16}
              chainEnum={chain?.enum}
              isShowRPCStatus={true}
            />
            <Text style={[styles.itemContentText]}>{chain?.name}</Text>
          </View>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {t('page.transactions.detail.From')}
          </Text>
          <AddressItemInDetail
            address={data.maxGasTx.address}
            accounts={unionAccounts}
          />
        </View>

        {Boolean(data.maxGasTx?.gasUSDValue) && (
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.GasFee')}
            </Text>
            <Text style={styles.itemContentText}>
              {formatAmount(data.maxGasTx?.gasTokenCount!)}{' '}
              {data.maxGasTx?.gasTokenSymbol || ''} ($
              {formatAmount(data.maxGasTx?.gasUSDValue ?? 0)})
            </Text>
          </View>
        )}

        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>Hash</Text>
          <TouchableOpacity
            disabled={!chain?.scanLink}
            onPress={handleOpenTxId}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={[styles.itemContentText]}>
              {ellipsisAddress(data.maxGasTx.hash!)}
            </Text>
            <RcIconExternalLinkCC
              width={14}
              height={14}
              color={colors2024['neutral-foot']}
            />
          </TouchableOpacity>
        </View>
      </View>
      {data.isPending ? null : (
        <RevokeNFTCollectionBtn
          collection={actionData.collection}
          spender={actionData.spender}
          account={txAccount}
        />
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  detailContainer: {
    // flex: 1,
    width: '100%',
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
  },
  ghostButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
  },
  primaryButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['brand-default'],
  },
  primaryTitle: {
    color: colors2024['brand-default'],
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
  },
  iconSwitchArrow: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 200,
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
  },
  tokenAmountTextList: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  colomnBox: {
    flexDirection: 'column',
  },
  isSendTextColor: {
    color: colors2024['neutral-title-1'],
  },
  isFailBox: {
    opacity: 0.3,
  },
  image: {
    width: 46,
    height: 46,
  },
  fromTokenBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
    gap: 10,
  },
  toTokenBox: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
  },
  singleBox: {
    width: '100%',
    height: 92,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    justifyContent: 'space-between',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'row',
  },
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  usdValue: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 4,
  },
  mutliBox: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'center',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    // flexDirection: 'row',
    gap: 12,
  },
  doubleBox: {
    justifyContent: 'center',
    alignContent: 'center',
    flexDirection: 'row',
    height: 110,
    gap: 10,
    position: 'relative',
  },

  buttonContainer: {
    position: 'absolute',
    flexDirection: 'row',
    height: 60,
    bottom: 40,
    width: '100%',
    gap: 16,
    left: 16,
  },
  itemAliaName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  itemAddressText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  itemContentText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  headerTitleStyle: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },

  statuItemText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 4,
  },

  headerItem: {},
}));
