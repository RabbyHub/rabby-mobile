import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
  type ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

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

export const PerpsProHistoryList: React.FC<{
  active?: boolean;
  amountUnit: PerpsProTradeAmountUnit;
  onLoadEarlier: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  state: PerpsProHistoryTabState;
  tab: PerpsProHistoryTab;
}> = ({
  active = true,
  amountUnit,
  onLoadEarlier,
  onRefresh,
  onRetry,
  state,
  tab,
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const renderItem = useCallback<ListRenderItem<PerpsProHistoryRow>>(
    ({ item }) => <PerpsProHistoryRowView amountUnit={amountUnit} row={item} />,
    [amountUnit],
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

  return (
    <FlatList
      contentContainerStyle={
        state.rows.length === 0 ? styles.emptyContent : styles.content
      }
      data={state.rows}
      extraData={amountUnit}
      initialNumToRender={10}
      keyExtractor={item => item.key}
      ListEmptyComponent={<PerpsProHistoryEmpty tab={tab} />}
      ListFooterComponent={
        state.loadingEarlier || state.loadEarlierError ? (
          <View style={styles.footer}>
            {state.loadingEarlier ? (
              <ActivityIndicator
                accessibilityLabel={t('page.perps.pro.history.loadingMore')}
                accessibilityState={{ busy: true }}
                color={colors2024['blue-default']}
              />
            ) : (
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
            )}
          </View>
        ) : null
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          colors={[colors2024['blue-default']]}
          enabled={active}
          onRefresh={onRefresh}
          refreshing={state.refreshing}
          tintColor={colors2024['blue-default']}
        />
      }
      renderItem={renderItem}
      scrollEnabled={active}
      showsVerticalScrollIndicator={false}
      testID={`perps-pro-history-list-${tab}`}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  content: {
    paddingBottom: 24,
    paddingTop: 16,
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
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
}));
