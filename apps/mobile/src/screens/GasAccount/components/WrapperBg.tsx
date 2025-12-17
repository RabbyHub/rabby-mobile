import { default as RcIconBg } from '@/assets/icons/gas-account/bg.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, ViewProps } from 'react-native';

export const GasAccountWrapperBg = ({
  children,
  style,
  ...others
}: ViewProps) => {
  const { styles, isLight } = useTheme2024({
    getStyle,
  });
  return (
    <View {...others} style={[styles.container, style]}>
      <View style={styles.bgWrapper}>
        {/* <RcIconBg width={'100%'} style={isLight ? null : styles.opacity50} /> */}
      </View>
      {children}
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  container: {
    position: 'relative',
  },
  bgWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: -1,
  },
  opacity50: {
    opacity: 0.5,
  },
}));
