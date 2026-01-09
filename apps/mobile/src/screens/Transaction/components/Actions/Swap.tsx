/* eslint-disable react-native/no-inline-styles */
import { RcIconExternalLinkCC, RcIconRightCC } from '@/assets/icons/common';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { formatAmount } from '@/utils/number';
import { TransactionGroup } from '@/core/services/transactionHistory';

import RcIconSwitchArrow from '@/assets2024/icons/history/IconSwitchArrow.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssetAvatar } from '@/components/AssetAvatar';
import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { TransactionPendingDetail } from '@/screens/TransactionRecord/components/TransactionPendingDetail';
import { naviPush } from '@/utils/navigation';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { openTxExternalUrl } from '@/utils/transaction';
import { formatTokenAmount } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import {
  ParsedTransactionActionData,
  ReceiveTokenItem,
  SwapRequireData,
} from '@rabby-wallet/rabby-action';
import { useMemoizedFn } from 'ahooks';
import { unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { AddressItemInDetail, TxStatusItem } from '../../HistoryDetailScreen';
import { Button } from '@/components2024/Button';
import { CHAINS_ENUM } from '@/constant/chains';
import { StackActions } from '@react-navigation/native';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { ellipsisAddress } from '@/utils/address';
import { formatIntlTimestamp } from '@/utils/time';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/dist/types';
import { findAccountByPriority } from '@/utils/account';
import { Account } from '@/core/services/preference';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  account?: Account;
}

