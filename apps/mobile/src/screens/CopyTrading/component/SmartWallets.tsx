import React from 'react';
import { Text, View, FlatList, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';

interface SmartWalletsProps {
  tradingTokenItem: CopyTradeTokenItem;
}

// 模拟数据
const mockWallets = [
  {
    id: '1',
    address: '0x1234...5678',
    avatar: '',
    nickname: 'Smart Trader A',
    profit: '+$12,345',
    profitPercent: '+25.4%',
    isPositive: true,
  },
  {
    id: '2',
    address: '0xabcd...ef12',
    avatar: '',
    nickname: 'Whale Hunter',
    profit: '-$3,456',
    profitPercent: '-8.2%',
    isPositive: false,
  },
];

export const SmartWallets: React.FC<SmartWalletsProps> = ({
  tradingTokenItem,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const renderWalletItem = ({ item }: { item: (typeof mockWallets)[0] }) => (
    <TouchableOpacity style={styles.walletItem}>
      <View style={styles.walletLeft}>
        <AssetAvatar size={32} chain={tradingTokenItem.chain} />
        <View style={styles.walletInfo}>
          <Text style={styles.walletNickname}>{item.nickname}</Text>
          <Text style={styles.walletAddress}>{item.address}</Text>
        </View>
      </View>

      <View style={styles.walletRight}>
        <Text
          style={[
            styles.walletProfit,
            {
              color: item.isPositive
                ? colors2024['green-default']
                : colors2024['red-default'],
            },
          ]}>
          {item.profit}
        </Text>
        <Text
          style={[
            styles.walletProfitPercent,
            {
              color: item.isPositive
                ? colors2024['green-default']
                : colors2024['red-default'],
            },
          ]}>
          {item.profitPercent}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Money Wallets</Text>
      <FlatList
        data={mockWallets}
        keyExtractor={item => item.id}
        renderItem={renderWalletItem}
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
    marginBottom: 16,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletNickname: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  walletAddress: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 2,
  },
  walletRight: {
    alignItems: 'flex-end',
  },
  walletProfit: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: 'SF Pro Rounded',
  },
  walletProfitPercent: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    marginTop: 2,
  },
}));
