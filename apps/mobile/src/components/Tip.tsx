import { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { Platform, StatusBar, Pressable } from 'react-native';
import Tooltip, { TooltipProps } from 'react-native-walkthrough-tooltip';
import { colord } from 'colord';
import { useThemeColors } from '@/hooks/theme';
import { useSwitch } from '@/hooks/useSwitch';
import { AppColorsVariants } from '@/constant/theme';

type TipProps = Omit<TooltipProps, 'content'> & {
  content: string | TooltipProps['content'];
  hideArrow?: boolean;
};

export const Tip = ({
  content,
  tooltipStyle,
  contentStyle,
  hideArrow,
  arrowSize,
  ...rest
}: TipProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const { on, turnOn, turnOff } = useSwitch();

  const _content = useMemo(() => {
    return typeof content === 'string' ? (
      <View style={styles.content}>
        <Text style={styles.contentText}>{content}</Text>
      </View>
    ) : (
      content
    );
  }, [content, styles.contentText]);

  const controlled = useMemo(
    () => typeof rest.isVisible !== 'undefined',
    [rest.isVisible],
  );

  const _arrowSize = useMemo(
    () => (hideArrow ? { width: 0, height: 0 } : arrowSize),
    [arrowSize, hideArrow],
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
      contentStyle={StyleSheet.flatten([styles.tooltipContent, contentStyle])}
      tooltipStyle={StyleSheet.flatten([styles.tooltip, tooltipStyle])}
      showChildInTooltip={false}
      arrowSize={_arrowSize}
      {...rest}>
      {controlled ? (
        rest.children
      ) : (
        <Pressable hitSlop={10} onPress={turnOn}>
          {rest.children}
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
      backgroundColor: colord('white').alpha(0.96).toHslString(),
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
      fontWeight: '700',
      fontSize: 12,
      color: colors['blue-default'],
    },
  });
