import React from 'react';
import { View, Text } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { formatNum } from '@/utils/math';
import { getHealthStatusColor } from '../utils';
import LinearGradient from 'react-native-linear-gradient';

interface HealthFactorBarProps {
  healthFactor: string;
}

export const HealthFactorBar: React.FC<HealthFactorBarProps> = ({
  healthFactor,
}) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });

  const hfNumber = Number(healthFactor || '0');

  // 计算点的位置，最大显示到10
  const dotPosition = hfNumber > 10 ? 100 : (hfNumber / 10) * 100;

  const hfColor = getHealthStatusColor(isLight, hfNumber);

  return (
    <View style={styles.container}>
      {/* 渐变风险条 */}
      <LinearGradient
        colors={['red', '#F89F1A', 'orange', 'green']}
        locations={[0, 0.15, 0.34, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.riskBar}
      />

      {/* Health Factor 数值和标记点 */}
      <View
        style={[
          styles.dotContainer,
          { left: `${Math.min(dotPosition, 100)}%` },
        ]}>
        <View style={styles.valueContainer}>
          <Text style={[styles.hfValue, { color: hfColor.color }]}>
            {formatNum(healthFactor)}
          </Text>
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

      {/* 清算线标记 */}
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
    position: 'relative',
    alignItems: 'center',
    marginBottom: 2,
  },
  hfValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
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
    top: '-30%',
    left: '50%',
    height: 12,
    width: 3,
    backgroundColor: ctx.colors2024['red-default'],
  },
  liquidationValue: {
    fontSize: 12,
    fontWeight: '600',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  liquidationText: {
    fontSize: 12,
    fontWeight: '800',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
}));
