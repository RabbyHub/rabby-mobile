/* eslint-disable react-native/no-inline-styles */
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { SendAction, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { TransactionGroup } from '@/core/services/transactionHistory';

import { RootNames } from '@/constant/layout';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { naviPush } from '@/utils/navigation';
import { SendRequireData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import { unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { AddressItemInDetail } from '../../HistoryDetailScreen';
import { HistoryItemIcon } from '../HistoryItemIcon';
import { Button } from '@/components2024/Button';
import { HistoryItemCateType } from '../type';
import { CHAINS_ENUM } from '@/constant/chains';
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
import { Text } from '@/components/Typography';
import {
  ActionDetailItem,
  ActionDetailSection,
} from './components/ActionDetailSection';
import { ProjectItemInDetail } from '../ProjectItemInDetail';

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
  const { styles, colors2024 } = useTheme2024({ getStyle });

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

  const accountSelectCtx = useAccountSelectModalCtx();
  const handleGotoTokenDetail = useMemoizedFn(() => {
    if (accountSelectCtx.isUnderContext) accountSelectCtx.fnCloseModal();
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

  const isNativeToken =
    actionData.token?.id && actionData.token.id === chain?.nativeTokenAddress;

  console.log('Send render', { data });

  const ViewComp = accountSelectCtx.isUnderContext
    ? BottomSheetScrollView
    : ScrollView;

  return (
    <>
      <ViewComp
        style={{ paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          accountSelectCtx.isUnderContext && styles.inModalBsContainer,
          accountSelectCtx.isUnderContext && {
            paddingBottom: safeSizes.inModalContainerPb,
          },
        ]}>
        <View style={styles.card}>
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
                  width: 26,
                }}>
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
              {t('page.transactions.detail.To')}
            </Text>
            <AddressItemInDetail
              address={actionData.to}
              accounts={unionAccounts}
              // disableNavigate={isUnderModalContext}
            />
          </View>
        </View>
        <ActionDetailSection data={data} chain={chain} accounts={unionAccounts}>
          {isNativeToken ? (
            <ActionDetailItem label={t('page.transactions.detail.To')}>
              <AddressItemInDetail
                address={actionData.to}
                accounts={unionAccounts}
                // disableNavigate={isUnderModalContext}
              />
            </ActionDetailItem>
          ) : (
            <ProjectItemInDetail
              title={t('page.transactions.detail.InteractedContract')}
              name={getTokenSymbol(actionData.token)}
              logo={actionData.token.logo_url}
              address={actionData.token.id}
              chain={chain}
            />
          )}
        </ActionDetailSection>
      </ViewComp>
      <View
        style={[
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
            : styles.buttonContainer,
        ]}>
        <View
          style={[
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

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
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
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      marginTop: 2,
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
      maxWidth: '100%',
      ...(IS_ANDROID && {
        width: '75%',
      }),
    },
    buttonContainer: {
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: Math.max(safeAreaInsets.bottom, 36),
      backgroundColor: !isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
    },
    inModalButtonContainer: {
      backgroundColor: !isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      flexDirection: 'row',
      paddingBottom: SIZES.bottomContentBottom,
      alignItems: 'center',
      paddingHorizontal: 16,
      position: 'absolute',
      marginTop: 0,
      width: '100%',
      height:
        SIZES.containerPt + SIZES.buttonHeight + SIZES.bottomContentBottom,
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
