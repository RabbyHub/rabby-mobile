import React from 'react';
import { Text, View, FlatList, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { formatPrice } from '@/utils/number';

interface SameNameTokensProps {
  tradingTokenItem: CopyTradeTokenItem;
}

// 模拟同名token数据
const mockSameTokens = [
  {
    id: '1',
    symbol: 'DOGE',
    name: 'Dogecoin',
    chain: 'eth',
    price: 0.21,
    change24h: 4.4,
    logo_url: '',
    isOriginal: true,
  },
  {
    id: '2',
    symbol: 'DOGE',
    name: 'Doge Token',
    chain: 'bsc',
    price: 0.18,
    change24h: -2.1,
    logo_url: '',
    isOriginal: false,
  },
  {
    id: '3',
    symbol: 'DOGE',
    name: 'Doge Inu',
    chain: 'polygon',
    price: 0.0034,
    change24h: 12.7,
    logo_url: '',
    isOriginal: false,
  },
];

export const SameNameTokens: React.FC<SameNameTokensProps> = ({
  tradingTokenItem,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const renderTokenItem = ({ item }: { item: (typeof mockSameTokens)[0] }) => (
    <TouchableOpacity style={styles.tokenItem}>
      <View style={styles.tokenLeft}>
        <AssetAvatar
          logo={item.logo_url}
          size={32}
          chain={item.chain}
          chainSize={12}
        />
        <View style={styles.tokenInfo}>
          <View style={styles.tokenNameRow}>
            <Text style={styles.tokenSymbol}>{item.symbol}</Text>
            {item.isOriginal && (
              <View style={styles.originalBadge}>
                <Text style={styles.originalText}>Original</Text>
              </View>
            )}
          </View>
          <Text style={styles.tokenName}>{item.name}</Text>
        </View>
      </View>

      <View style={styles.tokenRight}>
        <Text style={styles.tokenPrice}>${formatPrice(item.price)}</Text>
        <Text
          style={[
            styles.tokenChange,
            {
              color:
                item.change24h >= 0
                  ? colors2024['green-default']
                  : colors2024['red-default'],
            },
          ]}>
          {item.change24h >= 0 ? '+' : ''}
          {item.change24h.toFixed(1)}%
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Same Name Tokens</Text>
      <Text style={styles.subtitle}>
        Other tokens with the same symbol "{tradingTokenItem.symbol}"
      </Text>
      <FlatList
        data={mockSameTokens}
        keyExtractor={item => `${item.chain}-${item.id}`}
        renderItem={renderTokenItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginBottom: 16,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  originalBadge: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  originalText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 2,
  },
  tokenRight: {
    alignItems: 'flex-end',
  },
  tokenPrice: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenChange: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    marginTop: 2,
  },
}));
