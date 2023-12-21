import React from 'react';
import { Image, ImageProps, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';

export default function ChainIconImage({
  chainOrigin,
  size = 20,
  ...props
}: React.PropsWithoutRef<
  ImageProps & {
    size?: number;
    chainOrigin?: string;
  }
>) {
  return (
    <Image
      width={size}
      height={size}
      {...props}
      style={[{ height: size, width: size }, props.style]}
    />
  );
}
