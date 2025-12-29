/* eslint-disable react-native/no-inline-styles */
import { RcIconExternalLinkCC } from '@/assets/icons/common';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import {
  formatAmount,
  formatTokenAmount,
  formatUsdValue,
} from '@/utils/number';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { SendAction, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { TransactionGroup } from '@/core/services/transactionHistory';

import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { TransactionPendingDetail } from '@/screens/TransactionRecord/components/TransactionPendingDetail';
import { ellipsisAddress } from '@/utils/address';
import { naviPush } from '@/utils/navigation';
import { openTxExternalUrl } from '@/utils/transaction';
import { SendRequireData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import { unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { AddressItemInDetail, TxStatusItem } from '../../HistoryDetailScreen';
import { HistoryItemIcon } from '../HistoryItemIcon';
import { Button } from '@/components2024/Button';
import { HistoryItemCateType } from '../type';
import { CHAINS_ENUM } from '@/constant/chains';
import { formatIntlTimestamp } from '@/utils/time';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { useWhitelist } from '@/hooks/whitelist';
import { Tip } from '@/components/Tip';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Account } from '@/core/services/preference';
import { findAccountByPriority } from '@/utils/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import {
  useAccountSelectModalCtx,
  useIsUnderAccountSelectModalContext,
} from '@/components/AccountSelectModalTx/hooks';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  onPressAddToWhitelistButton?: (data: SendAction) => void;
  account?: Account;
}

