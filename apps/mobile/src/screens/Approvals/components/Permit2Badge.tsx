import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { Text } from 'react-native';

export default function Permit2Badge({ style }: RNViewProps) {
  const { styles } = useThemeStyles(permit2BadgeStyles);

  return (
    <Text
      style={[styles.permit2Badge, style]}
      ellipsizeMode="tail"
      numberOfLines={1}>
      Via Permit2
    </Text>
  );
}

const permit2BadgeStyles = createGetStyles(colors => {
  return {
    permit2Badge: {
      borderRadius: 2,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      paddingVertical: 1,
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },
  };
});
