import { RcIconGasAccountHeaderRight } from '@/assets/icons/gas-account';
import { useTheme2024 } from '@/hooks/theme';
import { useCallback } from 'react';
import { Pressable } from 'react-native';
import {
  useAccountsWithGasAccountBalance,
  useGasAccountLoginVisible,
} from '../hooks/atom';
import { createGetStyles2024 } from '@/utils/styles';

export const GasAccountHeader: React.FC = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const [, setLoginVisible] = useGasAccountLoginVisible();

  const accountsWithGasAccountBalance = useAccountsWithGasAccountBalance();
  const showSwitch = accountsWithGasAccountBalance.length > 1;

  const handleSwitch = useCallback(() => {
    setLoginVisible(true);
  }, [setLoginVisible]);

  if (!showSwitch) {
    return null;
  }

  return (
    <Pressable style={styles.container} onPress={handleSwitch} hitSlop={10}>
      <RcIconGasAccountHeaderRight />
    </Pressable>
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
