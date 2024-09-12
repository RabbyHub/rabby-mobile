import React, { useMemo } from 'react';
import { default as RcIconBg } from '@/assets/icons/gas-account/bg.svg';
import { View, ViewProps } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';

export const GasAccountWrapperBg = ({
  children,
  style,
  ...others
}: ViewProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  return (
    <View {...others} style={[styles.container, style]}>
      <View style={styles.bgWrapper}>
        <RcIconBg width={'100%'} />
      </View>
      {children}
    </View>
  );
};

const getStyle = createGetStyles(colors => ({
  container: {
    position: 'relative',
  },
  bgWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -10,
    bottom: 0,
    alignItems: 'center',
    zIndex: -1,
  },
}));
