import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import Right from '@/assets2024/icons/bridge/IconRightArrowCC.svg';
import { BridgeStatusCaption } from './BridgeStatusUI';
import { BridgeStatusIcon } from './BridgeStatusIcon';
import type { BridgeStatus } from '../utils/status';
import type { BridgeProgressStep, BridgePopupStep } from '../utils/progressBar';

const stepStatus: Record<BridgeProgressStep, BridgePopupStep> = {
  sourceLoading: 'processing',
  destLoading: 'processing',
  destDelayed: 'pending',
  success: 'completed',
  destFailed: 'failed',
  sourceFailed: 'failed',
  queued: 'queued',
  undo: 'refund',
};

export function BridgeProgressCard({
  status,
  onOpen,
  onSupport,
  enabled = true,
}: {
  status: BridgeStatus;
  onOpen: () => void;
  onSupport: () => void;
  enabled?: boolean;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const progress = status.progress;
  if (!progress) {
    return null;
  }
  const source = stepStatus[progress.step1];
  const destination = stepStatus[progress.step2];
  const hasCaption = progress.footer.kind !== 'none';
  const tone = (step: BridgePopupStep) =>
    step === 'completed'
      ? colors2024['green-default']
      : step === 'failed'
      ? colors2024['red-default']
      : step === 'processing'
      ? colors2024['brand-default']
      : step === 'pending'
      ? colors2024['orange-default']
      : step === 'queued' || step === 'refund'
      ? colors2024['neutral-foot']
      : colors2024['neutral-title-1'];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onOpen}
      style={styles.card}>
      <View style={[styles.top, hasCaption && styles.topWithCaption]}>
        <View style={styles.tokens}>
          <AssetAvatar
            logo={status.fromToken?.logo_url}
            chain={status.fromToken?.chain}
            size={24}
            chainSize={10}
          />
          <Text numberOfLines={1} style={styles.symbol}>
            {getTokenSymbol(status.fromToken)}→
          </Text>
          <AssetAvatar
            logo={status.toToken?.logo_url}
            chain={status.toToken?.chain}
            size={24}
            chainSize={10}
          />
          <Text numberOfLines={1} style={[styles.symbol, styles.lastSymbol]}>
            {getTokenSymbol(status.toToken)}
          </Text>
        </View>
        <View style={styles.indicators}>
          <View style={styles.indicator}>
            <Text
              style={[
                styles.number,
                {
                  color:
                    progress.step1 === 'sourceFailed'
                      ? colors2024['neutral-foot']
                      : tone(source),
                },
              ]}>
              1.
            </Text>
            <BridgeStatusIcon status={source} size={18} enabled={enabled} />
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.indicator}>
            <Text style={[styles.number, { color: tone(destination) }]}>
              2.
            </Text>
            <BridgeStatusIcon
              status={destination}
              size={18}
              enabled={enabled}
            />
          </View>
          <Right
            width={14}
            height={14}
            color={colors2024['neutral-secondary']}
          />
        </View>
      </View>
      {hasCaption && (
        <View style={styles.footer}>
          <BridgeStatusCaption status={status} card onSupport={onSupport} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderWidth: 1,
    borderColor: colors2024['brand-disable'],
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  top: {
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topWithCaption: { paddingBottom: 16 },
  tokens: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  symbol: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-body'],
    flexShrink: 1,
  },
  lastSymbol: { flexShrink: 1 },
  indicators: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  number: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  arrow: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
  footer: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
