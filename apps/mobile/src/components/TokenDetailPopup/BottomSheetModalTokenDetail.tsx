import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Platform,
  ViewStyle,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { last } from 'lodash';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDevOnlyStyle } from '@/utils/styles';
import { RcIconCopyRegularCC, RcIconJumpCC } from '@/assets/icons/common';
import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
  BottomSheetProps,
} from '@gorhom/bottom-sheet';
import {
  TokenItem,
  TxDisplayItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import { KeyringAccountWithAlias } from '@/hooks/account';
// import { AbstractPortfolioToken } from '@/screens/home/types';
import { useInfiniteScroll, useMemoizedFn } from 'ahooks';
import { HistoryItem } from '@/components/TokenDetailPopup/HistoryItem';

import { makeDebugBorder } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { SMALL_TOKEN_ID, abstractTokenToTokenItem } from '@/utils/token';
import { AppBottomSheetModal, AssetAvatar, Button, Tip } from '@/components';
import { ChainIconFastImage } from '@/components/Chain/ChainIconImage';
import {
  CopyAddressIcon,
  CopyAddressIconType,
} from '@/components/AddressViewer/CopyAddress';
import { findChain, findChainByServerID, getChain } from '@/utils/chain';
import { getTokenSymbol } from '@/utils/token';
import { useTranslation } from 'react-i18next';
import { ellipsisOverflowedText } from '@/utils/text';
import { ellipsisAddress } from '@/utils/address';
import TouchableView from '@/components/Touchable/TouchableView';
import {
  SkeletonHistoryListOfTokenDetail,
  SkeletonTokenDetailHeader,
} from './Skeleton';
import { NotFoundHolder } from '@/components/EmptyHolder/NotFound';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { CHAINS_ENUM } from '@debank/common';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { TOKEN_DETAIL_HISTORY_SIZES } from './layout';
import AutoLockView from '../AutoLockView';
import { BlockedButton } from './BlockedButton';
import { Account, Token } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useManageTokenList } from '@/screens/Home/hooks/useManageToken';
import { useManageTestnetTokenList } from '@/screens/Home/hooks/useManageTestnetToken';
import { CustomizedSwitch } from './CustomizedSwitch';
import { apiCustomTestnet } from '@/core/apis';
import { openTxExternalUrl } from '@/utils/transaction';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { AbstractPortfolioToken } from '@/screens/Home/types';

const PAGE_COUNT = 10;

const SIZES = TOKEN_DETAIL_HISTORY_SIZES;

