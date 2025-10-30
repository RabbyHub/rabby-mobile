import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconArrowRightCC from '@/assets2024/icons/perps/IconArrowRightCC.svg';
import { PERPS_POSITION_RISK_LEVEL } from '@/constant/perps';
import { getRiskLevel } from './utils';

const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface DistanceToLiquidationTagProps {
  distanceLiquidation: number;
  onPress?: () => void;
}

export const DistanceToLiquidationTag: React.FC<
  DistanceToLiquidationTagProps
> = ({ distanceLiquidation, onPress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const riskLevel = useMemo(() => {
    return getRiskLevel(distanceLiquidation);
  }, [distanceLiquidation]);

  const riskColorMap = useMemo(() => {
    const colorMap = {
      [PERPS_POSITION_RISK_LEVEL.DANGER]: {
        borderColor: colors2024['red-light-2'],
        backgroundColor: colors2024['red-light-1'],
        dotBgColor: colors2024['red-light-2'],
        textColor: colors2024['red-default'],
      },
      [PERPS_POSITION_RISK_LEVEL.WARNING]: {
        borderColor: colors2024['orange-light-2'],
        backgroundColor: colors2024['orange-light-1'],
        dotBgColor: colors2024['orange-light-2'],
        textColor: colors2024['orange-default'],
      },
      [PERPS_POSITION_RISK_LEVEL.SAFE]: {
        borderColor: colors2024['green-disable'],
        backgroundColor: colors2024['green-light-4'],
        dotBgColor: colors2024['green-disable'],
        textColor: colors2024['green-default'],
      },
    };
    return colorMap[riskLevel];
  }, [colors2024, riskLevel]);

  return (
    <TouchableOpacity
      style={[
        styles.distanceTag,
        {
          backgroundColor: riskColorMap.backgroundColor,
          borderColor: riskColorMap.borderColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View
        style={[
          styles.distanceDotContainer,
          {
            backgroundColor: riskColorMap.dotBgColor,
          },
        ]}>
        <View
          style={[
            styles.distanceDot,
            {
              backgroundColor: riskColorMap.textColor,
            },
          ]}
        />
      </View>
      <Text style={[styles.distanceText, { color: riskColorMap.textColor }]}>
        {formatPct(distanceLiquidation)}
      </Text>
      <RcIconArrowRightCC width={8} height={8} color={riskColorMap.textColor} />
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles2024(() => ({
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.8,
  },
  distanceDotContainer: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  distanceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
}));
