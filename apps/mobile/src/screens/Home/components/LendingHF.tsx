import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { useLendingData, useLendingSummary } from '@/screens/Lending/hooks';
import { getHealthStatusColor } from '@/screens/Lending/utils';
import { formatNum } from '@/utils/math';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native-gesture-handler';

export const LendingHF: React.FC<{}> = () => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  useLendingData(currentAccount?.address);
  const { iUserSummary } = useLendingSummary();
  return iUserSummary?.healthFactor ? (
    <Text
      style={[
        styles.text,
        {
          color: getHealthStatusColor(
            isLight,
            Number(iUserSummary.healthFactor || '0'),
          ).color,
        },
      ]}>
      {formatNum(iUserSummary.healthFactor)}
    </Text>
  ) : null;
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Display',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  green: {
    color: colors2024['green-default'],
  },
  red: {
    color: colors2024['red-default'],
  },
}));