const TokenDetailHeader = React.memo(
  ({
    token,
    style,
    logoStyle,
    isAdded,
    setIsAdded,
  }: // onSmallTokenPress,
  // onTokenPress,
  {
    token: AbstractPortfolioToken;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    showHistory?: boolean;
    isAdded: boolean;
    setIsAdded: (isAdded: boolean) => void;
    // onSmallTokenPress?(token: AbstractPortfolioToken): void;
    // onTokenPress?(token: AbstractPortfolioToken): void;
  }) => {
    const { t } = useTranslation();
    const { colors, styles } = useThemeStyles(getTokenDetailHeaderStyle);

    const { isContractToken, nativeTokenChainName, tokenAddress, chainItem } =
      React.useMemo(() => {
        const item = findChain({ serverId: token.chain });
        /* for AbstractPortfolioToken,
          id of native token is `{chain.symbol}{chain.symbol}`,
          id of non-native token is `{token_address}{chain.symbol}  */
        // const isContractToken = /^0x.{40}/.test(token.id) && token.id.endsWith(token.chain);
        const isContractToken =
          /^0x.{40}/.test(token._tokenId) &&
          token.id === `${token._tokenId}${token.chain}`;

        return {
          chainItem: item,
          isContractToken,
          nativeTokenChainName: !isContractToken && item ? item.name : '',
          tokenAddress: !isContractToken
            ? item?.nativeTokenAddress || ''
            : token._tokenId,
        };
      }, [token]);

    const isNativeToken = !/^0x.{40}$/.test(token?._tokenId || '');

    const copyAddressIconRef = React.useRef<CopyAddressIconType>(null);

    const {
      addCustomToken,
      addBlockedToken,
      removeBlockedToken,
      removeCustomToken,
    } = useManageTokenList();

    const {
      addCustomToken: addTestnetCustomToken,
      removeCustomToken: removeTestnetCustomToken,
    } = useManageTestnetTokenList();

    const handleAddToken = useMemoizedFn(
      (tokenWithAmount: AbstractPortfolioToken) => {
        if (!tokenWithAmount) {
          return;
        }
        setIsAdded(true);
        if (chainItem?.isTestnet) {
          addTestnetCustomToken(tokenWithAmount);
        } else {
          if (tokenWithAmount.is_core) {
            addBlockedToken(tokenWithAmount);
          } else {
            addCustomToken(tokenWithAmount);
          }
        }
      },
    );

    const handleRemoveToken = useMemoizedFn(
      (tokenWithAmount: AbstractPortfolioToken) => {
        if (!tokenWithAmount) {
          return;
        }
        setIsAdded(false);

        if (chainItem?.isTestnet) {
          removeTestnetCustomToken(tokenWithAmount);
        } else {
          if (tokenWithAmount?.is_core) {
            removeBlockedToken(tokenWithAmount);
          } else {
            removeCustomToken(tokenWithAmount);
          }
        }
      },
    );

    return (
      <View style={[styles.tokenDetailHeaderWrap, style]}>
        <View style={styles.tokenDetailHeaderF1}>
          {token?.id === SMALL_TOKEN_ID ? (
            <Image
              source={require('@/assets/icons/assets/small-token.png')}
              style={styles.tokenDetailHeaderLogo}
            />
          ) : (
            <AssetAvatar
              logo={token?.logo_url}
              // chain={token?.chain}
              // chainSize={16}
              style={[styles.tokenDetailHeaderLogo, logoStyle]}
              size={SIZES.headerTokenLogo}
            />
          )}
          <Text
            style={[
              styles.tokenSymbol,
              token.id === SMALL_TOKEN_ID && styles.smallTokenSymbol,
            ]}>
            {ellipsisOverflowedText(getTokenSymbol(token), 8)}
          </Text>
          <View style={styles.tokenAddrInfo}>
            <ChainIconFastImage
              style={styles.tokenChainIcon}
              size={14}
              chainServerId={token.chain}
            />
            {!isContractToken && nativeTokenChainName && (
              <>
                <Text style={[styles.tokenChainNameText]}>
                  {nativeTokenChainName}
                </Text>
              </>
            )}
            {isContractToken && tokenAddress && (
              <View style={[styles.tokenAddressWrapper]}>
                <Text style={[styles.tokenAddressText]}>
                  {ellipsisAddress(tokenAddress)}
                </Text>
                <TouchableView
                  style={[styles.tokenTouchIcon, { marginRight: 6 }]}
                  onPress={() => {
                    openTxExternalUrl({
                      chain: chainItem,
                      address: tokenAddress,
                    });
                  }}>
                  <RcIconJumpCC
                    width={14}
                    height={14}
                    style={styles.jumpIcon}
                  />
                </TouchableView>
                <TouchableView
                  style={[styles.tokenTouchIcon]}
                  onPress={evt => {
                    copyAddressIconRef.current?.doCopy(evt);
                  }}>
                  <CopyAddressIcon
                    ref={copyAddressIconRef}
                    address={tokenAddress}
                    style={styles.copyIcon}
                    icon={ctx => {
                      return (
                        <RcIconCopyRegularCC
                          color={ctx.iconColor}
                          width={14}
                          height={14}
                          style={ctx.iconStyle}
                        />
                      );
                    }}
                  />
                </TouchableView>
              </View>
            )}
          </View>
        </View>

        <View style={styles.tokenDetailHeaderF2}>
          {chainItem?.isTestnet ? (
            <>
              {isNativeToken ? null : (
                <CustomizedSwitch
                  selected={isAdded}
                  onClose={() => {
                    handleRemoveToken(token);
                  }}
                  onOpen={() => {
                    handleAddToken(token);
                  }}
                />
              )}
            </>
          ) : (
            <>
              {token?.is_core ? (
                <BlockedButton
                  selected={isAdded}
                  onClose={() => {
                    handleRemoveToken(token);
                  }}
                  onOpen={() => {
                    handleAddToken(token);
                  }}
                />
              ) : (
                <CustomizedSwitch
                  selected={isAdded}
                  onClose={() => {
                    handleRemoveToken(token);
                  }}
                  onOpen={() => {
                    handleAddToken(token);
                  }}
                />
              )}
            </>
          )}

          <Text style={styles.balanceTitle}>
            {getTokenSymbol(token)} {t('page.newAddress.hd.balance')}
          </Text>
          <View style={styles.tokenDetailHeaderF2Inner}>
            <View style={styles.tokenDetailHeaderUsdValueWrap}>
              {token._amountStr ? (
                <>
                  <Text style={styles.tokenDetailHeaderAmount}>
                    {token._amountStr}
                  </Text>
                  <Text
                    style={[
                      styles.aboutEqual,
                      styles.tokenDetailHeaderUsdValue,
                    ]}>
                    ≈
                  </Text>
                </>
              ) : null}
              <Text style={styles.tokenDetailHeaderUsdValue}>
                {token._usdValueStr}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
);

const getTokenDetailHeaderStyle = createGetStyles(colors => {
  return {
    tokenDetailHeaderWrap: {
      // height: SIZES.headerHeight,
      width: '100%',
      paddingVertical: 4,
      alignItems: 'flex-start',
    },
    tokenDetailHeaderF1: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingVertical: 0,
      // ...makeDebugBorder(),
    },
    tokenDetailHeaderLogo: {
      width: SIZES.headerTokenLogo,
      height: SIZES.headerTokenLogo,
      marginRight: 8,
    },
    tokenSymbol: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      fontWeight: '600',
    },
    smallTokenSymbol: {
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '400',
    },
    tokenAddrInfo: {
      marginLeft: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: colors['neutral-card2'],
      borderRadius: 4,

      flexDirection: 'row',
      alignItems: 'center',

      color: colors['neutral-foot'],
    },
    tokenChainIcon: {
      width: 14,
      height: 14,
    },
    tokenChainNameText: {
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',

      marginLeft: 6,
    },
    tokenAddressWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      maxHeight: SIZES.headerTokenLogo - 2 * 4,
    },
    tokenAddressText: {
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',

      marginHorizontal: 6,
    },
    tokenTouchIcon: {
      height: '100%',
      // ...makeDebugBorder(),
    },
    jumpIcon: {
      maxHeight: 14,
      color: colors['neutral-foot'],
    },
    copyIcon: {
      maxHeight: 14,
      // ...makeDebugBorder(),
    },
    tokenDetailHeaderF2: {
      width: '100%',
      position: 'relative',
      flexDirection: 'column',
      // alignItems: 'center',
      marginTop: 16,
      marginBottom: 0,
    },
    balanceTitle: {
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',
      marginBottom: 4,
    },
    tokenDetailHeaderF2Inner: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenDetailHeaderUsdValueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenDetailHeaderAmount: {
      textAlign: 'left',
      color: colors['neutral-title-1'],
      fontSize: 24,
      fontWeight: '700',
    },
    aboutEqual: {
      marginLeft: 6,
    },
    tokenDetailHeaderUsdValue: {
      textAlign: 'right',
      color: colors['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      position: 'relative',
      top: 2,
    },
    tokenDetailHeaderPrice: {
      marginTop: 2,
      color: colors['neutral-foot'],
      fontSize: 13,
      fontWeight: '400',
    },
    tokenDetailHeaderChange: {
      fontSize: 10,
      fontWeight: '500',
    },
  };
});

