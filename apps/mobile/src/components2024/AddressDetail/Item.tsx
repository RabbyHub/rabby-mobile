import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import ArrowSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { createGetStyles2024 } from '@/utils/styles';

interface Props {
  onPress?: () => void;
  label?: string;
  value?: React.ReactNode;
  showArrow?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const Item: React.FC<Props> = ({
  onPress,
  children,
  label,
  value,
  showArrow,
  style,
  labelStyle,
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
          <Text style={StyleSheet.flatten([styles.labelText, labelStyle])}>
            {label}
          </Text>
          <View style={styles.valueView}>
            {value && typeof value === 'string' ? (
              <Text style={styles.valueText}>{value}</Text>
            ) : (
              value
            )}
            {showArrow && (
              <ArrowSVG
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
    width: '100%',
  },
  valueView: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
}));
