import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native';
import { usePointsBadge } from '../hooks';
import { formatTokenAmount } from '@/utils/number';

export const PointsBadge: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const badge = usePointsBadge();

  if (!badge) {
    return null;
  }

  return <Text style={styles.text}>{formatTokenAmount(badge)}</Text>;
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
