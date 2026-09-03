import React, { useCallback, useRef } from 'react';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type FlatListProps,
  type ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { useShowPerpsTradeFeeExplanation } from '@/screens/PerpsShared/components/PerpsTradeFeeExplanation';
import { createGetStyles2024 } from '@/utils/styles';
import { PERPS_PRO_FONT_FAMILY } from '@/screens/PerpsPro/components/common/perpsProVisual';

import type {
  PerpsProHistoryRow,
  PerpsProHistoryTab,
  PerpsProHistoryTabState,
} from '../types';
import { PerpsProHistoryRowView } from './PerpsProHistoryRow';
import {
  PerpsProHistoryEmpty,
  PerpsProHistoryError,
  PerpsProHistorySkeleton,
} from './PerpsProHistoryState';
import { PERPS_PRO_HISTORY_FEE_TIPS_OWNER } from '../constants';

const PerpsProHistoryRowSeparator = () => (
  <View style={staticStyles.separator} />
);

export const PerpsProHistoryList: React.FC<{
  active?: boolean;
  amountUnit: PerpsProTradeAmountUnit;
  onLoadEarlier: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  state: PerpsProHistoryTabState;
  scrollHost?: 'bottomSheet' | 'screen';
  tab: PerpsProHistoryTab;
}> = React.memo(
  ({
    active = true,
    amountUnit,
    onLoadEarlier,
    onRefresh,
    onRetry,
    scrollHost = 'screen',
    state,
    tab,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const showTradeFeeExplanation = useShowPerpsTradeFeeExplanation({
      owner: PERPS_PRO_HISTORY_FEE_TIPS_OWNER,
      variant: 'pro',
    });
    const activeRef = useRef(active);
    activeRef.current = active;
    const handleShowTradeFeeExplanation = useCallback(
      (isLiquidation: boolean) => {
        if (activeRef.current) {
          showTradeFeeExplanation(isLiquidation);
        }
      },
      [showTradeFeeExplanation],
    );
    const rowActive = tab === 'transaction' ? active : true;
    const renderItem = useCallback<ListRenderItem<PerpsProHistoryRow>>(
      ({ item }) => (
        <PerpsProHistoryRowView
          active={rowActive}
          amountUnit={amountUnit}
          onShowFeeExplanation={handleShowTradeFeeExplanation}
          row={item}
        />
      ),
      [amountUnit, handleShowTradeFeeExplanation, rowActive],
    );
    const handleEndReached = useCallback(() => {
      if (
        !active ||
        tab === 'orders' ||
        !state.hasEarlier ||
        state.loadingEarlier ||
        state.refreshing ||
        state.loadEarlierError
      ) {
        return;
      }
      onLoadEarlier();
    }, [
      active,
      onLoadEarlier,
      state.hasEarlier,
      state.loadEarlierError,
      state.loadingEarlier,
      state.refreshing,
      tab,
    ]);

    if (state.status === 'idle' || state.status === 'loading') {
      return <PerpsProHistorySkeleton />;
    }
    if (state.status === 'error') {
      return <PerpsProHistoryError onRetry={onRetry} />;
    }

    const listProps: FlatListProps<PerpsProHistoryRow> = {
      contentContainerStyle:
        state.rows.length === 0 ? styles.emptyContent : styles.content,
      data: state.rows,
      extraData: `${amountUnit}:${rowActive}`,
      initialNumToRender: 10,
      ItemSeparatorComponent: PerpsProHistoryRowSeparator,
      keyExtractor: item => item.key,
      ListEmptyComponent: <PerpsProHistoryEmpty />,
      ListFooterComponent: state.loadingEarlier ? (
        <View
          style={styles.loadingFooter}
          testID="perps-pro-history-loading-footer">
          <ActivityIndicator
            accessibilityLabel={t('page.perps.pro.history.loadingMore')}
            accessibilityState={{ busy: true }}
            color={colors2024['neutral-body']}
            size="small"
            style={styles.loadingIndicator}
          />
        </View>
      ) : state.loadEarlierError ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={onLoadEarlier}
            style={({ pressed }) => [
              styles.footerButton,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.footerText}>
              {t('page.perps.pro.common.retry')}
            </Text>
          </Pressable>
        </View>
      ) : null,
      nestedScrollEnabled: scrollHost === 'bottomSheet',
      onEndReached: handleEndReached,
      onEndReachedThreshold: 0.3,
      refreshControl: (
        <RefreshControl
          enabled={active}
          onRefresh={onRefresh}
          refreshing={active && state.refreshing}
        />
      ),
      renderItem,
      scrollEnabled: active,
      showsVerticalScrollIndicator: false,
      testID: `perps-pro-history-list-${tab}`,
    };

    return scrollHost === 'bottomSheet' ? (
      <BottomSheetFlatList {...listProps} />
    ) : (
      <FlatList {...listProps} />
    );
  },
);

PerpsProHistoryList.displayName = 'PerpsProHistoryList';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  content: {
    paddingBottom: 24,
  },
  emptyContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  footer: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
  },
  loadingFooter: {
    alignItems: 'center',
    display: 'flex',
    height: 40,
    justifyContent: 'center',
    width: '100%',
  },
  loadingIndicator: {
    paddingBottom: 10,
  },
  footerButton: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    minWidth: 112,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  footerText: {
    color: colors2024['blue-default'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
}));

const staticStyles = StyleSheet.create({
  separator: {
    height: 8,
  },
});
