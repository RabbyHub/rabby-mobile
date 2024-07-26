import React, { memo, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View } from 'react-native';

import { AssetAvatar } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { BottomSheetFlatListProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetScrollable/types';
import { useMemoizedFn } from 'ahooks';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { AbstractPortfolioToken } from '../types';

type Props = {
  isTestnet?: boolean;
  data: AbstractPortfolioToken[];
  onTokenPress?: (token: AbstractPortfolioToken) => void;
  style?: BottomSheetFlatListProps<AbstractPortfolioToken>['style'];
  ListHeaderComponent?: BottomSheetFlatListProps<AbstractPortfolioToken>['ListHeaderComponent'];
  ListFooterComponent?: BottomSheetFlatListProps<AbstractPortfolioToken>['ListFooterComponent'];
  ListEmptyComponent?: BottomSheetFlatListProps<AbstractPortfolioToken>['ListEmptyComponent'];
};
export const TokenList = ({
  style,
  data,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  isTestnet = false,
  onTokenPress,
}: Props) => {
  const renderItem = useMemoizedFn(
    ({ item }: { item: AbstractPortfolioToken }) => {
      return (
        <TokenRow
          data={item}
          isTestnet={isTestnet}
          onTokenPress={onTokenPress}
        />
      );
    },
  );

  const keyExtractor = useMemoizedFn((item: AbstractPortfolioToken) => {
    return `${item.chain}-${item.id}`;
  });

  return (
    <BottomSheetFlatList
      style={style}
      renderItem={renderItem}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      data={data}
      keyExtractor={keyExtractor}
    />
  );
};

const TokenRow = memo(
  ({
    data,
    style,
    onTokenPress,
    isTestnet = false,
  }: {
    data: AbstractPortfolioToken;
    style?: StyleProp<TouchableOpacity>;
    onTokenPress?(token: AbstractPortfolioToken): void;
    isTestnet?: boolean;
  }) => {
    const colors = useThemeColors();
    const styles = useMemo(() => getStyle(colors), [colors]);

    const onPressToken = useMemoizedFn(() => {
      return onTokenPress?.(data);
    });

    return (
      <TouchableOpacity
        style={StyleSheet.flatten([styles.tokenRowWrap, style])}
        onPress={onPressToken}>
        <View style={styles.tokenRowTokenWrap}>
          <AssetAvatar
            logo={data?.logo_url}
            chain={data?.chain}
            chainSize={16}
            size={36}
          />
          <View style={styles.tokenRowTokenInner}>
            <Text
              style={StyleSheet.flatten([styles.tokenSymbol])}
              numberOfLines={1}
              ellipsizeMode="tail">
              {data.symbol}
            </Text>
            {!isTestnet && data._priceStr ? (
              <Text style={styles.tokenRowPrice} numberOfLines={1}>
                {data._priceStr}
              </Text>
            ) : null}
          </View>
        </View>

        {isTestnet ? (
          <View style={styles.tokenRowUsdValueWrap}>
            <Text style={styles.tokenRowAmount}>{data._amountStr}</Text>
          </View>
        ) : (
          <View style={styles.tokenRowUsdValueWrap}>
            {data._amountStr ? (
              <Text style={styles.tokenRowAmount}>{data._amountStr}</Text>
            ) : null}
            <Text style={styles.tokenRowUsdValue}>{data._usdValueStr}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

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
      gap: 12,
    },
    tokenRowTokenWrap: {
      flexShrink: 1,
      flexDirection: 'row',
      maxWidth: '70%',
      gap: 12,
    },
    tokenSymbol: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
      width: '100%',
      // ...makeDebugBorder(),
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
  });
