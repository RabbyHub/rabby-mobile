import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import React, { ReactNode } from 'react';
import {
  ViewStyle,
  StyleProp,
  StyleSheet,
  View,
  TouchableOpacityProps,
  TouchableOpacity,
} from 'react-native';

interface CardProps extends TouchableOpacityProps {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  Component?: typeof React.Component;
  hasArrow?: boolean;
  arrowStyle?: StyleProp<ViewStyle>;
}

export const Card = (props: CardProps) => {
  const {
    children,
    style,
    onPress,
    onLongPress,
    Component = onPress || onLongPress ? TouchableOpacity : View,
    hasArrow = false,
    arrowStyle,
  } = props;

  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  return (
    <Component
      style={StyleSheet.flatten([styles.container, style])}
      onPress={onPress}
      onLongPress={onLongPress}>
      {children}
      {hasArrow && (
        <ArrowRightSVG
          style={StyleSheet.flatten([styles.arrow, arrowStyle])}
          width={18}
          height={18}
          color={colors2024['neutral-title-1']}
        />
      )}
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
    position: 'relative',
  },
  arrow: {
    position: 'absolute',
    right: 24,
  },
}));
