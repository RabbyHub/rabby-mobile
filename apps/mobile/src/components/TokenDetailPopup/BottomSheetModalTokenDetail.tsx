import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  RefreshControl,
  Platform,
  ViewStyle,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { last } from 'lodash';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDevOnlyStyle } from '@/utils/styles';
import {
  BottomSheetFlatList,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  TxDisplayItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { AbstractPortfolioToken } from '@/screens/home/types';
import { useInfiniteScroll, useMemoizedFn } from 'ahooks';
import { HistoryItem } from '@/components/TokenDetailPopup/HistoryItem';

import { makeDebugBorder } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { AppBottomSheetModal, AssetAvatar, Button, Tip } from '@/components';
import { ChainIconFastImage } from '@/components/Chain/ChainIconImage';
import {
  CopyAddressIcon,
  CopyAddressIconType,
} from '@/components/AddressViewer/CopyAddress';
import { findChainByServerID, getChain } from '@/utils/chain';
import { getTokenSymbol } from '@/utils/token';
import { useTranslation } from 'react-i18next';
import { ellipsisOverflowedText } from '@/utils/text';
import { ellipsisAddress } from '@/utils/address';
import TouchableView from '@/components/Touchable/TouchableView';
import { SkeletonHistoryListOfTokenDetail } from './Skeleton';
import { NotFoundHolder } from '@/components/EmptyHolder/NotFound';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { CHAINS_ENUM } from '@debank/common';

const isIOS = Platform.OS === 'ios';

const PAGE_COUNT = 10;

export const TOKEN_DETAIL_HISTORY_SIZES = {
  sheetModalHorizontalPercentage: 0.8,
  horizontalPadding: 20,
  buttonGap: 12,
  containerPt: 8,
  headerHeight: 100,
  headerTokenLogo: 24,
  get maxEmptyHeight() {
    const modalHeight = Math.floor(
      Dimensions.get('window').height * SIZES.sheetModalHorizontalPercentage,
    );

    return (
      modalHeight -
      12 /* handlebar height */ -
      SIZES.containerPt -
      SIZES.headerHeight
    );
  },

  opButtonHeight: 40,
};

const SIZES = TOKEN_DETAIL_HISTORY_SIZES;

const TokenDetailHeader = React.memo(
  ({
    token,
    style,
    logoStyle,
  }: // onSmallTokenPress,
  // onTokenPress,
  {
    token: AbstractPortfolioToken;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    showHistory?: boolean;
    // onSmallTokenPress?(token: AbstractPortfolioToken): void;
    // onTokenPress?(token: AbstractPortfolioToken): void;
  }) => {
    const { t } = useTranslation();
    const { colors, styles } = useThemeStyles(getTokenDetailHeaderStyle);

    const { isContractToken, nativeTokenChainName, tokenAddress } =
      React.useMemo(() => {
        const item = findChainByServerID(token.chain);
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

    const copyAddressIconRef = React.useRef<CopyAddressIconType>(null);

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
              <TouchableView
                style={[styles.tokenAddressWrapper]}
                onPress={evt => {
                  copyAddressIconRef.current?.doCopy(evt);
                }}>
                <Text style={[styles.tokenAddressText]}>
                  {ellipsisAddress(tokenAddress)}
                </Text>
                <CopyAddressIcon
                  ref={copyAddressIconRef}
                  address={tokenAddress}
                  style={styles.copyIcon}
                />
              </TouchableView>
            )}
          </View>
        </View>

        <View style={styles.tokenDetailHeaderF2}>
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
      height: SIZES.headerHeight,
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
    },
    tokenAddressText: {
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',

      marginHorizontal: 6,
    },
    copyIcon: {
      height: '100%',
      // ...makeDebugBorder(),
    },
    tokenDetailHeaderF2: {
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

export const BottomSheetModalTokenDetail = React.forwardRef<
  BottomSheetModalMethods,
  {
    token?: AbstractPortfolioToken | null;
    isAdded?: boolean;
    isTestnet?: boolean;
    onDismiss?: () => void;
    onTriggerDismiss?: () => void;
  }
>(({ token, isAdded, onDismiss, onTriggerDismiss }, ref) => {
  const { styles, colors } = useThemeStyles(getStyles);
  const { currentAccount } = useCurrentAccount();
  const { t } = useTranslation();

  const tokenSupportSwap = useMemo(() => {
    const tokenChain = getChain(token?.chain)?.enum;

    return !!tokenChain && SWAP_SUPPORT_CHAINS.includes(tokenChain);
  }, [token]);

  // Customized and not added
  const isHiddenButton = !token?.is_core && !isAdded;

  const [latestData, setLatestData] = React.useState<LoadData>({
    last: null,
    list: [],
  });

  type LoadData = {
    last?: TxDisplayItem['time_at'] | null;
    list: TxDisplayItem[];
  };
  const {
    // data,
    loading: isLoading,
    loadingMore: isLoadingMore,
    loadMore,
    reloadAsync,
  } = useInfiniteScroll<LoadData>(
    async (currentData?) => {
      const tickResult: LoadData = {
        last: null,
        list: [],
      };

      if (!token) {
        setLatestData(tickResult);
        return tickResult;
      }

      const startTime = currentData?.last || 0;
      try {
        const res: TxHistoryResult = await openapi.listTxHisotry({
          id: currentAccount?.address,
          chain_id: token?.chain,
          start_time: startTime,
          page_count: PAGE_COUNT,
          token_id: token?._tokenId,
        });
        const { project_dict, cate_dict, token_dict, history_list: list } = res;
        const displayList: TxDisplayItem[] = list
          .map(item => ({
            ...item,
            projectDict: project_dict,
            cateDict: cate_dict,
            tokenDict: token_dict,
          }))
          .sort((v1, v2) => v2.time_at - v1.time_at);

        tickResult.last = last(displayList)?.time_at ?? null;
        tickResult.list = displayList;

        setLatestData(prev => ({
          last: tickResult.last,
          list: [...prev.list, ...tickResult.list],
        }));

        return tickResult;
      } catch (error) {
        console.error(error);
        return tickResult;
      }
    },
    {
      reloadDeps: [token],
      isNoMore: d => {
        return !d?.last || (d?.list.length || 0) < PAGE_COUNT;
      },
      onSuccess(data) {},
    },
  );

  const dataList = useMemo(() => {
    // is reloading
    if (isLoading && !isLoadingMore) return [];

    // // TODO: leave here for debug
    // if (__DEV__) {
    //   if (data?.list) {
    //     // data.list = [];
    //     data.list = data.list.slice(0, 5);
    //   }
    // }

    return latestData?.list || [];
  }, [isLoading, isLoadingMore, latestData?.list]);

  const onEndReached = React.useCallback(() => {
    loadMore();
  }, [loadMore]);

  const refresh = useCallback(async () => {
    console.debug('handle refreshing');
    await reloadAsync();
  }, [reloadAsync]);

  const renderItem = useCallback(({ item }: { item: TxDisplayItem }) => {
    return (
      <HistoryItem
        data={item}
        projectDict={item.projectDict}
        cateDict={item.cateDict}
        tokenDict={item.tokenDict || {}}
      />
    );
  }, []);

  const keyExtractor = useCallback((item: TxDisplayItem, idx: number) => {
    return `${item.chain}/${item.cate_id}/${item.id}/${idx}`;
  }, []);

  const navigation = useRabbyAppNavigation();

  const onRedirecTo = useCallback(
    (type?: 'Swap' | 'Send' | 'Receive') => {
      onTriggerDismiss?.();
      const chainItem = !token?.chain
        ? null
        : findChainByServerID(token?.chain);

      switch (type) {
        case 'Swap':
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.Swap,
            params: {
              chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
              tokenId: token?._tokenId,
            },
          });
          break;
        case 'Send': {
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.Send,
            params: {
              chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
              tokenId: token?._tokenId,
            },
          });
          break;
        }
        case 'Receive': {
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.Receive,
            params: {
              chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
              tokenName: token?.name,
            },
          });
          break;
        }
      }
    },
    [navigation, onTriggerDismiss, token?._tokenId, token?.chain, token?.name],
  );

  const ListHeaderComponent = React.useMemo(() => {
    if (isHiddenButton) return <View style={{ height: 12 }} />;

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
            disabled={!tokenSupportSwap}
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
  }, [styles, isHiddenButton, t, tokenSupportSwap, onRedirecTo]);

  const { safeOffBottom } = useSafeSizes();

  const ListFooterComponent = React.useMemo(() => {
    return (
      <View style={[styles.listFooterContainer, { minHeight: safeOffBottom }]}>
        {isLoadingMore ? <ActivityIndicator /> : null}
      </View>
    );
  }, [styles, isLoadingMore, safeOffBottom]);

  const ListEmptyComponent = React.useMemo(() => {
    return isLoading ? (
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
  }, [t, styles.emptyHolderContainer, isLoading]);

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      onTriggerDismiss?.();
      return false;
    }, [onTriggerDismiss]),
  );
  useFocusEffect(onHardwareBackHandler);

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
      onChange={useCallback(() => {}, [])}
      onDismiss={onDismiss}>
      <BottomSheetView style={styles.container}>
        <BottomSheetHandlableView style={[styles.tokenDetailHeaderBlock]}>
          {token && <TokenDetailHeader token={token} />}
        </BottomSheetHandlableView>
        <BottomSheetFlatList
          renderItem={renderItem}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ListEmptyComponent}
          data={dataList}
          style={styles.scrollView}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshing={false}
          onRefresh={refresh}
          // refreshControl={
          //   <RefreshControl
          //     {...(isIOS && {
          //       progressViewOffset: -12,
          //     })}
          //     refreshing={isLoading}
          //     onRefresh={refresh}
          //   />
          // }
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

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