type RedirectToType = 'Swap' | 'Send' | 'Receive';
export const BottomSheetModalTokenDetail = React.forwardRef<
  BottomSheetModalMethods,
  {
    /** @internal */
    __shouldSwitchSceneAccountBeforeRedirect__: boolean;
    token?: AbstractPortfolioToken | null;
    canClickToken?: boolean;
    isTestnet?: boolean;
    onDismiss?: () => void;
    onTriggerDismissFromInternal?: (ctx?: {
      reason?: 'redirect-to';
      data?: RedirectToType;
    }) => void;
    hideOperationButtons?: boolean;
    address?: KeyringAccountWithAlias | null;
    nextTxRedirectAccount?: Account | null;
  }
>(
  (
    {
      __shouldSwitchSceneAccountBeforeRedirect__,
      token,
      canClickToken,
      onDismiss,
      onTriggerDismissFromInternal,
      hideOperationButtons = false,
      isTestnet,
      address,
      nextTxRedirectAccount,
    },
    ref,
  ) => {
    const { styles } = useThemeStyles(getStyles);
    const { t } = useTranslation();
    const finalAccount = address;

    const [tokenLoad, setTokenLoad] = React.useState<{
      isLoading: boolean;
      token: TokenItem | null;
    }>({
      isLoading: false,
      token: token || null,
    });

    const tokenSupportSwap = useMemo(() => {
      const tokenChain = getChain(token?.chain)?.enum;

      return !!tokenChain && SWAP_SUPPORT_CHAINS.includes(tokenChain);
    }, [token]);

    const getTokenAmount = React.useCallback(async () => {
      if (!finalAccount || !token) {
        return;
      }

      setTokenLoad({ isLoading: true, token: null });
      try {
        const res = await openapi.getToken(
          finalAccount.address,
          token.chain,
          token._tokenId,
        );
        if (res) {
          setTokenLoad(prev => ({ isLoading: false, token: res }));
        }
      } finally {
        setTokenLoad(prev => ({ ...prev, isLoading: false }));
      }
    }, [finalAccount, token]);
    const tokenWithAmount = useMemo(() => {
      if (!token) return null;
      const { token: tokenInfo } = tokenLoad;
      if (!tokenInfo || tokenInfo.id !== token._tokenId) return token;

      return ensureAbstractPortfolioToken({
        ...abstractTokenToTokenItem(token),
        amount: tokenInfo?.amount,
      });
    }, [token, tokenLoad]);

    React.useEffect(() => {
      getTokenAmount();
    }, [getTokenAmount]);

    const historyListRef = useRef<BottomSheetFlatListMethods>(null);
    const resetHistoryListPosition = useCallback(() => {
      const listRef = historyListRef.current;
      if (listRef) {
        listRef.scrollToOffset({ offset: 0, animated: false });
      }
    }, []);

    const [isAdded, setIsAdded] = React.useState(false);

    const chainItem = findChain({ serverId: token?.chain });

    const checkIsAdded = useMemoizedFn(async () => {
      if (!token) return;

      if (chainItem?.isTestnet) {
        const isAdded = await apiCustomTestnet.isAddedCustomTestnetToken({
          chainId: chainItem.id,
          id: token._tokenId,
        });
        setIsAdded(isAdded);
      } else {
        let list: Token[] = [];
        if (token.is_core) {
          list = await preferenceService.getBlockedToken();
        } else {
          list = await preferenceService.getCustomizedToken();
        }

        const isAdded = list.some(
          item =>
            isSameAddress(item.address, token._tokenId) &&
            item.chain === token.chain,
        );
        setIsAdded(isAdded);
      }
    });

    React.useEffect(() => {
      checkIsAdded();
    }, [checkIsAdded, token]);

    // Customized and not added
    const isHiddenButton = isTestnet ? false : !token?.is_core && !isAdded;

    // const [latestData, setLatestData] = React.useState<LoadData>({
    //   list: [],
    // });

    type LoadData = {
      earliest?: TxDisplayItem['time_at'] | undefined;
      tokenId?: AbstractPortfolioToken['_tokenId'] | null;
      list: TxDisplayItem[];
    };
    const {
      data: latestData,
      loading: isLoadingFirst,
      loadingMore: isLoadingMore,
      loadMore,
      reloadAsync,
    } = useInfiniteScroll<LoadData>(
      async currentData => {
        const lastEarliestTime =
          currentData?.earliest ?? last(currentData?.list)?.time_at;
        const tickResult: LoadData = {
          earliest: lastEarliestTime ?? undefined,
          tokenId: token?._tokenId,
          list: [],
        };

        if (!token || isTestnet) {
          return tickResult;
        }

        try {
          const res: TxHistoryResult = await openapi.listTxHisotry({
            id: finalAccount?.address,
            chain_id: token?.chain,
            start_time: lastEarliestTime ?? undefined,
            page_count: PAGE_COUNT,
            token_id: token?._tokenId,
          });
          const {
            project_dict,
            cate_dict,
            token_dict,
            history_list: list,
          } = res;
          // descendent order by time_at
          const displayList: TxDisplayItem[] = list
            .map(item => ({
              ...item,
              projectDict: project_dict,
              cateDict: cate_dict,
              tokenDict: token_dict,
            }))
            .sort((v1, v2) => v2.time_at - v1.time_at);

          tickResult.earliest = last(displayList)?.time_at;

          tickResult.list = !lastEarliestTime
            ? displayList
            : // find out the items that are earlier than the earliest item in current list
              displayList.filter(
                item => !item.time_at || item.time_at <= lastEarliestTime,
              );

          return tickResult;
        } catch (error) {
          console.error(error);
          return tickResult;
        }
      },
      {
        // manual: true,
        reloadDeps: [token, token?._tokenId, isTestnet],
        isNoMore: d => {
          if (isTestnet) {
            return true;
          }
          return !d?.earliest || (d?.list.length || 0) < PAGE_COUNT;
        },
      },
    );

    useEffect(() => {
      if (token && !isTestnet) {
        resetHistoryListPosition();
      }
    }, [token, resetHistoryListPosition, isTestnet]);

    const { dataList, shouldRenderLoadingOnEmpty } = useMemo(() => {
      const res = {
        dataList: [] as TxDisplayItem[],
        shouldRenderLoadingOnEmpty: false,
      };

      const lastTokenIdMatched =
        !!token?._tokenId && latestData?.tokenId === token?._tokenId;
      res.dataList = lastTokenIdMatched ? latestData?.list || [] : [];

      // // TODO: leave here for debug
      // if (__DEV__) {
      //   if (data?.list) {
      //     // data.list = [];
      //     data.list = data.list.slice(0, 5);
      //   }
      // }
      res.shouldRenderLoadingOnEmpty =
        isLoadingFirst ||
        (!res.dataList?.length && isLoadingMore) ||
        (tokenLoad?.isLoading && lastTokenIdMatched);

      if (isTestnet) {
        res.shouldRenderLoadingOnEmpty = false;
      }

      return res;
    }, [
      latestData?.tokenId,
      latestData?.list,
      token?._tokenId,
      tokenLoad?.isLoading,
      isLoadingFirst,
      isLoadingMore,
      isTestnet,
    ]);

    const onEndReached = React.useCallback(() => {
      if (isLoadingFirst) return;
      if (latestData?.tokenId !== token?._tokenId) {
        if (__DEV__) {
          console.warn(
            'latestData?.tokenId !== token?._tokenId, skip load more',
          );
        }
        return;
      }
      loadMore();
    }, [isLoadingFirst, latestData?.tokenId, token?._tokenId, loadMore]);

    const renderItem = useCallback(
      ({ item }: { item: TxDisplayItem }) => {
        return (
          <HistoryItem
            data={item}
            canClickToken={!isLoadingFirst && canClickToken}
            projectDict={item.projectDict}
            cateDict={item.cateDict}
            tokenDict={item.tokenDict || {}}
          />
        );
      },
      [isLoadingFirst, canClickToken],
    );

    const keyExtractor = useCallback((item: TxDisplayItem) => {
      return `${item.chain}/${item.cate_id}/${item.id}/${item.time_at || '-'}`;
    }, []);

    const navigation = useRabbyAppNavigation();
    const { navigateToSendPolyScreen } = useSendRoutes();
    const { switchSceneCurrentAccount: _switchSceneCurrentAccount } =
      useSwitchSceneCurrentAccount();

    const switchSceneCurrentAccount = useCallback(
      async (...args: Parameters<typeof _switchSceneCurrentAccount>) => {
        if (!__shouldSwitchSceneAccountBeforeRedirect__) return;

        return _switchSceneCurrentAccount(...args);
      },
      [__shouldSwitchSceneAccountBeforeRedirect__, _switchSceneCurrentAccount],
    );

    const onRedirecTo = useCallback(
      async (type?: RedirectToType) => {
        onTriggerDismissFromInternal?.({ reason: 'redirect-to', data: type });
        const chainItem = !token?.chain
          ? null
          : findChainByServerID(token?.chain);

        switch (type) {
          case 'Swap':
            await switchSceneCurrentAccount(
              'MakeTransactionAbout',
              nextTxRedirectAccount || null,
            );
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.Swap,
              params: {
                chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
                tokenId: token?._tokenId,
              },
            });
            break;
          case 'Send': {
            await switchSceneCurrentAccount(
              'MakeTransactionAbout',
              nextTxRedirectAccount || null,
            );
            navigateToSendPolyScreen(true, {
              chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
              tokenId: token?._tokenId,
            });
            break;
          }
          case 'Receive': {
            if (finalAccount) {
              navigation.push(RootNames.StackTransaction, {
                screen: RootNames.Receive,
                params: {
                  chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
                  tokenSymbol: token?.symbol,
                  account: finalAccount,
                },
              });
            }
            break;
          }
        }
      },
      [
        onTriggerDismissFromInternal,
        token?.chain,
        token?._tokenId,
        token?.symbol,
        switchSceneCurrentAccount,
        nextTxRedirectAccount,
        navigation,
        navigateToSendPolyScreen,
        finalAccount,
      ],
    );

    const ListHeaderComponent = React.useMemo(() => {
      if (isHiddenButton || hideOperationButtons)
        return <View style={{ height: 12 }} />;

      return (
        <View style={[styles.buttonGroup]}>
          <Tip
            {...(tokenSupportSwap && {
              isVisible: false,
            })}
            placement="top"
            parentWrapperStyle={[styles.buttonTipWrapper]}
            childrenWrapperStyle={[styles.buttonTipChildrenWrapper]}
            // isLight
            pressableProps={{
              hitSlop: 0,
              style: { width: '100%' },
            }}
            contentStyle={[styles.disabledTooltipContent]}
            content={
              <View style={[styles.disabledTooltipInner]}>
                <Text style={styles.disabledTooltipText}>
                  {t('page.dashboard.tokenDetail.notSupported')}
                </Text>
              </View>
            }>
            <Button
              type="primary"
              disabled={!tokenSupportSwap || tokenLoad.isLoading}
              buttonStyle={styles.operationButton}
              style={styles.buttonTouchableStyle}
              containerStyle={styles.buttonContainer}
              titleStyle={styles.buttonTitle}
              onPress={() => {
                onRedirecTo('Swap');
              }}
              title={t('page.dashboard.tokenDetail.swap')}
            />
          </Tip>
          <Button
            type="primary"
            disabled={tokenLoad.isLoading}
            ghost
            buttonStyle={styles.operationButton}
            style={styles.buttonTouchableStyle}
            containerStyle={styles.buttonContainer}
            titleStyle={styles.buttonTitle}
            onPress={() => {
              onRedirecTo('Send');
            }}
            title={t('page.dashboard.tokenDetail.send')}
          />
          <Button
            type="primary"
            disabled={tokenLoad.isLoading}
            ghost
            buttonStyle={styles.operationButton}
            style={styles.buttonTouchableStyle}
            containerStyle={styles.buttonContainer}
            titleStyle={styles.buttonTitle}
            onPress={() => {
              onRedirecTo('Receive');
            }}
            title={t('page.dashboard.tokenDetail.receive')}
          />
        </View>
      );
    }, [
      tokenLoad.isLoading,
      styles,
      isHiddenButton,
      hideOperationButtons,
      t,
      tokenSupportSwap,
      onRedirecTo,
    ]);

    const { androidOnlyBottomOffset } = useSafeSizes();

    const ListFooterComponent = React.useMemo(() => {
      return (
        <View style={[styles.listFooterContainer]}>
          {isLoadingMore ? <ActivityIndicator /> : null}
        </View>
      );
    }, [styles, isLoadingMore]);

    const ListEmptyComponent = React.useMemo(() => {
      return shouldRenderLoadingOnEmpty ? (
        <SkeletonHistoryListOfTokenDetail />
      ) : (
        <View style={[styles.emptyHolderContainer]}>
          <NotFoundHolder
            text={t('page.dashboard.tokenDetail.noTransactions')}
            iconSize={52}
            colorVariant="foot"
          />
        </View>
      );
    }, [t, styles.emptyHolderContainer, shouldRenderLoadingOnEmpty]);

    const [isShowing, setIsShowing] = React.useState(false);
    const onSnapshotChange = useCallback<BottomSheetProps['onChange'] & object>(
      index => {
        setIsShowing(index > 0);
      },
      [],
    );
    useHandleBackPressClosable(
      useCallback(() => {
        onTriggerDismissFromInternal?.();
        return false;
      }, [onTriggerDismissFromInternal]),
      { autoEffectEnabled: isShowing },
    );

    return (
      <AppBottomSheetModal
        ref={ref}
        backgroundStyle={styles.modal}
        // handleStyle={{
        //   ...makeDebugBorder('red'),
        // }}
        enableContentPanningGesture={false}
        enablePanDownToClose={true}
        snapPoints={[`${SIZES.sheetModalHorizontalPercentage * 100}%`]}
        onChange={onSnapshotChange}
        onDismiss={onDismiss}>
        <AutoLockView
          as="BottomSheetView"
          style={[
            styles.container,
            { paddingBottom: androidOnlyBottomOffset },
          ]}>
          <BottomSheetHandlableView style={[styles.tokenDetailHeaderBlock]}>
            {tokenLoad?.isLoading ? (
              <SkeletonTokenDetailHeader />
            ) : (
              !!tokenWithAmount && (
                <TokenDetailHeader
                  token={tokenWithAmount}
                  isAdded={isAdded}
                  setIsAdded={setIsAdded}
                />
              )
            )}
          </BottomSheetHandlableView>
          <BottomSheetFlatList
            ref={historyListRef}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={ListHeaderComponent}
            ListFooterComponent={ListFooterComponent}
            ListEmptyComponent={ListEmptyComponent}
            data={dataList}
            style={styles.scrollView}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            refreshing={isLoadingFirst}
            onRefresh={reloadAsync}
            // refreshControl={
            //   <RefreshControl
            //     {...(isIOS && {
            //       progressViewOffset: -12,
            //     })}
            //     refreshing={isLoading}
            //     onRefresh={reloadAsync}
            //   />
            // }
          />
        </AutoLockView>
      </AppBottomSheetModal>
    );
  },
);

