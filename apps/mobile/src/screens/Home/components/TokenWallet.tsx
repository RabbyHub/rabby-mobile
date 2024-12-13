import React, { memo, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { RcArrowRight2CC } from '@/assets/icons/common';
import { AssetAvatar } from '@/components/AssetAvatar';
import { EmptyHolder } from '@/components/EmptyHolder';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useTheme2024 } from '@/hooks/theme';
import { useSheetModals } from '@/hooks/useSheetModal';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import AutoLockView from '@/components/AutoLockView';
import { BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSetState } from 'ahooks';
import { RefreshControl } from 'react-native-gesture-handler';
import { useMergeSmallTokens } from '../hooks/useMergeSmallTokens';
import { AbstractPortfolioToken } from '../types';
import { AddMainnetCustomTokenPopup } from './AddMainnetCustomTokenPopup';
import { AddTestnetCustomTokenPopup } from './AddTestnetCustomTokenPopup';
import { BlockedTokenListPopup } from './BlockedTokenListPopup';
import { CustomTokenListPopup } from './CustomTokenListPopup';
import { PositionLoader } from './Skeleton';
import { TokenWalletFooter } from './TokenWalletFooter';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { Account } from '@/core/services/preference';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { findChain } from '@/utils/chain';

const formatPercentage = (x: number) => {
  if (Math.abs(x) < 0.00001) {
    return '0%';
  }
  const percentage = (x * 100).toFixed(3);
  return `${x >= 0 ? '+' : ''}${percentage}%`;
};

const ITEM_HEIGHT = 68;

type TokenWalletProps = {
  currentAccount?: Account | null;
  tokens?: AbstractPortfolioToken[];
  testnetTokens?: AbstractPortfolioToken[];
  customizeTokens?: AbstractPortfolioToken[];
  blockedTokens?: AbstractPortfolioToken[];
  showHistory?: boolean;
  isTokensLoading?: boolean;
  hasTokens?: boolean;
  refreshPositions(): void;
  isPortfoliosLoading: boolean;
  onRefresh(): void;
};

