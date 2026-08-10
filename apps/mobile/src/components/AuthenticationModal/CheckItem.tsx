import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { CheckBoxRect } from '@/components2024/CheckBox';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { TouchableOpacity } from '@gorhom/bottom-sheet';
import { Text } from '@/components/Typography';

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
      <CheckBoxRect checked={checked} />
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
    text: {
      color: colors['neutral-title1'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      flex: 1,
    },
  };
});
