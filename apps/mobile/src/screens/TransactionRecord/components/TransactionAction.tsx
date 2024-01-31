import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { StyleSheet, Text, View } from 'react-native';
import { TransactionExplain } from './TransactionExplain';
import RcIconSpeedUpCC from '@/assets/icons/transaction-record/icon-speed-up-cc.svg';
import RcIconCancelCC from '@/assets/icons/transaction-record/icon-cancel-cc.svg';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const TransactionAction = () => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.action}>
      <TouchableOpacity>
        <RcIconSpeedUpCC color={colors['neutral-title-1']} />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity>
        <RcIconCancelCC color={colors['neutral-title-1']} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    action: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    divider: {
      height: 12,
      width: 0.5,
      marginHorizontal: 4,
      backgroundColor: colors['neutral-line'],
    },
  });
