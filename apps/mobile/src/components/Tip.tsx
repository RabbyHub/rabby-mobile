import React, { useCallback, useMemo } from 'react';
import {
  Text,
  StyleSheet,
  View,
  PressableProps,
  GestureResponderEvent,
} from 'react-native';
import { Platform, StatusBar, Pressable } from 'react-native';
import Tooltip, { TooltipProps } from 'react-native-walkthrough-tooltip';
import { colord } from 'colord';
import { useThemeStyles } from '@/hooks/theme';
import { useSwitch } from '@/hooks/useSwitch';
import { AppColorsVariants } from '@/constant/theme';

type TipProps = Omit<TooltipProps, 'content'> & {
  content: string | TooltipProps['content'];
  hideArrow?: boolean;
  isLight?: boolean;
  pressableProps?: Omit<PressableProps, 'onPress'> & {
    onPress?: (ctx: {
      event: GestureResponderEvent;
      turnOn: () => void;
    }) => void;
  };
  noPressable?: boolean;
};

export const Tip = ({
  content,
  tooltipStyle,
  pressableProps,
  contentStyle,
  hideArrow,
  arrowSize,
  isLight,
  children,
  noPressable = false,
  ...rest
}: TipProps) => {
  const { colors, styles } = useThemeStyles(getStyle);

  const { on, turnOn, turnOff } = useSwitch();

  const _content = useMemo(() => {
    return typeof content === 'string' ? (
      <View style={styles.content}>
        <Text
          style={StyleSheet.flatten([
            styles.contentText,
            isLight && {
              color: colors['neutral-black'],
            },
          ])}>
          {content}
        </Text>
      </View>
    ) : (
      content
    );
  }, [content, isLight, colors, styles.content, styles.contentText]);

  const controlled = useMemo(
    () => typeof rest.isVisible !== 'undefined',
    [rest.isVisible],
  );

  const _arrowSize = useMemo(
    () => (hideArrow ? { width: 0, height: 0 } : arrowSize),
    [arrowSize, hideArrow],
  );

  const handleOnPress = useCallback<PressableProps['onPress'] & object>(
    evt => {
      if (typeof pressableProps?.onPress === 'function') {
        pressableProps.onPress({ event: evt, turnOn });
        return;
      }

      turnOn();
    },
    [pressableProps, turnOn],
  );

  return (
    <Tooltip
      isVisible={on}
      placement="top"
      backgroundColor={'transparent'}
      topAdjustment={
        Platform.OS === 'android' && StatusBar
          ? -(StatusBar.currentHeight || 0)
          : 0
      }
      onClose={turnOff}
      content={_content}
      showChildInTooltip={false}
      arrowSize={_arrowSize}
      {...rest}
      contentStyle={StyleSheet.flatten([
        styles.tooltipContent,
        contentStyle,
        isLight && {
          backgroundColor: colors['neutral-bg-1'],
        },
      ])}
      tooltipStyle={StyleSheet.flatten([styles.tooltip, tooltipStyle])}>
      {controlled || noPressable ? (
        children
      ) : (
        <Pressable
          hitSlop={10}
          {...pressableProps}
          style={StyleSheet.flatten([pressableProps?.style])}
          onPress={handleOnPress}>
          {children}
        </Pressable>
      )}
    </Tooltip>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tooltip: {
      shadowColor: colord('transparent').alpha(0.16).toRgbString(),
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 1,
      shadowRadius: 8,
    },
    tooltipContent: {
      backgroundColor: colors['neutral-black'],
      elevation: 10,
      borderRadius: 8,
      padding: 0,
    },
    content: {
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 8,
    },
    contentText: {
      fontSize: 12,
      color: colors['neutral-title-2'],
    },
  });
