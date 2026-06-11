import React from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import {
  PERPS_SLIPPAGE_THRESHOLD,
  PERPS_SLIPPAGE_WARNING,
} from '../slippageUtils';

export type MarketSlippageProps = {
  slippage: number;
  /** Visible book depth can't cover the full size. */
  depthInsufficient?: boolean;
  /** When provided, the over-threshold banner shows a "switch to limit" action. */
  onSwitchToLimit?: () => void;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
  rowStyle?: StyleProp<ViewStyle>;
};

/** Est. Slippage row (value colored <1% neutral / 1%~5% amber / >=5% red) plus a switch-to-limit banner over threshold. */
export const MarketSlippage: React.FC<MarketSlippageProps> = ({
  slippage,
  onSwitchToLimit,
  visible = true,
  style,
  rowStyle,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  if (!visible) {
    return null;
  }

  const overThreshold = slippage >= PERPS_SLIPPAGE_THRESHOLD;
  const isWarning = !overThreshold && slippage >= PERPS_SLIPPAGE_WARNING;

  const valueColor = overThreshold
    ? colors2024['red-default']
    : isWarning
    ? colors2024['orange-default']
    : colors2024['neutral-title-1'];

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.row, rowStyle]}>
        <Text style={styles.label}>
          {t('page.perpsDetail.MarketSlippage.estimatedSlippage')}
        </Text>
        <Text style={[styles.value, { color: valueColor }]}>
          {(slippage * 100).toFixed(2)}%
        </Text>
      </View>
      {overThreshold && onSwitchToLimit ? (
        <View style={styles.banner}>
          <View style={styles.bannerArrow} />
          <Text style={styles.bannerText}>
            {t('page.perpsDetail.MarketSlippage.lowLiquiditySwitchLimit')}
          </Text>
          <TouchableOpacity style={styles.switchBtn} onPress={onSwitchToLimit}>
            <Text style={styles.switchBtnText}>
              {t('page.perpsDetail.MarketSlippage.switchToLimit')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  banner: {
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 8,
    backgroundColor: colors2024['red-light-1'],
    paddingHorizontal: 8,
    height: 42,
  },
  bannerArrow: {
    position: 'absolute',
    left: 40,
    top: -8,
    ...makeTriangleStyle({
      dir: 'up',
      size: 8,
      color: colors2024['red-light-1'],
    }),
    borderTopWidth: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
  },
  bannerText: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['red-default'],
  },
  switchBtn: {
    paddingHorizontal: 8,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#23C0B0',
  },
  switchBtnText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#040601',
  },
}));
