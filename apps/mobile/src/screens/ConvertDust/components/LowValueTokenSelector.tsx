import { Skeleton } from '@rneui/themed';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  TouchableOpacity,
  View,
} from 'react-native';

import RcIconClockCC from '@/assets2024/icons/convertDust/clock-cc.svg';
import RcIconFail from '@/assets2024/icons/convertDust/failed.svg';
import RcIconPending from '@/assets2024/icons/convertDust/pending.svg';
import RcIconSuccess from '@/assets2024/icons/convertDust/success.svg';
import RcIconEmptyTokenDark from '@/assets2024/singleHome/empty-token-dark.svg';
import RcIconEmptyToken from '@/assets2024/singleHome/empty-token.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useTheme2024 } from '@/hooks/theme';
import type { ITokenItem } from '@/store/tokens';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { getTokenIcon } from '@/utils/tokenIcon';
import { thresholds, type DustFilter } from '../constant';
import type { TaskItemStatus } from '../hooks/useBatchSwapTask';

import { Tip } from '@/components';
import { useTranslation } from 'react-i18next';

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
  status?: TaskItemStatus;
  showStatus?: boolean;
  onPress: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity
      disabled={showStatus}
      onPress={onPress}
      style={[styles.tokenRow, showStatus && styles.tokenRowWithStatus]}>
      {showStatus ? (
        <TaskStatusIcon taskStatus={status} />
      ) : (
        <CheckBoxRect checked={selected} size={24} />
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
    </TouchableOpacity>
  );
}

export const TaskStatusIcon = ({
  taskStatus,
}: {
  taskStatus?: TaskItemStatus;
}) => {
  const { colors2024 } = useTheme2024({ getStyle });
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  if (!taskStatus?.status) {
    return null;
  }

  if (taskStatus.status === 'idle') {
    return (
      <RcIconClockCC
        width={24}
        height={24}
        color={colors2024['neutral-info']}
      />
    );
  }

  if (taskStatus?.status === 'pending') {
    return (
      <Animated.View
        style={{
          transform: [{ rotate: spin }],
        }}>
        <RcIconPending width={24} height={24} />
      </Animated.View>
    );
  }

  if (taskStatus?.status === 'success') {
    return <RcIconSuccess width={24} height={24} />;
  }

  if (taskStatus?.status === 'failed') {
    return (
      <Tip content={taskStatus.message}>
        <RcIconFail width={24} height={24} />
      </Tip>
    );
  }

  return null;
};

const LoadingTokenList = () => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.loadingList}>
      {Array.from({ length: 6 }).map((_, index) => {
        return (
          <View key={index} style={styles.loadingRow}>
            {/* <Skeleton style={styles.loadingBlock} width={24} height={24} /> */}
            <Skeleton
              style={styles.loadingBlock}
              circle
              width={24}
              height={24}
            />
            <View style={styles.loadingNameColumn}>
              <Skeleton style={styles.loadingBlock} width={72} height={18} />
            </View>
            <View style={styles.loadingValueColumn}>
              <Skeleton style={styles.loadingBlock} width={64} height={18} />
              <Skeleton style={styles.loadingBlock} width={48} height={16} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

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
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
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
          status={statusItem}
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
            <TouchableOpacity
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
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.listHeader}>
        <TouchableOpacity
          disabled={disabled || showStatus}
          style={styles.tokenHeaderLeft}
          onPress={onToggleAll}>
          {showStatus ? null : (
            <CheckBoxRect checked={hasSelectedToken} size={24} />
          )}
          <Text style={styles.headerText}>
            {showStatus
              ? t('page.convertDust.colStatusToken')
              : t('page.convertDust.colToken')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerText}>
          {t('page.convertDust.colValueAmount')}
        </Text>
      </View>

      <View style={styles.tokenListWrap}>
        {isLoading ? (
          <LoadingTokenList />
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
          <View style={styles.empty}>
            {isLight ? <RcIconEmptyToken /> : <RcIconEmptyTokenDark />}
            <Text style={styles.emptyText}>
              {t('page.convertDust.emptyText')}
            </Text>
          </View>
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
    height: 32,
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
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  emptyText: {
    marginTop: 4,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center',
  },
  loadingList: {
    paddingLeft: 16,
    paddingRight: 24,
  },
  loadingRow: {
    height: 44,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingNameColumn: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
  },
  loadingValueColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  loadingBlock: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-4'],
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
