import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconArrowRightCC from '@/assets2024/icons/perps/IconArrowRightCC.svg';
import RcIconTipsLightCC from '@/assets2024/icons/perps/IconTipsLightCC.svg';
import { calculateDistanceToLiquidation } from './utils';

const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface DistanceToLiquidationTagProps {
  liquidationPrice: string | number | undefined;
  markPrice: string | number | undefined;
  onPress?: () => void;
}

export const DistanceToLiquidationTag: React.FC<
  DistanceToLiquidationTagProps
> = ({ liquidationPrice, markPrice, onPress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const distanceLiquidation = calculateDistanceToLiquidation(
    liquidationPrice,
    markPrice,
  );

  return (
    <TouchableOpacity
      style={[
        styles.distanceTag,
        {
          borderColor: colors2024['neutral-line'],
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      <RcIconTipsLightCC
        width={16}
        height={16}
        color={colors2024['neutral-info']}
      />
      <Text
        style={[styles.distanceText, { color: colors2024['neutral-foot'] }]}>
        {formatPct(distanceLiquidation)}
      </Text>
      <RcIconArrowRightCC
        width={8}
        height={8}
        color={colors2024['neutral-foot']}
      />
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles2024(() => ({
  distanceTag: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 100,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
}));
