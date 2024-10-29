import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { ReactNode } from 'react';
import {
  ViewStyle,
  StyleProp,
  StyleSheet,
  View,
  PressableProps,
  Pressable,
} from 'react-native';

interface CardProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  Component?: typeof React.Component;
}

export const Card = (props: CardProps) => {
  const {
    children,
    style,
    onPress,
    onLongPress,
    Component = onPress || onLongPress ? Pressable : View,
  } = props;

  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <Component
      style={StyleSheet.flatten([styles.container, style])}
      onPress={onPress}
      onLongPress={onLongPress}>
      {children}
    </Component>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    borderRadius: 30,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    overflow: 'hidden',
    borderColor: ctx.colors2024['neutral-line'],
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
}));
