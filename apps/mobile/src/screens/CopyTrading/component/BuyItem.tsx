import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { useMemoizedFn } from 'ahooks';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  CopyTradeRecentBuyItem,
  CopyTradePnlItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { getTokenSymbol } from '@/utils/token';
import { ellipsisAddress } from '@/utils/address';
import { formatUsdValueKMB } from '../../Home/utils/price';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { openapi } from '@/core/request';
import { appIsDev } from '@/constant/env';
import { Skeleton } from '@rneui/themed';
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import RcIconArrowDownCC from '@/assets2024/icons/copyTrading/IconDownPolygon.svg';
import { createGetStyles2024 } from '@/utils/styles';
interface ExpandedAddressData {
  loading: boolean;
  data: CopyTradePnlItem[] | null;
}

interface BuyItemProps {
  item: CopyTradeRecentBuyItem;
}

// Skeleton component for loading state
const ProfitHistorySkeletonItem = () => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.profitHistoryItem}>
      <View style={styles.profitHistoryLeft}>
        <Skeleton
          circle
          style={[
            styles.skeletonCircle,
            { backgroundColor: colors2024['neutral-bg-5'] },
          ]}
        />
        <Skeleton
          style={[
            styles.skeletonText,
            styles.skeletonSymbol,
            { backgroundColor: colors2024['neutral-bg-5'] },
          ]}
        />
      </View>
      <Skeleton
        style={[
          styles.skeletonText,
          styles.skeletonValue,
          { backgroundColor: colors2024['neutral-bg-5'] },
        ]}
      />
    </View>
  );
};

const BuyItemComponent: React.FC<BuyItemProps> = ({ item }) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const [isExpanded, setIsExpanded] = useState(false);
  const [profitHistoryData, setProfitHistoryData] =
    useState<ExpandedAddressData>({
      loading: true,
      data: null,
    });

  const handleCopyAddress = useMemoizedFn((address: string) => {
    Clipboard.setString(address);
    toastCopyAddressSuccess(address);
  });

  const fetchProfitHistory = async (address: string) => {
    try {
      // if (appIsDev) {
      //   await new Promise(resolve => setTimeout(resolve, 1000));
      //   return mockUserProfitHistory;
      // }
      const res = await openapi.getCopyTradingPnlList({
        user_addr: address,
      });
      return res?.pnl_list || [];
    } catch (error) {
      console.error('fetchProfitHistory error:', error);
      return [];
    }
  };

  const toggleProfitHistory = async () => {
    if (isExpanded) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      if (!profitHistoryData.data) {
        setProfitHistoryData({
          loading: true,
          data: null,
        });
        const historyData = await fetchProfitHistory(item.user_addr);
        setProfitHistoryData({
          loading: false,
          data: historyData,
        });
      }
    }
  };

  const renderProfitHistory = () => {
    if (!isExpanded) {
      return null;
    }

    return (
      <View style={styles.profitHistoryContainer}>
        <View style={styles.triangleContainer}>
          <View style={styles.triangle} />
        </View>
        <View style={styles.profitHistoryContent}>
          {profitHistoryData.loading ? (
            <>
              <ProfitHistorySkeletonItem />
              <ProfitHistorySkeletonItem />
              <ProfitHistorySkeletonItem />
              <ProfitHistorySkeletonItem />
            </>
          ) : (
            profitHistoryData.data?.map(historyItem => (
              <View key={historyItem.id} style={styles.profitHistoryItem}>
                <View style={styles.profitHistoryLeft}>
                  <AssetAvatar
                    logo={historyItem.logo_url}
                    size={22}
                    chain={historyItem.chain}
                    chainSize={10}
                  />
                  <Text style={styles.profitHistorySymbol}>
                    {getTokenSymbol(historyItem)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.profitHistoryValue,
                    {
                      color: colors2024['green-default'],
                    },
                  ]}>
                  +{formatUsdValueKMB(historyItem.profit_usd_value)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.buyItemContainer}>
      <View style={styles.buyItem}>
        <View style={styles.buyItemContent}>
          <View style={styles.buyItemLeft}>
            <TouchableOpacity
              onPress={() => handleCopyAddress(item.user_addr)}
              style={styles.addressContainer}>
              <Text style={styles.address}>
                {ellipsisAddress(item.user_addr)}
              </Text>
              <RcIconCopy
                width={14}
                height={14}
                color={colors2024['neutral-secondary']}
              />
            </TouchableOpacity>
            <View style={styles.profitRow}>
              <TouchableOpacity
                style={styles.profitLabelContainer}
                onPress={toggleProfitHistory}>
                <RcIconArrowDownCC
                  width={10}
                  height={8}
                  color={colors2024['neutral-title-1']}
                  style={[
                    styles.arrowIcon,
                    isExpanded && styles.arrowIconRotated,
                  ]}
                />
                <Text style={styles.profitLabel}>
                  {t('page.copyTrading.historyProfit')}
                </Text>
                <Text
                  style={[
                    styles.profitValue,
                    {
                      color: colors2024['green-default'],
                    },
                  ]}>
                  +{formatUsdValueKMB(item.user_addr_pnl.profit_usd_value)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.buyItemRight}>
            <Text style={styles.buyLabel}>{t('page.copyTrading.buy')}</Text>
            <Text style={styles.buyAmount}>
              {formatUsdValueKMB(item.buy_usd_value)}
            </Text>
          </View>
        </View>
        {renderProfitHistory()}
      </View>
    </View>
  );
};

export const BuyItem = React.memo(BuyItemComponent);

// Skeleton component for BuyItem loading state
export const SkeletonBuyItem = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.buyItemContainer}>
      <View style={styles.buyItem}>
        <View style={styles.buyItemContent}>
          <View style={styles.buyItemLeft}>
            <View style={styles.addressContainer}>
              <Skeleton width={140} height={20} style={styles.skeletonBorder} />
            </View>
            <View style={styles.profitRow}>
              <Skeleton width={140} height={20} style={styles.skeletonBorder} />
            </View>
          </View>
          <View style={styles.buyItemRight}>
            <Skeleton width={80} height={20} style={styles.skeletonBorder} />
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  buyItemContainer: {
    marginBottom: 12,
  },
  buyItem: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  buyItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBorder: {
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  buyItemLeft: {
    flex: 1,
  },
  buyItemRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexDirection: 'row',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  profitLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  profitValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  buyLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  buyAmount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
  },
  profitHistoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profitHistorySymbol: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  profitHistoryValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  triangleContainer: {
    position: 'absolute',
    left: 120,
    top: -10,
    zIndex: 1,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors2024['neutral-bg-2'],
  },
  skeletonCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  skeletonText: {
    height: 12,
    borderRadius: 4,
  },
  skeletonSymbol: {
    width: 56,
  },
  skeletonValue: {
    width: 68,
  },
  profitHistoryContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  profitHistoryContent: {
    gap: 12,
  },
  arrowIcon: {
    transform: [{ rotate: '0deg' }],
  },
  arrowIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
}));
