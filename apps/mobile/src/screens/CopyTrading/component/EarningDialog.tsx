import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';

import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Dimensions,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { AssetAvatar } from '@/components';
import { getTokenSymbol } from '@/utils/token';
import {
  formatUsdValueKMB,
  formatUsdValueKMBWithSign,
} from '../../Home/utils/price';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { formatPrice, formatUsdValue } from '@/utils/number';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import BigNumber from 'bignumber.js';
import { formatPercentage } from './TokenListItem';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { TabType } from './CopyTradingTokenDetail';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';

export type DialogProps = {
  itemData: (TokenItemEntity & { buy_amount: number; buy_price: number })[];
  totalProfit: number;
  totalHoldValue: number;
  onClose?: () => void;
};

const TokenEarningItem: React.FC<{
  item: TokenItemEntity & { buy_amount: number; buy_price: number };
  handlePress: (token: TokenItemEntity) => void;
}> = ({ item, handlePress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const holdingValue = new BigNumber(
    Math.min(item.amount, item.buy_amount),
  ).multipliedBy(item.price);
  const costValue = new BigNumber(item.buy_amount).multipliedBy(item.buy_price);
  const profit = holdingValue.minus(costValue);
  const profitPercentage = costValue.isGreaterThan(0)
    ? profit.dividedBy(costValue)
    : new BigNumber(0);

  const isPositive = profit.isGreaterThanOrEqualTo(0);

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
          <Text style={styles.tokenPrice}>${formatPrice(item.price)}</Text>
        </View>
      </View>

      <View style={styles.tokenRight}>
        <Text style={styles.holdingValue}>
          {formatUsdValue(holdingValue.toNumber(), 2, true)}
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
          {formatPercentage(profitPercentage.toNumber())}
          {`(${formatUsdValue(profit.toNumber(), 2, true)})`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function EarningDialog({
  itemData,
  totalProfit,
  totalHoldValue,
  onClose,
}: RNViewProps & DialogProps) {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const isPositive = (totalProfit || 0) >= 0;

  const handleTokenPress = useMemoizedFn((token: TokenItemEntity) => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.COPY_TRADING_TOKEN_DETAIL,
      tradingTokenItem: token,
      showTabType: TabType.tokenInfo,
      bottomSheetModalProps: {
        enableContentPanningGesture: false,
        enablePanDownToClose: true,
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
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

  return (
    <AutoLockView style={styles.container}>
      <BottomSheetFlatList
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={itemData}
        keyExtractor={item => `${item.chain}_${item.id}`}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={({ item }) => (
          <TokenEarningItem item={item} handlePress={handleTokenPress} />
        )}
        contentContainerStyle={styles.flatListContent}
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

  dialogTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
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
