import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useTheme2024 } from '@/hooks/theme';
import type { ITokenItem } from '@/store/tokens';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenIcon } from '@/utils/tokenIcon';
import { thresholds, type DustFilter } from '../constant';
import type { TaskItemStatus } from '../hooks/useBatchSwapTask';
import { getTokenSymbol } from '@/utils/token';

const getTokenKey = (token: ITokenItem) =>
  `${token.owner_addr}:${token.chain}:${token.id}`;

function DustTokenRow({
  token,
  selected,
  status,
  showStatus,
  onPress,
}: {
  token: ITokenItem;
  selected: boolean;
  status?: TaskItemStatus['status'];
  showStatus?: boolean;
  onPress: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <Pressable
      disabled={showStatus}
      onPress={onPress}
      style={[styles.tokenRow, showStatus && styles.tokenRowWithStatus]}>
      {showStatus ? (
        <TaskStatusIcon status={status} />
      ) : (
        <CheckBoxRect checked={selected} size={18} />
      )}
      <AssetAvatar
        logo={token.logo_url || getTokenIcon(token.symbol)}
        size={24}
        chain={token.chain}
        chainSize={10}
        innerChainStyle={styles.tokenChainBadge}
      />
      <View style={styles.tokenNameColumn}>
        <Text style={styles.tokenSymbol} numberOfLines={1}>
          {getTokenSymbol(token)}
        </Text>
      </View>
      <View style={styles.tokenValueColumn}>
        <Text style={styles.tokenValue} numberOfLines={1}>
          {formatUsdValue(token.usd_value)}
        </Text>
        <Text style={styles.tokenAmount} numberOfLines={1}>
          {formatTokenAmount(token.amount)}
        </Text>
      </View>
    </Pressable>
  );
}

function TaskStatusIcon({ status }: { status?: TaskItemStatus['status'] }) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  if (status === 'pending') {
    return (
      <View style={styles.statusIconWrap}>
        <ActivityIndicator size="small" color={colors2024['orange-default']} />
      </View>
    );
  }

  if (status === 'success') {
    return (
      <View style={styles.statusIconWrap}>
        <View style={[styles.statusCircle, styles.statusCircleSuccess]}>
          <Text style={styles.statusSuccessMark}>✓</Text>
        </View>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.statusIconWrap}>
        <View style={[styles.statusCircle, styles.statusCircleFailed]}>
          <Text style={styles.statusFailedMark}>!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.statusIconWrap}>
      <View style={styles.statusClock}>
        <View style={styles.statusClockHandVertical} />
        <View style={styles.statusClockHandHorizontal} />
      </View>
    </View>
  );
}

