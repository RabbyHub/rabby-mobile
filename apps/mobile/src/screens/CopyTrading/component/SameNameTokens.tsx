/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import IconEmptyDefi from '@/assets2024/singleHome/empty-defi.png';
import IconEmptyDefiDark from '@/assets2024/singleHome/empty-defi-dark.png';
import { createGetStyles2024 } from '@/utils/styles';
import {
  CopyTradeSameToken,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { openapi } from '@/core/request';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@rneui/themed';
import { formatPrice } from '@/utils/number';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { TabType } from './CopyTradingTokenDetail';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { toast } from '@/components2024/Toast';

interface SameNameTokensProps {
  tradingTokenItem: TokenItem;
  onTokenPress?: (token: any) => void;
}

export const SkeletonSameNameToken = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.tokenItem}>
      <View style={styles.tokenLeft}>
        <Skeleton circle width={46} height={46} />
        <View style={styles.tokenInfo}>
          <View style={styles.tokenNameRow}>
            <Skeleton width={60} height={20} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton
            width={40}
            height={16}
            style={{ borderRadius: 4, marginTop: 4 }}
          />
        </View>
      </View>
      <View style={styles.tokenRight}>
        <Skeleton width={80} height={20} style={{ borderRadius: 4 }} />
      </View>
    </View>
  );
};

export const SameNameTokens: React.FC<SameNameTokensProps> = ({
  tradingTokenItem,
}) => {
  const { colors2024, isLight, styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [sameNameTokens, setSameNameTokens] = useState<CopyTradeSameToken[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSameNameTokens = useMemoizedFn(async () => {
    if (!tradingTokenItem?.chain || !tradingTokenItem?.id) {
      return;
    }

    try {
      setIsLoading(true);
      const data = await openapi.getCopyTradingSameName({
        chain_id: tradingTokenItem.chain,
        token_id: tradingTokenItem.id,
      });

      setSameNameTokens(data);
    } catch (e) {
      console.error('Failed to fetch same name tokens:', e);
      setSameNameTokens([]);
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    fetchSameNameTokens();
  }, [fetchSameNameTokens]);

  const handleTokenPress = useMemoizedFn((token: CopyTradeSameToken) => {
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

  const renderTokenItem = ({ item }: { item: CopyTradeSameToken }) => (
    <TouchableOpacity
      style={StyleSheet.flatten([
        styles.tokenItem,
        item.id === tradingTokenItem.id && styles.currentTokenItem,
      ])}
      onPress={() => handleTokenPress(item)}>
      <View style={styles.tokenLeft}>
        <AssetAvatar
          logo={item.logo_url}
          size={46}
          chain={item.chain}
          chainSize={16}
        />
        <View style={styles.tokenInfo}>
          <View style={styles.tokenNameRow}>
            <Text style={styles.tokenSymbol}>{item.symbol}</Text>
            {item.id === tradingTokenItem.id && (
              <View style={styles.currentTokenBadge}>
                <Text style={styles.currentTokenText}>
                  {t('page.copyTrading.currentToken')}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.tokenPrice}>${formatPrice(item.price || 0)}</Text>
        </View>
      </View>

      <View style={styles.tokenRight}>
        <Text style={styles.liquidityText}>
          {formatUsdValueKMB(item.liquidity || 0)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={isLight ? IconEmptyDefi : IconEmptyDefiDark}
        style={styles.image}
      />
      <Text style={styles.emptyText}>
        {t('page.copyTrading.noOtherTokensWithSameName')}
      </Text>
    </View>
  );

  const renderLoadingComponent = () => (
    <View style={styles.listContainer}>
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonSameNameToken key={index} />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('page.copyTrading.token')}</Text>
        <Text style={styles.liquidityTitle}>
          {t('page.copyTrading.Liquidity')}
        </Text>
      </View>

      {isLoading ? (
        renderLoadingComponent()
      ) : (
        <BottomSheetFlatList
          data={sameNameTokens}
          keyExtractor={item => `${item.chain}-${item.id}`}
          renderItem={renderTokenItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  image: {
    width: 163,
    height: 126,
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  liquidityTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  listContainer: {
    // paddingHorizontal: 16,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
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
  tokenNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  currentTokenBadge: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  currentTokenText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    color: colors2024['brand-default'],
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
  },
  liquidityText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  currentTokenItem: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-disable'],
    borderWidth: 1,
  },
}));
