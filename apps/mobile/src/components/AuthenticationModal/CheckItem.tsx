import { StyleProp, StyleSheet, Text, ViewStyle, View } from 'react-native';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { Radio } from '../Radio';
import { TouchableOpacity } from '@gorhom/bottom-sheet';

interface Props {
  checked: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const CheckItem: React.FC<Props> = ({
  checked,
  label,
  style,
  onPress,
}) => {
  const { styles } = useThemeStyles(getStyle);

  return (
    <TouchableOpacity
      style={StyleSheet.flatten([
        styles.main,
        checked ? styles.mainChecked : {},
        style,
      ])}
      onPress={onPress}>
      <View>
        <Radio
          containerStyle={styles.radio}
          iconStyle={styles.iconStyle}
          checked={checked}
        />
      </View>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles(colors => {
  return {
    main: {
      gap: 8,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors['neutral-card2'],
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors['neutral-card2'],
    },
    mainChecked: {
      borderColor: colors['blue-default'],
    },
    iconStyle: { width: 20, height: 20 },
    text: {
      color: colors['neutral-title1'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      flex: 1,
    },
    radio: {
      padding: 0,
      margin: 0,
      marginLeft: 0,
      marginRight: 0,
      justifyContent: 'center',
    },
  };
});
