import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { formatUsdValue } from '@/utils/number';
import { Skeleton } from '@rneui/themed';
import { openapi, testOpenapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { findChainByServerID } from '@/utils/chain';
import RcIconHistoryLoading from '@/assets/icons/gas-account/IconHistoryLoading.svg';
import { openExternalUrl } from '@/core/utils/linking';
import { sinceTime } from '@/utils/time';
import { useGasAccountHistory } from '../hooks';
import RcIconHistoryIcon from '@/assets/icons/gas-account/history-icon.svg';

const HistoryItem = ({
  time,
  isPending = false,
  value = 0,
  sign = '-',
  borderT = false,
  chainServerId,
  txId,
}: {
  time: number;
  value: number;
  sign: string;
  className?: string;
  isPending?: boolean;
  borderT?: boolean;
  chainServerId?: string;
  txId?: string;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const gotoTxDetail = () => {
    if (chainServerId && txId) {
      const chain = findChainByServerID(chainServerId);
      if (chain && chain.scanLink) {
        const scanLink = chain.scanLink.replace('_s_', '');
        // 使用 Linking 来打开链接
        openExternalUrl(`${scanLink}${txId}`);
      }
    }
  };

  return (
    <View style={[styles.historyItem, borderT && styles.borderTop]}>
      {isPending ? (
        <TouchableOpacity
          style={styles.pendingContainer}
          onPress={gotoTxDetail}>
          <RcIconHistoryLoading style={styles.pendingIcon} />
          <Text style={styles.pendingText}>{t('page.gasAccount.deposit')}</Text>
          {/* <RcIconOpenExternalCC style={styles.externalIcon} /> */}
        </TouchableOpacity>
      ) : (
        <Text style={styles.timeText}>{sinceTime(time)}</Text>
      )}
      <Text style={styles.valueText}>
        {sign}
        {formatUsdValue(value)}{' '}
      </Text>
    </View>
  );
};

const LoadingItem = ({ borderT }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.loadingItem, borderT && styles.borderTop]}>
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
    </View>
  );
};

export const GasAccountHistory = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  // const { loading, txList, loadingMore, ref } = useGasAccountHistory();
  const { loading, txList, loadingMore } = useGasAccountHistory();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (!loading && !txList?.rechargeList.length && !txList?.list.length) {
    return (
      <View style={styles.historyContainer}>
        <RcIconHistoryIcon style={styles.historyIcon} />
        <Text style={styles.historyText}>
          {t('component.gasAccount.history.noHistory')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!loading &&
        txList?.rechargeList?.map((item, index) => (
          <HistoryItem
            key={item.create_at}
            time={item.create_at}
            value={item.amount}
            sign={'+'}
            borderT={index !== 0}
            isPending={true}
            chainServerId={item?.chain_id}
            txId={item?.tx_id}
          />
        ))}
      {!loading &&
        txList?.list.map((item, index) => (
          <HistoryItem
            key={item.create_at}
            time={item.create_at}
            value={item.usd_value}
            sign={item.history_type === 'recharge' ? '+' : '-'}
            borderT={!txList?.rechargeList.length ? index !== 0 : true}
          />
        ))}

      {(loading && !txList) || loadingMore ? (
        <>
          {Array.from({ length: 5 }).map((_, index) => (
            <LoadingItem
              key={index}
              borderT={
                !txList?.rechargeList.length && !txList?.list.length
                  ? index !== 0
                  : true
              }
            />
          ))}
        </>
      ) : null}

      {/* <View ref={ref} /> */}
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    backgroundColor: colors['neutral-card-1'],
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['orange-light'],
    borderRadius: 50,
    padding: 10,
  },
  pendingIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors['orange-default'],
  },
  externalIcon: {
    width: 12,
    height: 12,
  },
  timeText: {
    fontSize: 14,
    color: colors['neutral-foot'],
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },
  loadingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  skeletonStyle: {
    height: 16,
    borderRadius: 4,
    width: 68,
  },
  borderTop: {
    borderTopWidth: 0.5,
    borderTopColor: colors['neutral-line'],
  },
  historyContainer: {
    display: 'flex',
    gap: 8,
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 531,
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
  },
  historyIcon: {
    marginTop: 120,
    width: 28,
    height: 28,
    marginBottom: 8,
  },
  historyText: {
    color: colors['neutral-foot'],
    fontWeight: '500',
    fontSize: 13,
  },
}));
