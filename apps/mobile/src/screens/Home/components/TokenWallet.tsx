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
import { useSwitch } from '@/hooks/useSwitch';
import { useExpandList } from '@/hooks/useExpandList';
import { SMALL_TOKEN_ID, mergeSmallTokens } from '../utils/walletMerge';
import { formatAmount } from '@/utils/number';

const ITEM_HEIGHT = 54;

type TokenWalletProps = {
  tokens?: AbstractPortfolioToken[];
  showHistory?: boolean;
  tokenNetWorth?: number;
};

const TokenRow = memo(
  ({
    data,
    style,
    logoSize,
    logoStyle,
    showHistory,
    onSmallTokenPress,
  }: {
    data: AbstractPortfolioToken;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    logoSize?: number;
    showHistory?: boolean;
    onSmallTokenPress?(): void;
  }) => {
    const colors = useThemeColors();
    const styles = useMemo(() => getStyle(colors), [colors]);

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle, styles.tokenRowLogo],
    );
    const Container = useMemo(
      () => (data.id === SMALL_TOKEN_ID ? TouchableOpacity : View) as any,
      [data?.id],
    );

    const amountChangeStyle = useMemo(
      () =>
        StyleSheet.flatten([
          styles.tokenRowChange,
          {
            color:
              data.amount <= 0
                ? // debt
                  colors['neutral-title-1']
                : data._amountChange
                ? data._amountChange < 0
                  ? colors['red-default']
                  : colors['green-default']
                : colors['neutral-title-1'],
          },
        ]),
      [data, colors],
    );

    const usdChangeStyle = useMemo(
      () =>
        StyleSheet.flatten([
          styles.tokenRowChange,
          {
            color:
              data.amount < 0
                ? colors['neutral-title-1']
                : data._usdValueChange
                ? data._usdValueChange < 0
                  ? colors['red-default']
                  : colors['green-default']
                : colors['neutral-title-1'],
          },
        ]),
      [data, colors],
    );

    return (
      <Container
        style={StyleSheet.flatten([styles.tokenRowWrap, style])}
        onPress={data?.id === SMALL_TOKEN_ID ? onSmallTokenPress : undefined}>
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
            <Text style={styles.tokenRowToken} numberOfLines={1}>
              ${data._priceStr}
            </Text>
          </View>
        </View>

        <View style={styles.tokenRowUsdValueWrap}>
          <Text style={styles.tokenRowUsdValue}>
            {formatAmount(data._amountStr ?? 0)}
          </Text>
          <Text style={styles.tokenRowUsdValue}>{data._usdValueStr}</Text>
          {/* {showHistory ? (
            <Text style={usdChangeStyle}>
              {data._usdValueChangeStr !== '-'
                ? `${data._usdValueChangePercent} (${data._usdValueChangeStr})`
                : '-'}
            </Text>
          ) : null} */}
        </View>
      </Container>
    );
  },
);

export const TokenWallet = ({
  tokens,
  tokenNetWorth,
  showHistory,
}: TokenWalletProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const { on, turnOn, turnOff } = useSwitch();

  const {
    hasExpandSwitch: hasTokensCentiSwitch,
    thresholdIndex: tokensThresholdIdx,
  } = useExpandList(tokens, tokenNetWorth);

  const combinedTokens = useMemo(() => {
    return mergeSmallTokens(tokens, hasTokensCentiSwitch, tokensThresholdIdx);
  }, [tokens, hasTokensCentiSwitch, tokensThresholdIdx]);

  const restTokens = useMemo(() => {
    return tokens?.slice(tokensThresholdIdx);
  }, [tokens, tokensThresholdIdx]);

  const renderItem = useCallback(
    ({ item }: { item: AbstractPortfolioToken }) => {
      return (
        <TokenRow
          data={item}
          style={styles.walletToken}
          showHistory={showHistory}
          onSmallTokenPress={turnOn}
          logoSize={36}
        />
      );
    },
    [showHistory, styles.walletToken, turnOn],
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

  return (
    <>
      <Tabs.FlatList
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        data={combinedTokens}
        getItemLayout={getItemLayout}
        windowSize={2}
      />
      {/* <BottomModal isVisible={on} closeModal={turnOff} height={'60%'}>
        <FlatList
          ListHeaderComponent={listHeader}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          data={restTokens}
          style={styles.scrollView}
        />
      </BottomModal> */}
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

    walletToken: {
      paddingBottom: 26,
    },
    tokenRowWrap: {
      height: 54,
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
    tokenRowToken: {
      color: colors['neutral-foot'],
      fontSize: 13,
      fontWeight: '400',
    },
    tokenRowPrice: {
      fontSize: 13,
      color: colors['neutral-title-1'],
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
    tokenRowUsdValue: {
      textAlign: 'right',
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '700',
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
