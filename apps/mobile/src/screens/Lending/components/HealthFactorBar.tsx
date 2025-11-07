import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { getHealthStatusColor } from '../utils';
import LinearGradient from 'react-native-linear-gradient';
import { HF_COLOR_GOOD_THRESHOLD } from '../utils/constant';
import { useTranslation } from 'react-i18next';
import { getHealthFactorText } from './HealthFactorText';

interface HealthFactorBarProps {
  healthFactor: string;
}

export const HealthFactorBar: React.FC<HealthFactorBarProps> = ({
  healthFactor,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();
  const hfNumber = Number(healthFactor || '0');

  const dotPosition = useMemo(() => {
    if (hfNumber > 10) {
      return 90;
    } else if (hfNumber > 3) {
      return 50 + ((hfNumber - 3) / 7) * 45;
    } else if (hfNumber > 1) {
      return 10 + ((hfNumber - 1) / 2) * 40;
    } else {
      return (hfNumber / 1) * 10;
    }
  }, [hfNumber]);

  const hfColor = useMemo(() => getHealthStatusColor(hfNumber), [hfNumber]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          colors2024['red-default'],
          colors2024['orange-default'],
          colors2024['orange-default'],
          colors2024['green-default'],
        ]}
        locations={[0, 0.18, 0.2, 1]}
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
          <View>
            <Text style={[styles.hfValue, { color: hfColor.color }]}>
              {getHealthFactorText(healthFactor)}
            </Text>
            <View
              style={[
                styles.triangle,
                makeTriangleStyle({
                  dir: 'down',
                  size: 6,
                  color: hfColor.color,
                }),
              ]}
            />
          </View>
          {hfNumber < HF_COLOR_GOOD_THRESHOLD && (
            <View
              style={[
                styles.riskyTextContainer,
                {
                  backgroundColor: hfColor.backgroundColor,
                },
              ]}>
              <Text
                style={[
                  styles.riskyText,
                  {
                    color: hfColor.color,
                  },
                ]}>
                {t('page.Lending.lqDescription.risky')}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.liquidationContainer}>
        <View style={styles.liquidationMarker} />
        <Text style={styles.liquidationValue}>1.00</Text>
        <Text style={styles.liquidationText}>
          {t('page.Lending.lqDescription.desc')}
        </Text>
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
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  triangle: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: [{ translateX: -6 }],
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
    lineHeight: 20,
    fontWeight: '700',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  liquidationText: {
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '500',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  riskyTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  riskyText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: ctx.colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
}));
