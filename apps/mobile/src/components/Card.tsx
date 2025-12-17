import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React, { ReactNode } from 'react';
import {
  ViewStyle,
  StyleProp,
  StyleSheet,
  View,
  PressableProps,
  Pressable,
  Platform,
} from 'react-native';

interface CardProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  shadow?: boolean;
  Component?: typeof React.Component;
}

export const Card = (props: CardProps) => {
  const {
    children,
    style,
    shadow,
    onPress,
    onLongPress,
    Component = onPress || onLongPress ? Pressable : View,
  } = props;

  const colors = useThemeColors();
  const styles = getStyle(colors);

  return (
    <Component
      style={StyleSheet.flatten([
        styles.container,
        shadow && styles.isShadow,
        style,
      ])}
      onPress={onPress}
      onLongPress={onLongPress}>
      {children}
    </Component>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      backgroundColor: 'white',
      overflow: 'hidden',
    },
    isShadow: {
      ...Platform.select({
        android: {
          elevation: 30,
          shadowColor: colors['blue-light-1'],
        },
        ios: {
          shadowOffset: {
            width: 0,
            height: 16,
          },
          shadowRadius: 10,
          shadowOpacity: 0.2,
        },
      }),
    },
  });
