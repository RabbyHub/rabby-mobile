import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePolymarket } from '@/screens/Polymarket/hooks/usePolymarket';

interface MarketItem {
  id: string;
  question: string;
  volume: string;
  endDate: string;
}

export const PolymarketMarketListScreen = () => {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
  const navigation = useRabbyAppNavigation();
  const { fetchMarkets, isLoading, error } = usePolymarket();

  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<MarketItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMarkets(markets);
    } else {
      const filtered = markets.filter(market =>
        market.question.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredMarkets(filtered);
    }
  }, [searchQuery, markets]);

  const loadMarkets = useCallback(async () => {
    try {
      const data = await fetchMarkets();
      setMarkets(data as MarketItem[]);
      setFilteredMarkets(data as MarketItem[]);
    } catch (err) {
      console.error('Failed to load markets:', err);
    }
  }, [fetchMarkets]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const renderMarketItem = ({ item }: { item: MarketItem }) => (
    <TouchableOpacity
      style={styles.marketItem}
      onPress={() =>
        navigation.navigate(RootNames.StackTransaction, {
          screen: RootNames.PolymarketMarketDetail,
          params: { market: item.id },
        })
      }>
      <Text style={styles.question}>{item.question}</Text>
      <View style={styles.marketInfo}>
        <Text style={styles.volume}>Volume: {item.volume}</Text>
        <Text style={styles.endDate}>Ends: {item.endDate}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <NormalScreenContainer2024>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prediction Markets</Text>
      </View>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search markets..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors2024['neutral-secondary']}
        />
      </View>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors2024['brand-default']} />
          <Text style={styles.loadingText}>Loading markets...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMarkets}
          renderItem={renderMarketItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshing={isLoading}
          onRefresh={loadMarkets}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No markets found</Text>
            </View>
          }
        />
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
  searchContainer: {
    padding: 20,
    paddingTop: 10,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors2024['neutral-title-1'],
    backgroundColor: colors2024['neutral-bg-1'],
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
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
  errorBox: {
    backgroundColor: colors2024['red-default'],
    borderRadius: 8,
    padding: 12,
    margin: 20,
  },
  errorText: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
  },
  marketItem: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    marginBottom: 8,
  },
  marketInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  volume: {
    fontSize: 14,
    color: colors2024['neutral-body'],
  },
  endDate: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors2024['neutral-secondary'],
  },
}));

export default PolymarketMarketListScreen;
