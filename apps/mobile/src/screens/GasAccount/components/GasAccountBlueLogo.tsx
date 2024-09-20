import React, { useMemo } from 'react';
import { ImageProps } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { Image } from 'react-native';

export const GasAccountBlueLogo = (props: { style: ImageProps['style'] }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  return (
    <Image
      source={require('@/assets/icons/gas-account/gas-account-logo.png')}
      style={[styles.img, props.style]}
    />
  );
};

const getStyle = createGetStyles(colors => ({
  img: {
    width: 90,
    height: 90,
  },
}));
