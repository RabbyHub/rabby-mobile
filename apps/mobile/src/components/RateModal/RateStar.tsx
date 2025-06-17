import { TouchableOpacity } from 'react-native';

import StarCC from './icons/star-cc.svg';
import { coerceInteger } from '@/utils/number';
import React, { useMemo } from 'react';
import { useTheme2024 } from '@/hooks/theme';

const STAR_SIZE = 34;

export default function PressableStar({
  isFilled,
  disabled = false,
  onPress,
  style,
  size: propSize = STAR_SIZE,
}: {
  size?: number;
  isFilled?: boolean;
} & RNViewProps &
  Pick<React.ComponentProps<typeof TouchableOpacity>, 'disabled' | 'onPress'>) {
  const size = coerceInteger(propSize, STAR_SIZE);
  const { isLight } = useTheme2024();

  const color = useMemo(() => {
    if (!isLight) {
      return isFilled ? 'rgba(255, 205, 54, 1)' : 'rgba(255, 255, 255, 0.16)';
    }
    return isFilled ? 'rgba(255, 205, 54, 1)' : 'rgba(0, 0, 0, 0.16)';
  }, [isFilled, isLight]);

  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={style}>
      <StarCC width={size} height={size} color={color} />
    </TouchableOpacity>
  );
}
