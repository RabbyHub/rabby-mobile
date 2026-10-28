import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { findChain } from '@/utils/chain';
import { formatTokenAmount } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { BridgeStatusIcon } from '@/screens/Bridge/components/BridgeStatusIcon';
import { useBridgeStatus } from '@/screens/Bridge/hooks/useBridgeStatus';
import { ExchangeIcon } from './ExchangeIcon';

type Props = {
  data: BridgeHistory;
  local?: BridgeTxHistoryItem;
  recentShowTime?: number;
  onPress?: () => void;
  enabled?: boolean;
};

export function BridgeHistoryItem({
  data,
  local,
  onPress,
  enabled = true,
}: Props) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const status = useBridgeStatus(
    { address: '', history: data, local },
    enabled,
  );
  const sourceFailed = status.scene === 'sourceFailed';
  const sourceSent = status.scene !== 'sourcePending' && !sourceFailed;
  const received = status.completed;
  const receiveToken = received ? status.receiveToken : status.toToken;
  const receiveAmount = received ? status.receiveAmount : status.toAmount;
  const mark = status.failed
    ? 'failed'
    : status.completed
    ? 'completed'
    : status.scene === 'destDelayed'
    ? 'pending'
    : 'processing';
  const fromChain = findChain({ serverId: status.fromToken?.chain });
  const toChain = findChain({ serverId: status.toToken?.chain });
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.card}>
      {(sourceFailed || status.refunded) && (
        <View style={styles.refund}>
          <Text style={styles.refundText}>
            {t('page.bridge.status.refund')}
          </Text>
        </View>
      )}
      <View style={status.failed && styles.dimmed}>
        <ExchangeIcon
          leftIcon={<AssetAvatar logo={status.fromToken?.logo_url} size={32} />}
          rightIcon={<AssetAvatar logo={status.toToken?.logo_url} size={32} />}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.heading}>
            <Text style={styles.title}>
              {t(
                status.completed
                  ? 'page.bridge.status.bridged'
                  : 'page.bridge.title',
              )}
            </Text>
            <BridgeStatusIcon status={mark} size={18} enabled={enabled} />
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.amount,
              sourceSent && styles.sent,
              status.failed && styles.dimmed,
            ]}>
            -{formatTokenAmount(status.fromAmount)}{' '}
            {getTokenSymbol(status.fromToken)}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.route}>
            <Image source={{ uri: fromChain?.logo }} style={styles.chain} />
            <Text style={styles.routeArrow}>→</Text>
            <Image source={{ uri: toChain?.logo }} style={styles.chain} />
            <Text style={styles.divider}>|</Text>
            <Image
              source={{ uri: data.aggregator.logo_url }}
              style={styles.chain}
            />
            <Text numberOfLines={1} style={styles.aggregator}>
              {data.aggregator.name}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.amount,
              received && styles.received,
              status.failed && styles.dimmed,
            ]}>
            +{!received ? '≈' : ''}
            {formatTokenAmount(receiveAmount)} {getTokenSymbol(receiveToken)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    height: 74,
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  content: { flex: 1, gap: 2, minWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 20,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-body'],
  },
  amount: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-info'],
    textAlign: 'right',
  },
  sent: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['red-default'],
  },
  received: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['green-default'],
  },
  dimmed: { opacity: 0.5 },
  route: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  chain: { width: 14, height: 14, borderRadius: 4 },
  routeArrow: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
  },
  divider: { color: colors2024['neutral-secondary'], fontSize: 12 },
  aggregator: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
    maxWidth: 65,
  },
  refund: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    backgroundColor: colors2024['neutral-line'],
  },
  refundText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 14,
    color: colors2024['neutral-title-1'],
  },
}));
