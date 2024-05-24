import React from 'react';
import './style.ts';
import SvgIconArrowDown from '@/assets/icons/common/arrow-down-gray.svg';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { getStyles } from './style';

interface AddressViewProps {
  address: string;
  onClick?(): void;
  ellipsis?: boolean;
  showArrow?: boolean;
  className?: string;
  showImportIcon?: boolean;
  index?: number;
  showIndex?: boolean;
  style?: StyleProp<ViewStyle>;
  addressStyle?: StyleProp<TextStyle>;
}

export const AddressViewer = ({
  address,
  onClick,
  ellipsis = true,
  showArrow = true,
  className = 'normal',
  index = -1,
  showIndex = false,
  style,
  addressStyle,
}: AddressViewProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity onPress={onClick}>
      <View style={StyleSheet.flatten([styles[className], style])}>
        {showIndex && index >= 0 && (
          <Text style={styles.numberIndex}>{index}</Text>
        )}
        <Text
          style={[
            {
              lineHeight: 20,
              color: colors['neutral-foot'],
            },
            addressStyle,
          ]}>
          {ellipsis
            ? `${address?.toLowerCase().slice(0, 6)}...${address
                ?.toLowerCase()
                .slice(-4)}`
            : address?.toLowerCase()}
        </Text>
      </View>
      {showArrow && (
        <SvgIconArrowDown className="ml-1 fill-current text-white opacity-80" />
      )}
    </TouchableOpacity>
  );
};
