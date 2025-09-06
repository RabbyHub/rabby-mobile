import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import IconEmptyDefi from '@/assets2024/singleHome/empty-defi.png';
import IconEmptyDefiDark from '@/assets2024/singleHome/empty-defi-dark.png';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Dimensions,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Image,
} from 'react-native';
import { AssetAvatar } from '@/components';
import { getTokenSymbol } from '@/utils/token';
import {
  formatUsdValueKMB,
  formatUsdValueKMBWithSign,
} from '../../Home/utils/price';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { formatNumber, formatPrice, formatUsdValue } from '@/utils/number';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import BigNumber from 'bignumber.js';
import { formatPercentage } from './TokenListItem';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { TabType } from './SameNameTokens';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { QueryCopyTradingBuyItemResult } from '@/databases/entities/copyTradingBuyItem';
import { useCopyTradingProfitData, useProfitData } from './useProfit';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

export type DialogProps = {
  onClose?: () => void;
};

const TokenEarningItem: React.FC<{
  item: QueryCopyTradingBuyItemResult;
  handlePress: (token: TokenItemEntity) => void;
}> = ({ item, handlePress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const holdingValue = item.holdingUsdValue;
  const costValue = item.realAmount * item.buy_price;
  const profit = holdingValue - costValue;
  const profitPercentage = costValue > 0 ? profit / costValue : 0;

  const isPositive = profit >= 0;

  return (
    <TouchableOpacity
      style={styles.tokenItem}
      onPress={() => handlePress(item)}>
      <View style={styles.tokenLeft}>
        <AssetAvatar
          logo={item.logo_url}
          size={46}
          chain={item.chain}
          chainSize={18}
        />
        <View style={styles.tokenInfo}>
          <Text style={styles.tokenName} numberOfLines={1}>
            {getTokenSymbol(item)}
          </Text>
          <Text style={styles.tokenPrice}>${formatPrice(item.price, 6)}</Text>
        </View>
      </View>

      <View style={styles.tokenRight}>
        <Text style={styles.holdingValue}>
          {formatUsdValue(holdingValue, 2, true)}
        </Text>
        <Text
          style={[
            styles.profitText,
            {
              color: isPositive
                ? colors2024['green-default']
                : colors2024['red-default'],
            },
          ]}>
          {formatPercentage(profitPercentage)}
          {`(${profit >= 0 ? '+' : ''}${formatUsdValue(profit, 2, true)})`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function EarningDialog({ onClose }: RNViewProps & DialogProps) {
  const [profitData] = useCopyTradingProfitData();
  const { itemData, totalProfit, totalHoldValue } = useMemo(
    () => profitData || { itemData: [], totalProfit: 0, totalHoldValue: 0 },
    [profitData],
  );

  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const isPositive = (totalProfit || 0) >= 0;

  const [totalValue, setTotalValue] = useState(0);
  useEffect(() => {
    // set state to refresh page to avoid scroll bug
    const value = itemData.reduce((acc, item) => {
      return acc + item.holdingUsdValue;
    }, 0);
    setTotalValue(value);
  }, [itemData]);

  const handleTokenPress = useMemoizedFn((token: TokenItemEntity) => {
    const newToken = {
      ...token,
      cex_ids: [],
    };
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.CopyTradingTokenDetail,
      params: {
        tradingTokenItem: newToken,
        showTabType: TabType.tokenInfo,
      },
    });
    onClose?.();
  });

  const ListHeaderComponent = React.useMemo(
    () => (
      <BottomSheetHandlableView>
        <View style={styles.listHeader}>
          <Text style={styles.dialogTitle}>
            {t('page.copyTrading.myCopyTradingEarnings')}
          </Text>

          <View
            style={[
              styles.totalEarningsContainer,
              {
                backgroundColor: isPositive
                  ? colors2024['green-light-4']
                  : colors2024['neutral-bg-5'],
              },
            ]}>
            <Text style={styles.totalEarningsLabel}>
              {`${t('page.copyTrading.myCopyTrading')}: `}
            </Text>
            <View style={styles.totalEarningsRow}>
              <Text style={styles.totalValue}>
                {formatUsdValueKMB(totalHoldValue)}
              </Text>
              {totalProfit !== 0 && (
                <Text
                  style={[
                    styles.totalProfit,
                    {
                      color: isPositive
                        ? colors2024['green-default']
                        : colors2024['red-default'],
                    },
                  ]}>
                  {`(${formatUsdValueKMBWithSign(totalProfit)})`}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.listTitleContainer}>
            <Text style={styles.ListItemTitle}>
              {t('page.copyTrading.token')}
            </Text>
            <Text style={styles.ListItemTitle}>
              {t('page.copyTrading.holdingProfit')}
            </Text>
          </View>
        </View>
      </BottomSheetHandlableView>
    ),
    [totalProfit, totalHoldValue, isPositive, styles, colors2024, t],
  );

  const renderEmptyComponent = () => {
    return (
      <View style={styles.emptyContainer}>
        <Image
          source={isLight ? IconEmptyDefi : IconEmptyDefiDark}
          style={styles.image}
        />
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  };

  return (
    <AutoLockView style={styles.container}>
      {ListHeaderComponent}
      <BottomSheetFlatList
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={itemData}
        keyExtractor={item => `${item.chain}_${item.id}`}
        renderItem={({ item }) => (
          <TokenEarningItem item={item} handlePress={handleTokenPress} />
        )}
        contentContainerStyle={styles.flatListContent}
        ListEmptyComponent={renderEmptyComponent}
      />
    </AutoLockView>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  scrollContent: {
    flex: 1,
  },
  listHeader: {
    paddingBottom: 8,
  },
  flatListContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  image: {
    width: 163,
    height: 126,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  dialogTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginBottom: 20,
  },

  totalEarningsContainer: {
    backgroundColor: colors2024['green-light'],
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
    padding: 12,
    borderRadius: 6,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  totalEarningsLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  totalEarningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  totalProfit: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },

  listTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // paddingHorizontal: 4,
    padding: 4,
    // marginBottom: 12,
  },
  ListItemTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },

  tokenItem: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  tokenInfo: {
    flex: 1,
    gap: 4,
  },
  tokenName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenPrice: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  holdingValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  profitText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
}));
