import { TouchableOpacity } from 'react-native';

import StarCC from './icons/star-cc.svg';
import { coerceInteger } from '@/utils/number';
import React from 'react';

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

  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={style}>
      <StarCC
        width={size}
        height={size}
        color={isFilled ? 'rgba(255, 205, 54, 1)' : 'rgba(0, 0, 0, 0.16)'}
      />
    </TouchableOpacity>
  );
}
