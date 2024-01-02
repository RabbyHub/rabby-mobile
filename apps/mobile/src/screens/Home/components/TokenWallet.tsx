import React, { useMemo, memo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { AbstractPortfolioToken } from '../types';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { AssetAvatar } from '@/components/AssetAvatar';
import {
  SMALL_TOKEN_ID,
  useMergeSmallTokens,
} from '../hooks/useMergeSmallTokens';
import { formatAmount } from '@/utils/number';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { PositionLoader } from './Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

const ITEM_HEIGHT = 68;

type TokenWalletProps = {
  tokens?: AbstractPortfolioToken[];
  showHistory?: boolean;
  isTokensLoading?: boolean;
  hasTokens?: boolean;
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
    onSmallTokenPress?(): void;
    onTokenPress?(): void;
  }) => {
    const colors = useThemeColors();
    const styles = useMemo(() => getStyle(colors), [colors]);

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle, styles.tokenRowLogo],
    );

    return (
      <TouchableOpacity
        style={StyleSheet.flatten([styles.tokenRowWrap, style])}
        onPress={
          data?.id === SMALL_TOKEN_ID ? onSmallTokenPress : onTokenPress
        }>
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
              ])}>
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
}: TokenWalletProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  const smallTokenModalRef = React.useRef<BottomSheetModal>(null);
  const handleOpenSmallToken = React.useCallback(() => {
    smallTokenModalRef.current?.present();
  }, []);

  const tokenDetailModalRef = React.useRef<BottomSheetModal>(null);
  const handleOpenTokenDetail = React.useCallback(() => {
    tokenDetailModalRef.current?.present();
  }, []);

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

  const keyExtractor = useCallback((item: AbstractPortfolioToken) => {
    return item.id;
  }, []);

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
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
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        data={mainTokens}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmptyComponent}
        windowSize={2}
      />
      <AppBottomSheetModal
        backdropComponent={renderBackdrop}
        ref={smallTokenModalRef}
        snapPoints={['50%']}>
        <BottomSheetFlatList
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          data={smallTokens}
          style={styles.scrollView}
        />
      </AppBottomSheetModal>

      <AppBottomSheetModal
        backdropComponent={renderBackdrop}
        ref={tokenDetailModalRef}
        backgroundStyle={{
          backgroundColor: colors['neutral-bg-1'],
        }}
        snapPoints={['50%']}>
        <BottomSheetView>
          <Text
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: colors['neutral-title-1'],
              marginBottom: 10,
              marginTop: 30,
              textAlign: 'center',
            }}>
            Token Detail
          </Text>
          <Text
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              fontSize: 16,
              fontWeight: '400',
              color: colors['neutral-foot'],
              textAlign: 'center',
              marginTop: '20%',
            }}>
            Coming soon
          </Text>
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tokenRowTokenWrap: {
      flexShrink: 1,
      flexDirection: 'row',
      flexBasis: '50%',
    },
    tokenSymbol: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
    },
    tokenRowWrap: {
      height: 68,
      width: '100%',
      paddingHorizontal: 20,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenRowLogo: {
      marginRight: 12,
    },
    tokenRowTokenInner: {
      flexShrink: 1,
      justifyContent: 'center',
    },
    tokenRowPrice: {
      color: colors['neutral-foot'],
      fontSize: 13,
      fontWeight: '400',
    },
    tokenRowChange: {
      fontSize: 10,
      fontWeight: '500',
    },
    tokenRowUsdValueWrap: {
      flexShrink: 1,
      flexBasis: '50%',
      alignItems: 'flex-end',
    },
    tokenRowAmount: {
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
      marginTop: 15,
      marginBottom: 15,
    },
  });
