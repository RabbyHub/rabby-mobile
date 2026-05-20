/* eslint-disable react-native/no-inline-styles */
import { RcIconRightCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { Dimensions, ScrollView, TouchableOpacity, View } from 'react-native';
import { TransactionGroup } from '@/core/services/transactionHistory';

import RcIconSwitchArrow from '@/assets2024/icons/history/IconSwitchArrow.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssetAvatar } from '@/components/AssetAvatar';
import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
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
import { Button } from '@/components2024/Button';
import { CHAINS_ENUM } from '@/constant/chains';
import { StackActions } from '@react-navigation/native';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { ellipsisAddress } from '@/utils/address';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/dist/types';
import { findAccountByPriority } from '@/utils/account';
import { Account } from '@/core/services/preference';
import { Text } from '@/components/Typography';
import { HistoryItemTokenPrice } from '../HistoryItemTokenPrice';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { ellipsisOverflowedText } from '@/utils/text';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import {
  ActionDetailItem,
  ActionDetailSection,
} from './components/ActionDetailSection';
import { ProjectItemInDetail } from '../ProjectItemInDetail';

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

    if (!data.maxGasTx?.action) {
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

  const handleOpenTxAddress = useMemoizedFn((address: string) => {
    if (chain?.scanLink) {
      openTxExternalUrl({ chain, address });
    } else {
      toast.error('Unknown chain');
    }
  });

  const handleGotoDetail = useMemoizedFn((token: TokenItem) => {
    naviPush(RootNames.TokenDetail, {
      token: {
        ...tokenItemToITokenItem(token as TokenItem, ''),
        amount: 0,
      },
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
        data.maxGasTx?.explain?.balance_change?.receive_token_list[0]
      );
    }
    return (
      actionData?.receiveToken ||
      data.maxGasTx?.explain?.balance_change?.receive_token_list[0]
    );
  }, [actionData, data.maxGasTx?.explain?.balance_change?.receive_token_list]);

  const payToken: TokenItem | undefined =
    actionData?.payToken ||
    data.maxGasTx?.explain?.balance_change?.send_token_list[0];

  if (!chain) {
    return null;
  }

  const source = data.originTx?.$ctx?.ga?.source ?? '';

  const isLocalSwap = source === 'approvalAndSwap|swap' || source === 'swap';

  console.log('Swap actionData', data, actionData);

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.doubleBox]}>
          <Text style={styles.swapTitle}>{t('global.from')}</Text>
          <View style={[styles.swapBoxContainer, { marginBottom: 16 }]}>
            {([payToken].filter(Boolean) as TokenItem[]).map(token => {
              const tokenIsNft = token?.id?.length === 32;
              return (
                <TouchableOpacity
                  onPress={() => handleGotoDetail(token as TokenItem)}>
                  <View style={[styles.swapBox]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                      {tokenIsNft ? (
                        <Media
                          failedPlaceholder={
                            <IconDefaultNFT width={45} height={45} />
                          }
                          type="image_url"
                          src={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          thumbnail={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          mediaStyle={styles.media}
                          style={styles.media}
                          playIconSize={12}
                        />
                      ) : (
                        <AssetAvatar
                          logo={(token as TokenItem)?.logo_url || ''}
                          size={45}
                        />
                      )}
                      <View
                        style={[
                          styles.singleColomnBox,
                          isFail && styles.isFailBox,
                        ]}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tokenAmountText,
                            styles.isSendTextColor,
                          ]}>
                          - {formatTokenAmount(token.amount)}{' '}
                          {tokenIsNft
                            ? t('page.singleHome.sectionHeader.Nft')
                            : ellipsisOverflowedText(
                                getTokenSymbol(token as TokenItem),
                                16,
                              )}
                        </Text>
                        <HistoryItemTokenPrice
                          singlePrice={token?.price}
                          amount={token.amount}
                          style={styles.tokenPriceText}
                        />
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
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
              );
            })}
          </View>
          <Text style={styles.swapTitle}>{t('global.to')}</Text>
          <View style={styles.swapBoxContainer}>
            {([receiveToken].filter(Boolean) as TokenItem[]).map(token => {
              const tokenIsNft = token.id?.length === 32;
              return (
                <TouchableOpacity
                  onPress={() => handleGotoDetail(token as TokenItem)}>
                  <View style={[styles.swapBox]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                      {tokenIsNft ? (
                        <Media
                          failedPlaceholder={
                            <IconDefaultNFT width={45} height={45} />
                          }
                          type="image_url"
                          src={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          thumbnail={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          mediaStyle={styles.media}
                          style={styles.media}
                          playIconSize={12}
                        />
                      ) : (
                        <AssetAvatar
                          logo={(token as TokenItem)?.logo_url || ''}
                          size={45}
                        />
                      )}
                      <View
                        style={[
                          styles.singleColomnBox,
                          isFail && styles.isFailBox,
                        ]}>
                        <Text
                          numberOfLines={1}
                          style={[styles.tokenAmountText]}>
                          + {formatTokenAmount(token.amount)}{' '}
                          {tokenIsNft
                            ? t('page.singleHome.sectionHeader.Nft')
                            : ellipsisOverflowedText(
                                getTokenSymbol(token as TokenItem),
                                16,
                              )}
                        </Text>
                        <HistoryItemTokenPrice
                          singlePrice={token?.price}
                          amount={token.amount}
                          style={styles.tokenPriceText}
                        />
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
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
              );
            })}
          </View>
        </View>
        <ActionDetailSection data={data} chain={chain} accounts={unionAccounts}>
          <ProjectItemInDetail
            title={t('page.transactions.detail.InteractedContract')}
            name={requireData?.protocol?.name}
            logo={requireData?.protocol?.logo_url}
            address={requireData?.id}
            chain={chain}
          />
        </ActionDetailSection>
      </ScrollView>
      {isLocalSwap && (
        <View style={[styles.buttonContainer]}>
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
                    ? RootNames.MultiSwapBridge
                    : RootNames.SwapBridge,
                  params: {
                    activeTab: 'swap',
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
      )}
    </>
  );
};

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    scrollView: {
      paddingHorizontal: 16,
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
      // height: 92,
      backgroundColor: colors2024['neutral-bg-1'],
      justifyContent: 'space-between',
      alignContent: 'center',
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
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
      marginTop: 4,
    },
    doubleBox: {
      justifyContent: 'center',
      alignContent: 'center',
      flexDirection: 'column',
      position: 'relative',

      backgroundColor: !isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
      borderRadius: 16,
      padding: 16,
    },
    swapTitle: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      marginBottom: 8,
    },
    singleColomnBox: {
      // flex: 1,
      width: Dimensions.get('window').width - 160,
      flexDirection: 'column',
      // alignItems: 'center',
    },
    swapBoxContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    },
    swapBox: {
      width: '100%',
      justifyContent: 'space-between',
      alignContent: 'center',
      flexDirection: 'row',
    },

    tokenPriceText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
    },

    media: {
      width: 33,
      height: 33,
      borderRadius: 4,
    },

    buttonContainer: {
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: Math.max(safeAreaInsets.bottom, 36),
      backgroundColor: !isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
    },
    itemAddressText: {
      color: colors2024['neutral-secondary'],
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
  }),
);
