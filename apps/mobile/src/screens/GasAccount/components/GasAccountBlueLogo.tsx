import { RcIconGasAccountLogo } from '@/assets2024/icons/gas-account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useMemo } from 'react';
import { ImageProps } from 'react-native';

export const GasAccountBlueLogo = (props: { style: ImageProps['style'] }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  return <RcIconGasAccountLogo style={[styles.img, props.style]} />;
};

const getStyle = createGetStyles(colors => ({
  img: {
    width: 90,
    height: 90,
  },
}));
