import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useReducer } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  formatPerpsFundingCountdown,
  getPerpsFundingCountdownMs,
  PERPS_PRO_FUNDING_SCHEDULE,
  type PerpsServerClockSample,
} from '../../model/funding';
import type { PerpsProMarket } from '../../model/market';
import { formatPerpsProFundingRate } from '../../utils/format';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';

const PERPS_PRO_FUNDING_LABEL_MIN_WIDTH = 136;

const FundingCountdown = React.memo(
  ({ serverClock }: { serverClock: PerpsServerClockSample | null }) => {
    const { styles } = useTheme2024({ getStyle });
    const [, refreshCountdown] = useReducer((tick: number) => tick + 1, 0);
    const hasServerClock = serverClock !== null;

    useEffect(() => {
      if (!hasServerClock) {
        return;
      }
      const timer = setInterval(
        refreshCountdown,
        PERPS_PRO_FUNDING_SCHEDULE.countdownRefreshMs,
      );
      return () => clearInterval(timer);
    }, [hasServerClock]);

    // New feed samples already render this leaf. Read the current clock here
    // instead of publishing a second update and restarting the timer per tick.
    return (
      <Text style={styles.countdown}>
        {formatPerpsFundingCountdown(
          getPerpsFundingCountdownMs(serverClock, Date.now()),
        )}
      </Text>
    );
  },
);

FundingCountdown.displayName = 'PerpsProFundingCountdown';

export const PerpsProFundingSummary: React.FC<{
  market: PerpsProMarket | null;
  onPress: () => void;
  serverClock: PerpsServerClockSample | null;
}> = ({ market, onPress, serverClock }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityLabel={t('page.perps.pro.funding.openDetails')}
      accessibilityRole="button"
      disabled={!market}
      onPress={onPress}
      style={styles.container}>
      <PerpsProDottedUnderlineText
        allowNaturalWidth
        containerStyle={styles.labelContainer}
        style={styles.label}>
        {t('page.perps.pro.funding.summary')}
      </PerpsProDottedUnderlineText>
      <View style={styles.valueLine}>
        <Text style={styles.rate}>
          {formatPerpsProFundingRate(market?.marketData.funding)}
        </Text>
        <Text style={styles.separator}>/</Text>
        <FundingCountdown serverClock={serverClock} />
      </View>
    </Pressable>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: 26,
    justifyContent: 'space-between',
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  labelContainer: {
    minWidth: PERPS_PRO_FUNDING_LABEL_MIN_WIDTH,
  },
  valueLine: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 12,
  },
  rate: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  separator: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 12,
  },
  countdown: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
}));
