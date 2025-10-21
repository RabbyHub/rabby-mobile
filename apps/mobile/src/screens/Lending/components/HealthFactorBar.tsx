import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { formatNum } from '@/utils/math';
import { getHealthStatusColor } from '../utils';
import LinearGradient from 'react-native-linear-gradient';
import { HF_COLOR_GOOD_THRESHOLD } from '../utils/constant';

interface HealthFactorBarProps {
  healthFactor: string;
}

export const HealthFactorBar: React.FC<HealthFactorBarProps> = ({
  healthFactor,
}) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });

  const hfNumber = Number(healthFactor || '0');

  const dotPosition = hfNumber > 10 ? 100 : (hfNumber / 10) * 100;

  const hfColor = useMemo(
    () => getHealthStatusColor(isLight, hfNumber),
    [hfNumber, isLight],
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['red', '#F89F1A', 'orange', 'green']}
        locations={[0, 0.15, 0.34, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.riskBar}
      />

      <View
        style={[
          styles.dotContainer,
          { left: `${Math.min(dotPosition, 100)}%` },
        ]}>
        <View style={styles.valueContainer}>
          <Text style={[styles.hfValue, { color: hfColor.color }]}>
            {formatNum(healthFactor)}
          </Text>
          {hfNumber < HF_COLOR_GOOD_THRESHOLD && (
            <Text
              style={
                (styles.riskyText,
                {
                  color: hfColor.color,
                  backgroundColor: hfColor.backgroundColor,
                })
              }>
              Risky
            </Text>
          )}
        </View>

        <View
          style={[
            styles.triangle,
            makeTriangleStyle({
              dir: 'down',
              size: 6,
              color: 'black',
            }),
          ]}
        />
      </View>

      <View style={styles.liquidationContainer}>
        <View style={styles.liquidationMarker} />
        <Text style={styles.liquidationValue}>1.00</Text>
        <Text style={styles.liquidationText}>Liquidation value</Text>
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    position: 'relative',
    marginTop: 33,
    marginBottom: 70,
    width: '100%',
  },
  riskBar: {
    height: 6,
    borderRadius: 3,
  },
  dotContainer: {
    position: 'absolute',
    bottom: '130%',
    marginBottom: 6,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  hfValue: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  triangle: {
    position: 'absolute',
    top: '100%',
    color: 'black',
  },
  liquidationContainer: {
    position: 'absolute',
    left: '0%',
    top: '150%',
    alignItems: 'center',
    maxWidth: '20%',
  },
  liquidationMarker: {
    position: 'absolute',
    top: '-22%',
    left: '50%',
    height: 12,
    width: 3,
    backgroundColor: ctx.colors2024['red-default'],
  },
  liquidationValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  liquidationText: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  riskyText: {
    fontSize: 12,
    fontWeight: '500',
    color: ctx.colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    backgroundColor: ctx.colors2024['orange-light-1'],
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
}));