export function LowValueTokenSelector({
  disabled,
  hasSelectedToken,
  isLoading,
  selectedFilter,
  selectedTokenIds,
  showStatus,
  statusDict,
  tokens,
  currentTaskIndex,
  onFilterChange,
  onToggleAll,
  onToggleToken,
}: {
  disabled?: boolean;
  hasSelectedToken: boolean;
  isLoading: boolean;
  selectedFilter: DustFilter;
  selectedTokenIds: Set<string>;
  showStatus: boolean;
  statusDict: Record<string, TaskItemStatus>;
  tokens: ITokenItem[];
  currentTaskIndex: number;
  onFilterChange: (filter: DustFilter) => void;
  onToggleAll: () => void;
  onToggleToken: (token: ITokenItem) => void;
}) {
  const { styles } = useTheme2024({ getStyle });
  const listRef = useRef<FlatList<ITokenItem>>(null);
  const pendingIndex = useMemo(() => {
    if (currentTaskIndex >= 0) {
      return currentTaskIndex;
    }
    return tokens.findIndex(item => statusDict[item.id]?.status === 'pending');
  }, [currentTaskIndex, statusDict, tokens]);

  useEffect(() => {
    if (!showStatus || pendingIndex < 0 || pendingIndex >= tokens.length) {
      return;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: pendingIndex,
        animated: true,
        viewPosition: 1,
      });
    });
  }, [pendingIndex, showStatus, tokens.length]);

  const renderTokenItem = useCallback(
    ({ item }: { item: ITokenItem }) => {
      const statusItem = statusDict[item.id];
      return (
        <DustTokenRow
          token={item}
          selected={selectedTokenIds.has(item.id)}
          status={statusItem?.status}
          showStatus={showStatus}
          onPress={() => onToggleToken(item)}
        />
      );
    },
    [onToggleToken, selectedTokenIds, showStatus, statusDict],
  );

  return (
    <View style={[styles.convertCard, showStatus && styles.convertCardActive]}>
      <View style={[styles.filterRow, showStatus && styles.filterRowDisabled]}>
        {thresholds.map(filter => {
          const selected = selectedFilter.value === filter.value;
          return (
            <Pressable
              key={filter.value}
              onPress={() => onFilterChange(filter)}
              disabled={disabled}
              style={[styles.filterChip, selected && styles.filterChipActive]}>
              <Text
                style={[
                  styles.filterText,
                  selected && styles.filterTextActive,
                ]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.listHeader}>
        <Pressable
          disabled={disabled || showStatus}
          style={styles.tokenHeaderLeft}
          onPress={onToggleAll}>
          {showStatus ? null : (
            <CheckBoxRect checked={hasSelectedToken} size={18} />
          )}
          <Text style={styles.headerText}>
            {showStatus ? 'Status/Token' : 'Token'}
          </Text>
        </Pressable>
        <Text style={styles.headerText}>Value/Amount</Text>
      </View>

      <View style={styles.tokenListWrap}>
        {isLoading ? (
          <Text style={styles.emptyText}>Loading tokens...</Text>
        ) : tokens.length ? (
          <FlatList
            ref={listRef}
            style={styles.tokenListScroll}
            data={tokens}
            keyExtractor={getTokenKey}
            renderItem={renderTokenItem}
            getItemLayout={(_, index) => ({
              length: 44,
              offset: 44 * index,
              index,
            })}
            onScrollToIndexFailed={info => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 1,
                });
              }, 100);
            }}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.tokenListScrollContent}
          />
        ) : (
          <Text style={styles.emptyText}>No dust tokens</Text>
        )}
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  convertCard: {
    flex: 1,
    minHeight: 180,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingVertical: 12,
    overflow: 'hidden',
    maxHeight: 396,
  },
  convertCardActive: {
    flex: 0,
    height: 220,
    minHeight: 220,
    maxHeight: 220,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  filterRowDisabled: {
    opacity: 0.3,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors2024['neutral-line'],
  },
  filterText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  filterTextActive: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  listHeader: {
    paddingLeft: 16,
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  tokenListWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  tokenListScroll: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 16,
  },
  tokenListScrollContent: {},
  emptyText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 72,
    textAlign: 'center',
  },
  tokenRow: {
    height: 44,
    paddingVertical: 2,
    paddingLeft: 4,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenRowWithStatus: {
    height: 44,
    paddingVertical: 2,
  },
  tokenChainBadge: {
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
  tokenNameColumn: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
  },
  tokenSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  tokenValueColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  tokenValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  tokenAmount: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  statusIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCircleSuccess: {
    backgroundColor: colors2024['green-default'],
  },
  statusCircleFailed: {
    backgroundColor: colors2024['red-default'],
  },
  statusSuccessMark: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  statusFailedMark: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  statusClock: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D4DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusClockHandVertical: {
    width: 2,
    height: 5,
    borderRadius: 1,
    backgroundColor: '#D1D4DB',
    position: 'absolute',
    top: 3,
  },
  statusClockHandHorizontal: {
    width: 5,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#D1D4DB',
    position: 'absolute',
    right: 3,
    top: 7,
  },
  scrollbarThumb: {
    position: 'absolute',
    right: 5,
    top: 58,
    width: 5,
    height: 78,
    borderRadius: 100,
    backgroundColor: colors2024['neutral-line'],
  },
}));
