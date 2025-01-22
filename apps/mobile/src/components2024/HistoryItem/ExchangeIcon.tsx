import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';
import ArrowSwapSVG from '@/assets2024/icons/common/arrow-swap-cc.svg';

interface Props {
  leftIcon: React.ReactNode;
  rightIcon: React.ReactNode;
}

export const ExchangeIcon: React.FC<Props> = ({ leftIcon, rightIcon }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.container}>
      <View style={styles.leftIcon}>{leftIcon}</View>
      <View style={styles.rightIcon}>{rightIcon}</View>
      <ArrowSwapSVG
        style={styles.arrow}
        color={colors2024['neutral-secondary']}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    width: 46,
    height: 46,
  },
  leftIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 30,
  },
  rightIcon: {
    borderWidth: 2,
    borderColor: colors2024['neutral-bg-1'],
    position: 'absolute',
    right: -2,
    bottom: -3,
    borderRadius: 40,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  arrow: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
}));
