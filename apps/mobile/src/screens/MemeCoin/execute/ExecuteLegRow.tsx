import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type TextStyle, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcIconArrowCC from '@/assets2024/memecoin/arrow-cc.svg';
import RcIconStatusExecuting from '@/assets2024/memecoin/status-executing.svg';
import RcIconStatusFailed from '@/assets2024/memecoin/status-failed.svg';
import RcIconStatusPending from '@/assets2024/memecoin/status-pending.svg';
import RcIconStatusSuccess from '@/assets2024/memecoin/status-success.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { DashedDivider } from '../components/DashedDivider';
import { FAIL_REASON_I18N_KEY } from '../engine/constants';
import { getLegDisplayStatuses } from '../engine/displayStatus';
import { tokenKey } from '../engine/keys';
import type { DisplayStatus, ExecLeg, FailReason } from '../engine/types';
import type { MemeTradeTaskStore } from '../hooks/useMemeTradeTask';

const SpinningIcon = () => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <RcIconStatusExecuting width={18} height={18} />
    </Animated.View>
  );
};

const LegStatus = ({
  status,
  failReason,
}: {
  status: DisplayStatus;
  failReason?: FailReason;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  if (status === 'hidden') {
    return null;
  }

  let icon: React.ReactNode;
  let text: string;
  let colorStyle: TextStyle;
  if (status === 'pending' || status === 'pendingPrevious') {
    icon = <RcIconStatusPending width={18} height={18} />;
    text =
      status === 'pending'
        ? t('page.memeCoin.execute.statusPending')
        : t('page.memeCoin.execute.statusPendingPrevious');
    colorStyle = styles.colorMuted;
  } else if (status === 'executing') {
    icon = <SpinningIcon />;
    text = t('page.memeCoin.execute.statusExecuting');
    colorStyle = styles.colorExecuting;
  } else if (status === 'success') {
    icon = <RcIconStatusSuccess width={18} height={18} />;
    text = t('page.memeCoin.execute.statusSuccessful');
    colorStyle = styles.colorSuccess;
  } else {
    icon = <RcIconStatusFailed width={18} height={18} />;
    text = t(FAIL_REASON_I18N_KEY[failReason ?? 'failed']);
    colorStyle = styles.colorFailed;
  }

  return (
    <View style={styles.statusRow}>
      {icon}
      <Text style={[styles.statusText, colorStyle]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
};

export const ExecuteLegRow = React.memo(function ExecuteLegRow({
  leg,
  legs,
  mode,
  store,
  tokenLogos,
}: {
  leg: ExecLeg;
  legs: ExecLeg[];
  mode: 'buy' | 'sell';
  store: MemeTradeTaskStore;
  tokenLogos: Record<string, string>;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  // Primitive selectors: a row re-renders only when its own status changes.
  const status = store(s => getLegDisplayStatuses(legs, s.states)[leg.key]);
  const failReason = store(s => s.states[leg.key]?.failReason);
  const payLogo = tokenLogos[tokenKey(leg.pay)];
  const receiveLogo = tokenLogos[tokenKey(leg.receive)];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.side}>
          <AssetAvatar
            logo={payLogo}
            chain={leg.pay.chain}
            size={40}
            chainSize={16}
          />
          {mode === 'buy' ? (
            <Text style={styles.amount} numberOfLines={1}>
              {formatUsdValue(leg.amountUsd)}
            </Text>
          ) : (
            <View style={styles.memeInfo}>
              <Text style={styles.symbol} numberOfLines={1}>
                {leg.pay.symbol}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                {ellipsisAddress(leg.pay.id, 4)}
              </Text>
            </View>
          )}
        </View>
        <RcIconArrowCC
          width={21}
          height={20}
          color={colors2024['neutral-secondary']}
        />
        <View style={[styles.side, styles.sideEnd]}>
          <AssetAvatar
            logo={receiveLogo}
            chain={leg.receive.chain}
            size={40}
            chainSize={16}
          />
          <Text style={styles.symbol} numberOfLines={1}>
            {mode === 'buy'
              ? leg.receive.symbol
              : `≈${formatUsdValue(leg.amountUsd)}`}
          </Text>
        </View>
      </View>
      <DashedDivider style={styles.divider} />
      <LegStatus status={status} failReason={failReason} />
    </View>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors2024['neutral-card-1'],
  },
  topRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  side: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sideEnd: {
    justifyContent: 'flex-end',
  },
  memeInfo: {
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  amount: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  symbol: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  divider: {
    marginTop: 10,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  colorMuted: {
    color: colors2024['neutral-secondary'],
  },
  colorExecuting: {
    color: colors2024['blue-default'],
  },
  colorSuccess: {
    color: colors2024['green-default'],
  },
  colorFailed: {
    color: colors2024['red-default'],
  },
}));
