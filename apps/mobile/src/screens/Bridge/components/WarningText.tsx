import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { ReactNode } from 'react';
import { Text, TextProps, View, ViewProps } from 'react-native';

export const WarningText = ({
  bgColor,
  style,
  textStyle,
  triangleStyle,
  children,
}: React.PropsWithChildren<{
  bgColor?: string;
  text?: ReactNode;
  style?: ViewProps['style'];
  triangleStyle?: ViewProps['style'];
  textStyle?: TextProps['style'];
}>) => {
  const { styles } = useTheme2024({
    getStyle,
  });
  return (
    <View
      style={[
        styles.container,
        style,
        bgColor && {
          backgroundColor: bgColor,
        },
      ]}>
      <View
        style={[
          styles.tipTriangle,
          triangleStyle,
          bgColor && {
            borderBottomColor: bgColor,
          },
        ]}
      />
      <View>
        <Text style={[styles.text, textStyle]}>{children}</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 8,
    position: 'relative',
    marginTop: 10,
    minHeight: 36,
    backgroundColor: colors2024['orange-light-1'],
  },
  tipTriangle: {
    position: 'absolute',
    top: -20,
    left: 10,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    alignItems: 'center',
    borderBottomColor: colors2024['orange-light-1'],
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['orange-default'],
  },
}));