export const Swap: React.FC<Props> = ({ data, isSingleAddress, account }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const navigation = useRabbyAppNavigation();
  const { actionData, requireData, chain } = useMemo(() => {
    const chain =
      findChain({
        id: data.chainId,
      }) || undefined;

    if (!data.maxGasTx.action) {
      return {
        maxGasTx: data.maxGasTx,
        actionData: undefined,
        requireData: undefined,
        chain: chain,
      };
    }

    const maxGasTx = data.maxGasTx;
    const actionData = (maxGasTx.action!.actionData.swap ||
      maxGasTx.action!.actionData.wrapToken ||
      maxGasTx.action!.actionData.unWrapToken)!;
    const requireData = maxGasTx.action!.requiredData as SwapRequireData;
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

  const isFail = useMemo(
    () => data.isFailed || data.isSubmitFailed || data.isWithdrawed,
    [data.isFailed, data.isSubmitFailed, data.isWithdrawed],
  );

  const handleOpenTxId = useMemoizedFn(() => {
    const tx = data.maxGasTx.hash;

    if (chain?.scanLink) {
      openTxExternalUrl({ chain, txHash: tx });
    } else {
      toast.error('Unknown chain');
    }
  });

  const handleOpenTxAddress = useMemoizedFn((address: string) => {
    if (chain?.scanLink) {
      openTxExternalUrl({ chain, address });
    } else {
      toast.error('Unknown chain');
    }
  });

  const handleGotoDetail = useMemoizedFn((token: TokenItem) => {
    naviPush(RootNames.TokenDetail, {
      token: tokenItemToITokenItem(token, ''),
      needUseCacheToken: true,
      isSingleAddress,
      account,
    });
  });

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const fromAddrIsImported = useMemo(() => {
    return accounts.find(account =>
      isSameAddress(account.address, data.address || ''),
    );
  }, [accounts, data]);

  const receiveToken: ReceiveTokenItem | TokenItem | undefined = useMemo(() => {
    if (actionData && 'minReceive' in actionData) {
      return (
        (actionData?.minReceive as ReceiveTokenItem) ||
        actionData?.receiveToken ||
        data.maxGasTx.explain?.balance_change?.receive_token_list[0]
      );
    }
    return (
      actionData?.receiveToken ||
      data.maxGasTx.explain?.balance_change?.receive_token_list[0]
    );
  }, [actionData, data.maxGasTx.explain?.balance_change?.receive_token_list]);

  const payToken: TokenItem | undefined =
    actionData?.payToken ||
    data.maxGasTx.explain?.balance_change?.send_token_list[0];

  if (!chain) {
    return null;
  }

  const source = data.originTx?.$ctx?.ga?.source ?? '';

  const isLocalSwap = source === 'approvalAndSwap|swap' || source === 'swap';

  return (
    <>
      <ScrollView style={{ paddingHorizontal: 16 }}>
        <View style={[styles.doubleBox]}>
          <TouchableOpacity
            style={[styles.fromTokenBox]}
            onPress={() => handleGotoDetail(payToken!)}>
            <AssetAvatar
              logo={payToken?.logo_url}
              size={42}
              chain={payToken?.chain}
              chainSize={16}
            />
            <View style={[styles.rowBox, isFail && styles.isFailBox]}>
              <Text
                style={[styles.tokenAmountTextList, styles.isSendTextColor]}>
                {'-'} {formatTokenAmount(payToken?.amount ?? 0)}{' '}
                {getTokenSymbol(payToken as TokenItem)}
              </Text>
              <RcIconRightCC
                color={colors2024['neutral-foot']}
                width={18}
                height={18}
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toTokenBox]}
            onPress={() => handleGotoDetail(receiveToken!)}>
            <AssetAvatar
              logo={receiveToken?.logo_url}
              size={42}
              chain={receiveToken?.chain}
              chainSize={16}
            />
            <View style={[styles.rowBox, isFail && styles.isFailBox]}>
              <Text style={[styles.tokenAmountTextList]}>
                {'+'}{' '}
                {formatTokenAmount(
                  (receiveToken as ReceiveTokenItem)?.amount ||
                    (receiveToken as ReceiveTokenItem)?.min_amount,
                )}{' '}
                {getTokenSymbol(receiveToken as TokenItem)}
              </Text>
              <RcIconRightCC
                color={colors2024['green-default']}
                width={18}
                height={18}
              />
            </View>
          </TouchableOpacity>
          <View style={styles.iconSwitchArrow}>
            <RcIconSwitchArrow />
          </View>
        </View>
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

          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.InteractedContract')}
            </Text>
            <TouchableOpacity
              style={{ alignItems: 'flex-end' }}
              onPress={() => handleOpenTxAddress(requireData?.id || '')}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}>
                <AssetAvatar logo={requireData?.protocol?.logo_url} size={16} />
                <Text style={[styles.itemContentText]}>
                  {requireData?.protocol?.name}
                </Text>
                <RcIconJumpCC
                  width={14}
                  height={14}
                  color={colors2024['neutral-foot']}
                />
              </View>
              <Text style={styles.itemAddressText}>
                {ellipsisAddress(requireData?.id || '')}
              </Text>
            </TouchableOpacity>
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
      </ScrollView>
      {isLocalSwap && (
        <View style={[styles.buttonContainer, { paddingBottom: bottom + 27 }]}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={async () => {
                await switchSceneCurrentAccount(
                  'MakeTransactionAbout',
                  !isSingleAddress && fromAddrIsImported
                    ? fromAddrIsImported
                    : account || null,
                );
                navigation.dispatch(
                  StackActions.push(RootNames.StackTransaction, {
                    screen: !isSingleAddress
                      ? RootNames.MultiSwap
                      : RootNames.Swap,
                    params: {
                      swapAgain: true,
                      chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
                      swapTokenId: [
                        actionData?.payToken?.id,
                        actionData?.receiveToken?.id,
                      ],
                    },
                  }),
                );
              }}
              title={t('page.transactions.detail.SwapAgain')}
            />
          </View>
        </View>
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  detailContainer: {
    // flex: 1,
    width: '100%',
    marginTop: 12,
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
    backgroundColor: !isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
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
  rowBox: {
    alignItems: 'center',
    flexDirection: 'row',
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
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
    gap: 10,
  },
  toTokenBox: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
  },
  singleBox: {
    width: '100%',
    height: 92,
    backgroundColor: colors2024['neutral-bg-1'],
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
    backgroundColor: !isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    flexDirection: 'row',
    // height: 120,
    // marginTop: 12,
    bottom: 0,
    width: '100%',
    paddingTop: 20,
    paddingBottom: 27,
    alignItems: 'center',
    paddingHorizontal: 16,
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
