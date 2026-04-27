import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import RcCaretDownSmallCC from '@/assets2024/icons/common/caret-down-small-cc.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { Chain } from '@debank/common';
import type { BatchSwapTaskType } from '../hooks/useBatchSwapTask';

function SettingRow({
  label,
  value,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingValueWrap}>
        <Text style={styles.settingValue}>{value}</Text>
        <RcCaretDownSmallCC
          width={14}
          height={14}
          color={colors2024['neutral-title-1']}
        />
      </View>
    </TouchableOpacity>
  );
}

export function ReceiveSummary({
  chain,
  receiveAmount,
  receiveToken,
  receiveUsd,
  task,
  onOpenGasLimit,
  onOpenPriceImpact,
}: {
  chain?: Chain | null;
  receiveAmount: string | number;
  receiveToken?: TokenItem | null;
  receiveUsd: number;
  task: BatchSwapTaskType;
  onOpenGasLimit: () => void;
  onOpenPriceImpact: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });
  const receiveTokenSymbol = receiveToken
    ? getTokenSymbol(receiveToken) || 'Unknown'
    : 'Unknown';
  const isConverting = task.status !== 'idle' && task.status !== 'completed';
  const currentToken = task.currentToken;
  const currentIndex = Math.max(task.currentTaskIndex, 0) + 1;

  return (
    <>
      <View
        style={[
          styles.receiveCard,
          isConverting && styles.receiveCardConverting,
        ]}>
        <View style={styles.receiveTopRow}>
          <View style={styles.receiveTokenWrap}>
            <AssetAvatar
              logo={receiveToken?.logo_url}
              size={46}
              chain={chain?.serverId}
              chainSize={18}
              innerChainStyle={styles.receiveChainBadge}
            />
            <Text style={styles.receiveSymbol}>{receiveTokenSymbol}</Text>
          </View>
          <View style={styles.receiveValueWrap}>
            <Text style={styles.receiveHint}>
              Est.Receive: {receiveAmount} {receiveTokenSymbol}
            </Text>
            <Text
              style={[
                styles.receiveValue,
                isConverting && styles.receiveValueConverting,
              ]}>
              {formatUsdValue(receiveUsd)}
            </Text>
          </View>
        </View>

        {isConverting ? (
          <>
            <View style={styles.progressDivider} />
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Conversion progress</Text>
              <View style={styles.progressValueWrap}>
                <View style={styles.progressTokenPair}>
                  {currentToken ? (
                    <AssetAvatar
                      logo={currentToken.logo_url}
                      size={24}
                      chain={currentToken.chain}
                      chainSize={10}
                      innerChainStyle={styles.progressChainBadge}
                    />
                  ) : null}
                  <Text style={styles.progressArrow}>→</Text>
                  <AssetAvatar
                    logo={receiveToken?.logo_url}
                    size={24}
                    chain={chain?.serverId}
                    chainSize={10}
                    innerChainStyle={styles.progressChainBadge}
                  />
                </View>
                <Text style={styles.progressCount}>
                  {currentIndex} / {task.list.length}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {isConverting ? null : (
        <View style={styles.settingsBlock}>
          <SettingRow
            label="Price Impact"
            value={`${task.config.priceImpact}%`}
            disabled={task.status !== 'idle'}
            onPress={onOpenPriceImpact}
          />
          <SettingRow
            label="Single Transaction Gas Limit"
            value={`$${task.config.maxGasCost}`}
            disabled={task.status !== 'idle'}
            onPress={onOpenGasLimit}
          />
        </View>
      )}
    </>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  receiveCard: {
    height: 80,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 16,
    justifyContent: 'center',
  },
  receiveCardConverting: {
    height: 128,
    gap: 12,
  },
  receiveTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiveTokenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiveChainBadge: {
    borderWidth: 1.5,
    borderColor: colors2024['neutral-bg-1'],
  },
  receiveSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  receiveValueWrap: {
    alignItems: 'flex-end',
  },
  receiveHint: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  receiveValue: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  receiveValueConverting: {
    color: colors2024['neutral-title-1'],
  },
  progressDivider: {
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  progressValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTokenPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressChainBadge: {
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
  progressArrow: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  progressCount: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  settingsBlock: {
    marginTop: 14,
    paddingHorizontal: 4,
    gap: 14,
  },
  settingRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  settingValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
