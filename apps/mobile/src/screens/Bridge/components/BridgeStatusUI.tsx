import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { findChain } from '@/utils/chain';
import { ellipsisAddress } from '@/utils/address';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { openTxExternalUrl } from '@/utils/transaction';
import { useTranslation } from 'react-i18next';
import Jump from '@/assets2024/icons/history/IconJumpCC.svg';
import StepArrow from '@/assets2024/icons/bridge/IconBridgeStepArrowCC.svg';
import type { BridgeStatus } from '../utils/status';
import type { BridgePopupStep } from '../utils/progressBar';
import { BridgeStatusIcon } from './BridgeStatusIcon';
import type { BridgeHistoryDetailStep } from '../utils/historyStatus';

export function BridgeStatusCaption({
  status,
  card = false,
  onSupport,
}: {
  status: BridgeStatus;
  card?: boolean;
  onSupport: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const caption = card ? status.progress?.footer : status.detail.action;
  let label = '';
  let action: 'support' | 'refund' | undefined;
  if (caption?.kind === 'countdown') {
    return (
      <Text style={[styles.caption, !card && styles.detailCaption]}>
        {t('page.bridge.status.bridging')}{' '}
        <Text style={styles.eta}>
          {t('page.bridge.status.eta', { time: caption.time })}
        </Text>
      </Text>
    );
  }
  if (caption?.kind === 'stillBridging') {
    label = t('page.bridge.status.stillBridging');
  }
  if (caption?.kind === 'delayed') {
    label = t('page.bridge.status.delayed');
    action = card ? 'support' : undefined;
  }
  if (
    caption?.kind === 'sourceFailed' ||
    (!card && status.scene === 'sourceFailed')
  ) {
    label = t('page.bridge.status.sourceFailed', {
      token: getTokenSymbol(status.fromToken),
    });
  }
  if (caption?.kind === 'failedNoRefund') {
    label = t('page.bridge.status.bridgeFailed');
    action = 'support';
  }
  if (caption?.kind === 'refund') {
    const refundLinkAvailable =
      !!caption.txId &&
      !!findChain({ serverId: caption.chainServerId })?.scanLink;
    label = refundLinkAvailable
      ? caption.isOriginalToken
        ? t('page.bridge.status.refunded')
        : t('page.bridge.status.refundedIn', {
            token: getTokenSymbol(status.receiveToken),
          })
      : t('page.bridge.status.bridgeFailed');
    action = refundLinkAvailable ? 'refund' : 'support';
  }
  if (caption?.kind === 'details' && caption.refundInSymbol) {
    label = t('page.bridge.status.refundedIn', {
      token: caption.refundInSymbol,
    });
  }
  if (!label) {
    return null;
  }
  return (
    <View style={styles.captionRow}>
      <Text style={[styles.caption, !card && styles.detailCaption]}>
        {label}
        {action === 'support' ? ',' : ''}
      </Text>
      {action && (
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={8}
          onPress={event => {
            event.stopPropagation();
            action === 'support'
              ? onSupport()
              : openTxExternalUrl({
                  chain: status.refundChain,
                  txHash: status.refundHash,
                });
          }}>
          <Text style={styles.captionLink}>
            {t(
              action === 'support'
                ? 'page.bridge.status.contactSupport'
                : 'page.bridge.status.viewDetails',
            )}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function BridgeStatusSteps({
  status,
  enabled = true,
}: {
  status: BridgeStatus;
  enabled?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.steps}>
      {status.detail.steps.map((step, index) => (
        <BridgeStep
          key={index}
          step={step}
          index={index}
          last={index === status.detail.steps.length - 1}
          pending={status.detail.header === 'pending' && index === 1}
          enabled={enabled}
        />
      ))}
    </View>
  );
}

function BridgeStep({
  step,
  index,
  last,
  pending,
  enabled,
}: {
  step: BridgeHistoryDetailStep;
  index: number;
  last: boolean;
  pending: boolean;
  enabled: boolean;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const chain = findChain({ serverId: step.chainServerId });
  const displayStatus: BridgePopupStep =
    step.direction === 'refund' ? 'refund' : pending ? 'pending' : step.status;
  const hash = step.detail.kind === 'hash' ? step.detail.txId : undefined;
  const queued = displayStatus === 'queued';
  const tone =
    displayStatus === 'completed'
      ? colors2024['green-default']
      : displayStatus === 'failed'
      ? colors2024['red-default']
      : displayStatus === 'processing'
      ? colors2024['brand-default']
      : displayStatus === 'pending'
      ? colors2024['orange-default']
      : colors2024['neutral-title-1'];
  const bg =
    displayStatus === 'completed'
      ? colors2024['green-light-1']
      : displayStatus === 'failed'
      ? colors2024['red-light-1']
      : displayStatus === 'processing'
      ? colors2024['brand-light-1']
      : displayStatus === 'pending'
      ? colors2024['orange-light-1']
      : colors2024['neutral-line'];
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, queued && styles.queued]}>
        <Text style={styles.stepNumberText}>{index + 1}</Text>
      </View>
      {!last && <StepArrow width={18} height={69} style={styles.stepArrow} />}
      <View style={[styles.stepHeading, queued && styles.queued]}>
        <View style={styles.stepHeadingText}>
          <Text style={styles.stepTitle} numberOfLines={1}>
            {t(
              step.direction === 'send'
                ? 'page.bridge.status.sendingFrom'
                : 'page.bridge.status.receivingOn',
              { chain: chain?.name || step.token?.chain || '' },
            )}
          </Text>
          {hash ? (
            <TouchableOpacity
              hitSlop={6}
              style={styles.hashRow}
              onPress={() =>
                openTxExternalUrl({ chain: step.chainServerId, txHash: hash })
              }>
              <Text style={styles.hash}>{ellipsisAddress(hash)}</Text>
              <Jump
                width={12}
                height={12}
                color={colors2024['neutral-secondary']}
              />
            </TouchableOpacity>
          ) : (
            <Text style={styles.waiting}>
              {t(
                step.detail.kind === 'tokenNotSent'
                  ? 'page.bridge.status.tokenNotSent'
                  : step.detail.kind === 'bridgeFailed' ||
                    step.detail.kind === 'sendFailed'
                  ? 'page.bridge.status.bridgeFailed'
                  : 'page.bridge.status.waiting',
                { token: getTokenSymbol(step.token) },
              )}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <BridgeStatusIcon
            status={displayStatus}
            size={14}
            enabled={enabled}
          />
          <Text style={[styles.badgeText, { color: tone }]}>
            {t(`page.bridge.status.${displayStatus}`)}
          </Text>
        </View>
      </View>
      <View style={[styles.stepAmounts, queued && styles.queued]}>
        <Text numberOfLines={1} style={styles.stepAmount}>
          {step.sign}
          {step.approx ? '≈' : ''}
          {formatTokenAmount(step.amount)} {getTokenSymbol(step.token)}
        </Text>
        <Text style={styles.stepUsd}>
          {step.sign}
          {step.approx ? '≈' : ''}
          {formatUsdValue(step.amount * (step.token?.price || 0))}
        </Text>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  caption: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  detailCaption: { fontSize: 14, lineHeight: 18 },
  steps: { gap: 8 },
  eta: { color: colors2024['neutral-title-1'] },
  captionLink: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['brand-default'],
  },
  step: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 12,
    paddingVertical: 12,
    minHeight: 98,
  },
  queued: { opacity: 0.3 },
  stepNumber: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 20,
    height: 20,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 14,
    fontStyle: 'italic',
    color: colors2024['neutral-body'],
  },
  stepArrow: {
    position: 'absolute',
    left: 15,
    top: 39,
    width: 18,
    height: 69,
    zIndex: 1,
  },
  stepHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  stepHeadingText: { flex: 1, gap: 4 },
  stepTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-body'],
  },
  hashRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hash: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
    textDecorationLine: 'underline',
  },
  waiting: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
  },
  stepAmounts: {
    borderTopWidth: 1,
    borderTopColor: colors2024['neutral-line'],
    marginTop: 8,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepAmount: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  stepUsd: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
}));
