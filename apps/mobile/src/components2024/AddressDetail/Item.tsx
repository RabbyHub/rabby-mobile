import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import ArrowSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from '@/components/Typography';

interface Props {
  onPress?: () => void;
  label?: string;
  value?: React.ReactNode;
  showArrow?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Cap the label at N lines with a tail ellipsis (long locales). */
  labelNumberOfLines?: number;
  /** Let the value side take the remaining width instead of hugging content. */
  valueGrow?: boolean;
}

export const Item: React.FC<Props> = ({
  onPress,
  children,
  label,
  value,
  showArrow,
  style,
  labelStyle,
  labelNumberOfLines,
  valueGrow,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const Component = (
    onPress ? TouchableOpacity : View
  ) as typeof React.Component;

  return (
    <Component
      hitSlop={10}
      style={StyleSheet.flatten([styles.itemView, style])}
      onPress={onPress}>
      {children || (
        <>
          <Text
            numberOfLines={labelNumberOfLines}
            style={StyleSheet.flatten([styles.labelText, labelStyle])}>
            {label}
          </Text>
          <View
            style={[styles.valueView, valueGrow ? styles.valueViewGrow : null]}>
            {value && typeof value === 'string' ? (
              <Text
                style={styles.valueText}
                numberOfLines={2}
                ellipsizeMode="tail">
                {value}
              </Text>
            ) : (
              value
            )}
            {showArrow && (
              <ArrowSVG
                // The arrow is layout, not content: keep it full-size and let
                // the label/value side absorb the width instead.
                style={styles.arrow}
                color={colors2024['neutral-foot']}
                width={16}
                height={16}
              />
            )}
          </View>
        </>
      )}
    </Component>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  itemView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  valueView: {
    display: 'flex',
    flexDirection: 'row',
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  valueViewGrow: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  labelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
    flexShrink: 1,
    minWidth: 0,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
    flexShrink: 1,
    textAlign: 'right',
  },
  arrow: {
    flexShrink: 0,
  },
}));