export const Send: React.FC<Props> = ({
  data,
  isSingleAddress,
  onPressAddToWhitelistButton,
  account,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { safeSizes } = useSafeAndroidBottomSizes({
    inModalContainerPb:
      SIZES.buttonHeight + SIZES.containerPb + SIZES.bottomContentBottom,
    // inModalButtonContainerPt: SIZES.containerPt,
    inModalButtonContainerHeight:
      SIZES.containerPt +
      SIZES.buttonHeight +
      SIZES.containerPb +
      SIZES.bottomContentBottom,
    inModalButtonContainerBottom: SIZES.bottomContentBottom,
  });
  const { t } = useTranslation();
  const { actionData, sendAmount, sendUsdValue, chain } = useMemo(() => {
    const maxGasTx = data.maxGasTx;
    const actionData = maxGasTx.action!.actionData.send!;
    const requireData = maxGasTx.action?.requiredData as SendRequireData;

    const amount = new BigNumber(actionData.token.raw_amount || '0').div(
      10 ** actionData.token.decimals,
    );
    const sendAmount = formatTokenAmount(amount);

    const sendUsdValue = formatUsdValue(
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
      sendAmount,
      sendUsdValue,
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

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const { isAddrOnWhitelist } = useWhitelist();

  const handleOpenTxId = useMemoizedFn(() => {
    const tx = data.maxGasTx.hash;

    if (chain?.scanLink) {
      openTxExternalUrl({ chain, txHash: tx });
    } else {
      toast.error('Unknown chain');
    }
  });

  const accountSelectCtx = useAccountSelectModalCtx();
  const handleGotoTokenDetail = useMemoizedFn(() => {
    if (accountSelectCtx.isUnderContext) accountSelectCtx.fnCloseModal();
    naviPush(RootNames.TokenDetail, {
      token: tokenItemToITokenItem(actionData.token, ''),
      needUseCacheToken: true,
      isSingleAddress,
      account,
    });
  });

  const ViewComp = accountSelectCtx.isUnderContext
    ? BottomSheetScrollView
    : ScrollView;

  return (
    <>
      <ViewComp
        style={{ paddingHorizontal: 16 }}
        contentContainerStyle={[
          accountSelectCtx.isUnderContext && styles.inModalBsContainer,
          accountSelectCtx.isUnderContext && {
            paddingBottom: safeSizes.inModalContainerPb,
          },
        ]}>
        <TouchableOpacity onPress={handleGotoTokenDetail}>
          <View style={[styles.singleBox]}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                flexShrink: 1,
              }}>
              <HistoryItemIcon
                isInDetail={true}
                type={HistoryItemCateType.Send}
                token={actionData.token}
                isNft={false}
              />
              <View style={[styles.colomnBox]}>
                <View style={styles.tokenSymbolBox}>
                  <Text
                    style={[styles.tokenAmountText, styles.isSendTextColor]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    - {sendAmount}{' '}
                    {/* {getTokenSymbol(actionData.token as TokenItem).repeat(__DEV__ ? 1000 : 1)} */}
                    {getTokenSymbol(actionData.token as TokenItem).repeat(1)}
                  </Text>
                </View>
                <Text style={styles.usdValue}>≈{sendUsdValue}</Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexShrink: 0,
                width: 32,
              }}>
              <RcIconSingleArrow
                width={32}
                height={32}
                color={colors2024['neutral-bg-2']}
              />
            </View>
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
              // disableNavigate={isUnderModalContext}
            />
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.To')}
            </Text>
            <AddressItemInDetail
              address={actionData.to}
              accounts={unionAccounts}
              // disableNavigate={isUnderModalContext}
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
      </ViewComp>
      <View
        style={[
          styles.buttonContainer,
          accountSelectCtx.isUnderContext
            ? StyleSheet.flatten([
                styles.inModalButtonContainer,
                {
                  paddingTop: SIZES.containerPt,
                  height: safeSizes.inModalButtonContainerHeight,
                  bottom: IS_ANDROID
                    ? safeSizes.inModalButtonContainerBottom
                    : 0,
                },
              ])
            : {},
        ]}>
        <View
          style={[
            { flex: 1 },
            accountSelectCtx.isUnderContext && styles.inModalButtonInner,
            // accountSelectCtx.isUnderContext && { height: safeSizes.inModalButtonContainerHeight }
          ]}>
          {isAddrOnWhitelist(actionData.to) && onPressAddToWhitelistButton ? (
            <Tip content={t('page.whitelist.alreadyIn')}>
              <Button
                disabled
                title={t('page.transactions.detail.AddToWhitelist')}
              />
            </Tip>
          ) : (
            <Button
              containerStyle={[
                accountSelectCtx.isUnderContext && {
                  height: SIZES.buttonHeight,
                },
              ]}
              onPress={async () => {
                if (onPressAddToWhitelistButton) {
                  onPressAddToWhitelistButton(actionData);
                  return;
                }
                const canUseAccountList = accounts.filter(acc => {
                  return (
                    addressUtils.isSameAddress(
                      acc.address,
                      data.maxGasTx.address || '',
                    ) && acc.type !== KEYRING_TYPE.WatchAddressKeyring
                  );
                });
                const fromAccount = findAccountByPriority(canUseAccountList);
                if (!isSingleAddress && fromAccount) {
                  await switchSceneCurrentAccount(
                    'MakeTransactionAbout',
                    fromAccount,
                  );
                }
                naviPush(RootNames.StackTransaction, {
                  screen: RootNames.Send,
                });
              }}
              title={
                onPressAddToWhitelistButton
                  ? t('page.transactions.detail.AddToWhitelist')
                  : t('page.transactions.detail.SendAgain')
              }
            />
          )}
        </View>
      </View>
    </>
  );
};

const SIZES = {
  buttonHeight: 56,
  // bottomAreaPt: 0,
  bottomContentBottom: IS_IOS ? 48 : 48,
  containerPt: 12,
  containerPb: 12,
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
  inModalBsContainer: {
    // flexShrink: 1,
    paddingBottom: SIZES.buttonHeight + 12,
    justifyContent: 'flex-end',
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
    overflow: 'hidden',
    width: '100%',
  },
  tokenSymbolBox: {
    flexDirection: 'row',
    ...(IS_IOS
      ? {
          maxWidth: '70%',
        }
      : {
          width: '100%',
        }),
  },
  usdValue: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 4,
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
    maxWidth: '100%',
    ...(IS_ANDROID && {
      width: '75%',
    }),
  },
  mutliBox: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'center',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
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
    paddingTop: 0,
    marginTop: 16,
    bottom: 0,
    width: '100%',
    paddingBottom: SIZES.bottomContentBottom,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inModalButtonContainer: {
    position: 'absolute',
    marginTop: 0,
    width: '100%',
    height: SIZES.containerPt + SIZES.buttonHeight + SIZES.bottomContentBottom,
    bottom: SIZES.bottomContentBottom,
    // ...makeDebugBorder(),
    paddingTop: SIZES.containerPt,
  },
  inModalButtonInner: {
    height: '100%',
    width: '100%',
    flex: 0,
    // ...makeDebugBorder('yellow'),
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
