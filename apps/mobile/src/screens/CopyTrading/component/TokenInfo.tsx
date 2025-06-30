import React from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenPriceChart } from '@/screens/TokenDetail/components/TokenPriceChart';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
interface TokenInfoProps {
  tradingTokenItem: CopyTradeTokenItem;
}

export const TokenInfo: React.FC<TokenInfoProps> = ({ tradingTokenItem }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <BottomSheetScrollView style={styles.container}>
      <TokenPriceChart
        token={ensureAbstractPortfolioToken(tradingTokenItem)}
        originToken={ensureAbstractPortfolioToken(tradingTokenItem)}
        amountList={[]}
      />
      <View style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Info</Text>
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Created Time</Text>
            <Text style={styles.value}>2025/4/30 12:30</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Token Name</Text>
            <Text style={styles.value}>
              {tradingTokenItem.symbol || 'Doge'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Chain</Text>
            <Text style={styles.value}>BNB</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Contract Address</Text>
            <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
              0x5643...vb45
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>FDV</Text>
            <Text style={styles.value}>$329.17B</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Liquidity</Text>
            <Text style={styles.value}>$1,329.17B</Text>
          </View>
        </View>
      </View>
    </BottomSheetScrollView>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  infoContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  value: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    maxWidth: 200,
  },
}));