const getStyles = createGetStyles(colors => {
  return {
    modal: {
      backgroundColor: colors['neutral-bg-1'],
    },
    container: {
      height: '100%',
      paddingTop: SIZES.containerPt,
      // ...makeDebugBorder('green'),
    },
    tokenDetailHeaderBlock: {
      minHeight: SIZES.headerHeight,
      paddingHorizontal: 20,
      flexShrink: 0,
      // ...makeDebugBorder(),
    },
    bodyContainer: {
      maxHeight: SIZES.maxEmptyHeight,
      // paddingTop: 12,
    },
    scrollView: {
      flexShrink: 1,
      minHeight: 150,
      height: '100%',
      maxHeight: SIZES.maxEmptyHeight,
      marginBottom: 15,
      paddingHorizontal: 20,
    },
    buttonGroup: {
      marginTop: 4,
      marginBottom: SIZES.buttonGap,
      width:
        Dimensions.get('window').width -
        SIZES.horizontalPadding * 2 +
        SIZES.buttonGap,
      flexDirection: 'row',
      alignItems: 'center',
    },
    buttonContainer: {
      position: 'relative',
      height: SIZES.opButtonHeight,
      alignItems: 'center',
      width: '100%',
      flexShrink: 1,
      paddingRight: SIZES.buttonGap,
      ...makeDevOnlyStyle({
        // borderColor: 'red',
        // backgroundColor: 'red',
      }),
    },
    buttonTouchableStyle: {
      // padding: 0,
      width: '100%',
      // ...makeDebugBorder('red'),
    },
    operationButton: {
      height: SIZES.opButtonHeight,
      borderRadius: 6,
      width: '100%',
    },
    buttonTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    disabledTooltipContent: {
      borderRadius: 2,
    },
    disabledTooltipInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    disabledTooltipText: {
      color: colors['neutral-title2'],
      fontSize: 13,
      fontWeight: '400',
    },
    buttonTipWrapper: {
      position: 'relative',
      height: SIZES.opButtonHeight,
      alignItems: 'center',
      width: '100%',
      flexShrink: 1,
      paddingRight: 0,
      backgroundColor: 'transparent',
      ...(__DEV__ &&
        {
          // ...makeDebugBorder('blue'),
          // backgroundColor: 'red',
        }),
    },
    buttonTipChildrenWrapper: {
      // height: '100%',
    },
    buttonTipText: {
      color: colors['neutral-title2'],
      height: '100%',
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      ...makeDevOnlyStyle({
        // backgroundColor: 'blue',
        // color: 'yellow',
      }),
    },
    listFooterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 56,
    },
    emptyHolderContainer: {
      // ...makeDebugBorder('yellow'),
      height: SIZES.maxEmptyHeight * 0.8,
      maxHeight: '100%',
      flexShrink: 1,
    },
  };
});