const TokenRow = memo(
  ({
    data,
    style,
    logoSize,
    logoStyle,
    onSmallTokenPress,
    onTokenPress,
  }: {
    data: AbstractPortfolioToken;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    logoSize?: number;
    showHistory?: boolean;
    onSmallTokenPress?(token: AbstractPortfolioToken): void;
    onTokenPress?(token: AbstractPortfolioToken): void;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
    const percentColor = useMemo(() => {
      if (
        !data?.price_24h_change ||
        Math.abs(data.price_24h_change) < 0.00001
      ) {
        return colors2024['neutral-secondary'];
      }
      if (data.price_24h_change > 0) {
        return colors2024['green-default'];
      }
      return colors2024['red-default'];
    }, [colors2024, data.price_24h_change]);

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle, styles.tokenRowLogo],
    );

    const onPressToken = useCallback(() => {
      if (data?.id === SMALL_TOKEN_ID) {
        return onSmallTokenPress?.(data);
      } else {
        return onTokenPress?.(data);
      }
    }, [data, onSmallTokenPress, onTokenPress]);

    return (
      <TouchableOpacity
        style={StyleSheet.flatten([styles.tokenRowWrap, style])}
        onPress={onPressToken}>
        <View style={styles.tokenRowTokenWrap}>
          {data?.id === SMALL_TOKEN_ID ? (
            <Image
              source={require('@/assets/icons/assets/small-token.png')}
              style={styles.smallTokenRowLogo}
            />
          ) : (
            <AssetAvatar
              logo={data?.logo_url}
              chain={data?.chain}
              style={mediaStyle}
              size={logoSize}
              chainSize={16}
            />
          )}
          <View style={styles.tokenRowTokenInner}>
            {data.id === SMALL_TOKEN_ID ? (
              <View style={styles.tokenRowTokenInnerSmallToken}>
                <Text
                  style={StyleSheet.flatten([
                    styles.tokenSymbol,
                    styles.smallTokenSymbol,
                  ])}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {data.symbol}
                </Text>
                <RcArrowRight2CC
                  style={styles.arrow}
                  color={colors2024['neutral-body']}
                />
              </View>
            ) : (
              <Text
                style={StyleSheet.flatten([styles.tokenSymbol])}
                numberOfLines={1}
                ellipsizeMode="tail">
                {data.symbol}
              </Text>
            )}
            {data._priceStr ? (
              <Text style={styles.amountStr} numberOfLines={1}>
                {`${data._amountStr} ${data.symbol}`}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tokenRowUsdValueWrap}>
          <Text
            style={
              data._amountStr ? styles.tokenRowAmount : styles.tokenRowUsdValue
            }>
            {data._usdValueStr}
          </Text>
          {data._amountStr ? (
            <Text
              style={StyleSheet.compose(styles.percent, {
                color: percentColor,
              })}>
              {formatPercentage(data.price_24h_change || 0)}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  },
);

export const TokenWallet = ({
  currentAccount,
  tokens,
  testnetTokens,
  customizeTokens,
  blockedTokens,
  showHistory,
  isTokensLoading,
  hasTokens,
  refreshPositions,
  isPortfoliosLoading,
  onRefresh,
}: TokenWalletProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const refreshing = useMemo(() => {
    if ((tokens?.length || 0) > 0) {
      return isPortfoliosLoading;
    } else {
      return false;
    }
  }, [isPortfoliosLoading, tokens]);

  const [customState, setCustomState] = useSetState({
    isTestnet: false,
    isShowMainnetAddPopup: false,
    isShowTestnetAddPopup: false,
    isShowBlockedPopup: false,
    isShowCustomPopup: false,
    isShowCustomTestnetPopup: false,
  });

  const {
    sheetModalRefs: { smallTokenModalRef },
    toggleShowSheetModal,
  } = useSheetModals({
    smallTokenModalRef: useRef<BottomSheetModal>(null),
  });

  const {
    sheetModalRef: tokenDetailModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    focusingToken,
    isTestnetToken,
  } = useGeneralTokenDetailSheetModal();

  const handleOpenSmallToken = React.useCallback(() => {
    smallTokenModalRef?.current?.present();
  }, [smallTokenModalRef]);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      if (
        findChain({
          serverId: token.chain,
        })?.isTestnet
      ) {
        openTokenDetailPopup(token);
      } else {
        navigate(RootNames.TokenDetail, {
          token: token,
          // todo fix ts
          account: currentAccount as any,
        });
      }
    },
    [currentAccount, openTokenDetailPopup],
  );

  const { mainTokens, smallTokens } = useMergeSmallTokens(tokens);

  const renderItem = useCallback(
    ({ item }: { item: AbstractPortfolioToken }) => {
      return (
        <TokenRow
          data={item}
          showHistory={showHistory}
          onSmallTokenPress={handleOpenSmallToken}
          onTokenPress={handleOpenTokenDetail}
          logoSize={40}
        />
      );
    },
    [showHistory, handleOpenSmallToken, handleOpenTokenDetail],
  );

  const keyExtractor = useCallback(
    (item: AbstractPortfolioToken, idx: number) => {
      return `${item.chain}/${item.symbol}/${item.id}/${idx}`;
    },
    [],
  );

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const tokenWalletFooterList = useMemo(() => {
    return [
      {
        type: 'custom' as const,
        label: t('page.dashboard.assets.table.customizeTokens', {
          count: customizeTokens?.length || 0,
        }),
      },
      {
        type: 'blocked' as const,
        label: t('page.dashboard.assets.table.blockedTokens', {
          count: blockedTokens?.length || 0,
        }),
      },
      {
        type: 'customTestnet' as const,
        label: t('page.dashboard.assets.table.testnetTokens', {
          count: testnetTokens?.length || 0,
        }),
      },
    ];
  }, [
    t,
    customizeTokens?.length,
    blockedTokens?.length,
    testnetTokens?.length,
  ]);

  const ListEmptyComponent = useMemo(() => {
    return isTokensLoading ? (
      <PositionLoader space={8} />
    ) : hasTokens ? null : (
      <EmptyHolder text="No Tokens" type="protocol" />
    );
  }, [isTokensLoading, hasTokens]);

  return (
    <>
      <Tabs.FlatList
        ListHeaderComponent={<View style={{ height: 12 }} />}
        ListFooterComponent={
          isTokensLoading || refreshing ? null : (
            <TokenWalletFooter
              onPress={type => {
                setCustomState({
                  isShowBlockedPopup: type === 'blocked',
                  isShowCustomPopup: type === 'custom',
                  isShowCustomTestnetPopup: type === 'customTestnet',
                });
              }}
              list={tokenWalletFooterList}
            />
          )
        }
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        data={mainTokens}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmptyComponent}
        windowSize={2}
        contentContainerStyle={styles.bgContainer}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
              refreshPositions();
              onRefresh();
            }}
            refreshing={refreshing}
          />
        }
      />
      <AppBottomSheetModal
        enableContentPanningGesture={false}
        ref={smallTokenModalRef}
        snapPoints={['80%']}>
        <AutoLockView as="BottomSheetView" style={{ flex: 1, height: '100%' }}>
          <BottomSheetFlatList
            renderItem={renderItem}
            ListHeaderComponent={
              <BottomSheetHandlableView style={styles.handlableHead}>
                <Text style={styles.titleText}>
                  {t('page.dashboard.assets.table.lowValueAssets', {
                    count: smallTokens?.length || 0,
                  })}
                </Text>
              </BottomSheetHandlableView>
            }
            keyExtractor={keyExtractor}
            data={smallTokens}
            style={styles.scrollView}
          />
        </AutoLockView>
      </AppBottomSheetModal>
      <BottomSheetModalTokenDetail
        __shouldSwitchSceneAccountBeforeRedirect__
        nextTxRedirectAccount={currentAccount}
        ref={tokenDetailModalRef}
        token={focusingToken}
        isTestnet={isTestnetToken}
        onDismiss={() => {
          cleanFocusingToken({ noNeedCloseModal: true });
        }}
        onTriggerDismissFromInternal={ctx => {
          if (ctx?.reason === 'redirect-to') {
            toggleShowSheetModal('smallTokenModalRef', false);
            setCustomState({
              isShowCustomPopup: false,
              isShowBlockedPopup: false,
              isShowCustomTestnetPopup: false,
            });
          }
          // toggleShowSheetModal('tokenDetailModalRef', false);
          cleanFocusingToken();
        }}
      />
      <CustomTokenListPopup
        tokens={customizeTokens}
        visible={customState.isShowCustomPopup}
        isTestnet={false}
        onTokenPress={handleOpenTokenDetail}
        onClose={() => {
          setCustomState({
            isShowCustomPopup: false,
          });
        }}
        onAddTokenPress={() => {
          setCustomState({
            isShowMainnetAddPopup: true,
          });
        }}
      />
      <CustomTokenListPopup
        tokens={testnetTokens}
        visible={customState.isShowCustomTestnetPopup}
        isTestnet={true}
        onTokenPress={handleOpenTokenDetail}
        onClose={() => {
          setCustomState({
            isShowCustomTestnetPopup: false,
          });
        }}
        onAddTokenPress={() => {
          setCustomState({
            isShowTestnetAddPopup: true,
          });
        }}
      />
      <AddMainnetCustomTokenPopup
        visible={customState.isShowMainnetAddPopup}
        onClose={() => {
          setCustomState({
            isShowMainnetAddPopup: false,
          });
        }}
      />
      <AddTestnetCustomTokenPopup
        visible={customState.isShowTestnetAddPopup}
        onClose={() => {
          setCustomState({
            isShowTestnetAddPopup: false,
          });
        }}
      />
      <BlockedTokenListPopup
        tokens={blockedTokens}
        visible={customState.isShowBlockedPopup}
        onClose={() => {
          setCustomState({
            isShowBlockedPopup: false,
          });
        }}
        onTokenPress={handleOpenTokenDetail}
      />
    </>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  handlableHead: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 1,
    marginBottom: 2,
  },
  titleText: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '600',
  },
  bgContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  tokenRowWrap: {
    height: 72,
    width: '100%',
    paddingHorizontal: 20,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenRowTokenWrap: {
    flexShrink: 1,
    flexDirection: 'row',
    maxWidth: '70%',
  },
  tokenSymbol: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    width: '100%',
    // ...makeDebugBorder(),
  },
  tokenRowLogo: {
    marginRight: 12,
  },
  smallTokenRowLogo: {
    marginRight: 12,
    width: 40,
    height: 40,
  },
  tokenRowTokenInner: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  tokenRowTokenInnerSmallToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    display: 'flex',
  },
  amountStr: {
    marginTop: 2,
    color: ctx.colors2024['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
  },
  tokenRowChange: {
    fontSize: 10,
    fontWeight: '500',
  },
  tokenRowUsdValueWrap: {
    flexShrink: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  tokenRowAmount: {
    marginBottom: 2,
    textAlign: 'right',
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  tokenRowUsdValue: {
    textAlign: 'right',
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  percent: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
  smallTokenSymbol: {
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    width: 'auto',
  },
  arrow: {
    width: 14,
    height: 14,
  },

  // modal
  scrollView: {
    height: 150,
    marginBottom: 15,
  },
}));
