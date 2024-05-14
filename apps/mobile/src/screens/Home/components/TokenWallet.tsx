import React, {
  useMemo,
  memo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Text,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/Toast';

import { AbstractPortfolioToken } from '../types';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useMergeSmallTokens } from '../hooks/useMergeSmallTokens';
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { PositionLoader } from './Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { RefreshControl } from 'react-native-gesture-handler';
import { useSheetModals } from '@/hooks/useSheetModal';
import { useToggleFocusingToken } from '../hooks/token';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { makeDebugBorder } from '@/utils/styles';

const ITEM_HEIGHT = 68;

type TokenWalletProps = {
  tokens?: AbstractPortfolioToken[];
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
    const colors = useThemeColors();
    const styles = useMemo(() => getStyle(colors), [colors]);

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
              style={styles.tokenRowLogo}
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
            <Text
              style={StyleSheet.flatten([
                styles.tokenSymbol,
                data.id === SMALL_TOKEN_ID && styles.smallTokenSymbol,
              ])}
              numberOfLines={1}
              ellipsizeMode="tail">
              {data.symbol}
            </Text>
            {data._priceStr ? (
              <Text style={styles.tokenRowPrice} numberOfLines={1}>
                {data._priceStr}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tokenRowUsdValueWrap}>
          {data._amountStr ? (
            <Text style={styles.tokenRowAmount}>{data._amountStr}</Text>
          ) : null}
          <Text style={styles.tokenRowUsdValue}>{data._usdValueStr}</Text>
        </View>
      </TouchableOpacity>
    );
  },
);

export const TokenWallet = ({
  tokens,
  showHistory,
  isTokensLoading,
  hasTokens,
  refreshPositions,
  isPortfoliosLoading,
  onRefresh,
}: TokenWalletProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const { t } = useTranslation();
  const refreshing = useMemo(() => {
    if ((tokens?.length || 0) > 0) {
      return isPortfoliosLoading;
    } else {
      return false;
    }
  }, [isPortfoliosLoading, tokens]);

  const {
    sheetModalRefs: { smallTokenModalRef, tokenDetailModalRef },
    toggleShowSheetModal,
  } = useSheetModals({
    smallTokenModalRef: useRef<BottomSheetModal>(null),
    tokenDetailModalRef: useRef<BottomSheetModal>(null),
  });

  const { onFocusToken, focusingToken } = useToggleFocusingToken();

  const handleOpenSmallToken = React.useCallback(() => {
    smallTokenModalRef?.current?.present();
  }, [smallTokenModalRef]);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      // toast.show('Coming Soon :)');
      onFocusToken(token);
      tokenDetailModalRef?.current?.present();
    },
    [onFocusToken, tokenDetailModalRef],
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
          logoSize={36}
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

  const ListEmptyComponent = useMemo(() => {
    return isTokensLoading ? (
      <PositionLoader space={8} />
    ) : hasTokens ? null : (
      <EmptyHolder text="No tokens" type="protocol" />
    );
  }, [isTokensLoading, hasTokens]);

  return (
    <>
      <Tabs.FlatList
        ListHeaderComponent={<View style={{ height: 12 }} />}
        ListFooterComponent={<View style={{ height: 24 }} />}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        data={mainTokens}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmptyComponent}
        windowSize={2}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              refreshPositions();
              onRefresh();
            }}
            refreshing={refreshing}
          />
        }
      />
      <AppBottomSheetModal ref={smallTokenModalRef} snapPoints={['70%']}>
        <BottomSheetFlatList
          renderItem={renderItem}
          ListHeaderComponent={
            <View className="flex-row justify-center mt-1 mb-2">
              <Text className="text-r-neutral-title-1 text-[20px] font-semibold">
                {t('page.dashboard.assets.table.lowValueAssets', {
                  count: smallTokens?.length || 0,
                })}
              </Text>
            </View>
          }
          keyExtractor={keyExtractor}
          data={smallTokens}
          style={styles.scrollView}
        />
      </AppBottomSheetModal>

      <BottomSheetModalTokenDetail
        ref={tokenDetailModalRef}
        token={focusingToken.token}
        onDismiss={() => {
          onFocusToken(null);
        }}
        onTriggerDismissFromInternal={ctx => {
          if (ctx?.reason === 'redirect-to') {
            toggleShowSheetModal('smallTokenModalRef', false);
          }
          toggleShowSheetModal('tokenDetailModalRef', false);
        }}
      />
    </>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tokenRowWrap: {
      height: 68,
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
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
      width: '100%',
      // ...makeDebugBorder(),
    },
    tokenRowLogo: {
      marginRight: 12,
    },
    tokenRowTokenInner: {
      flexShrink: 1,
      justifyContent: 'center',
    },
    tokenRowPrice: {
      marginTop: 2,
      color: colors['neutral-foot'],
      fontSize: 13,
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
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
    },
    tokenRowUsdValue: {
      textAlign: 'right',
      color: colors['neutral-foot'],
      fontSize: 13,
      fontWeight: '400',
    },
    smallTokenSymbol: {
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '400',
    },

    // modal
    scrollView: {
      height: 150,
      marginBottom: 15,
    },
  });
