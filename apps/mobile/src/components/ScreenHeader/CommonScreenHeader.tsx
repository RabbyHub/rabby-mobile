import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

const LeftBackIcon = makeThemeIconFromCC(RcIconHeaderBack, {
  onLight: ThemeColors.light['neutral-title1'],
  onDark: ThemeColors.dark['neutral-title1'],
});

export default function CommonScreenHeader({
  style,
  title,
  children = title,
  leftIcon,
  leftIconContainerStyle,
  rigthIcon,
  rightIconStyle,
}: React.PropsWithChildren<{
  leftIcon?: React.ReactNode;
  leftIconContainerStyle?: React.ComponentProps<typeof View>['style'];
  rigthIcon?: React.ReactNode;
  rightIconStyle?: React.ComponentProps<typeof View>['style'];
  title?: string;
  style?: React.ComponentProps<typeof View>['style'];
}>) {
  const leftIconNode = React.useMemo(() => {
    if (leftIcon !== undefined) {
      return leftIcon || null;
    }

    return <LeftBackIcon />;
  }, [leftIcon]);

  const colors = useThemeColors();

  const textStyle = React.useMemo(() => {
    return {
      color: colors['neutral-title-1'],
      textAlign: 'center',
      // fontFamily: "SF Pro",
      fontSize: 20,
      fontStyle: 'normal',
      fontWeight: '500',
    } as const;
  }, [colors]);

  const childrenNode = React.useMemo(() => {
    if (typeof children === 'string') {
      return <Text style={textStyle}>{children}</Text>;
    }

    return children;
  }, [children, textStyle]);

  return (
    <View style={[style, styles.title]}>
      <View style={[leftIconContainerStyle, styles.leftIcon]}>
        {leftIconNode}
      </View>
      <View style={{ flexShrink: 1 }}>{childrenNode}</View>
      <View style={[rightIconStyle, styles.rightIcon]}>
        {rigthIcon || leftIconNode}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  leftIcon: {
    flexShrink: 0,
    width: 24,
    height: 24,
  },
  rightIcon: {
    flexShrink: 0,
    width: 24,
    height: 24,
  },
});
