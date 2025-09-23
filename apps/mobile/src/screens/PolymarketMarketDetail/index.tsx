import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RouteProp, useRoute } from '@react-navigation/native';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { usePolymarket } from '@/screens/Polymarket/hooks/usePolymarket';

type PolymarketMarketDetailRouteProp = RouteProp<
  TransactionNavigatorParamList,
  'PolymarketMarketDetail'
>;

interface MarketData {
  id: string;
  question: string;
  description: string;
  volume: string;
  endDate: string;
  outcomes: Outcome[];
}

interface Outcome {
  id: string;
  name: string;
  price: string;
  shares: string;
}

export const PolymarketMarketDetailScreen = () => {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
  const route = useRoute<PolymarketMarketDetailRouteProp>();
  const { fetchMarketDetail, buyOutcome, sellOutcome, isLoading, error } =
    usePolymarket();

  const { market } = route.params;
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  const loadMarketDetail = useCallback(async () => {
    try {
      const data = await fetchMarketDetail(market);
      setMarketData(data as MarketData);
    } catch (err) {
      console.error('Failed to load market details:', err);
    }
  }, [fetchMarketDetail, market]);

  useEffect(() => {
    loadMarketDetail();
  }, [loadMarketDetail]);

  const handleBuy = async (outcomeId: string, price: string) => {
    try {
      // In a real implementation, this would open a modal to get the amount
      const result = await buyOutcome(outcomeId, '10', price);
      if (result.success) {
        Alert.alert('Success', 'Successfully placed buy order');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to place buy order');
    }
  };

  const handleSell = async (outcomeId: string, price: string) => {
    try {
      // In a real implementation, this would open a modal to get the amount
      const result = await sellOutcome(outcomeId, '10', price);
      if (result.success) {
        Alert.alert('Success', 'Successfully placed sell order');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to place sell order');
    }
  };

  return (
    <NormalScreenContainer2024>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Market Details</Text>
      </View>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors2024['brand-default']} />
          <Text style={styles.loadingText}>Loading market details...</Text>
        </View>
      ) : marketData ? (
        <View style={styles.content}>
          <View style={styles.questionBox}>
            <Text style={styles.question}>{marketData.question}</Text>
            <Text style={styles.description}>{marketData.description}</Text>
          </View>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Volume:</Text>
              <Text style={styles.infoValue}>{marketData.volume}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>End Date:</Text>
              <Text style={styles.infoValue}>{marketData.endDate}</Text>
            </View>
          </View>

          <View style={styles.outcomesContainer}>
            <Text style={styles.sectionTitle}>Outcomes</Text>
            {marketData.outcomes.map((outcome: Outcome) => (
              <View key={outcome.id} style={styles.outcomeItem}>
                <View style={styles.outcomeInfo}>
                  <Text style={styles.outcomeName}>{outcome.name}</Text>
                  <Text style={styles.outcomePrice}>${outcome.price}</Text>
                </View>
                <View style={styles.outcomeActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.buyButton]}
                    onPress={() => handleBuy(outcome.id, outcome.price)}
                    disabled={isLoading}>
                    <Text style={styles.actionButtonText}>Buy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.sellButton]}
                    onPress={() => handleSell(outcome.id, outcome.price)}
                    disabled={isLoading}>
                    <Text style={styles.actionButtonText}>Sell</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Market not found</Text>
        </View>
      )}
    </NormalScreenContainer2024>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors2024['neutral-title-1'],
  },
  content: {
    flex: 1,
    padding: 20,
  },
  errorBox: {
    backgroundColor: colors2024['red-default'],
    borderRadius: 8,
    padding: 12,
    margin: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors2024['neutral-body'],
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors2024['red-default'],
  },
  questionBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  question: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors2024['neutral-title-1'],
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors2024['neutral-body'],
  },
  infoBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
  },
  outcomesContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 16,
  },
  outcomeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  outcomeInfo: {
    flex: 1,
  },
  outcomeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    marginBottom: 4,
  },
  outcomePrice: {
    fontSize: 14,
    color: colors2024['neutral-body'],
  },
  outcomeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyButton: {
    backgroundColor: colors2024['green-default'],
  },
  sellButton: {
    backgroundColor: colors2024['red-default'],
  },
  actionButtonText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '600',
    fontSize: 14,
  },
}));

export default PolymarketMarketDetailScreen;
