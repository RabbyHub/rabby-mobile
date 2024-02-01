import RcIconCancelCC from '@/assets/icons/transaction-record/icon-cancel-cc.svg';
import RcIconSpeedUpCC from '@/assets/icons/transaction-record/icon-speed-up-cc.svg';
import { Tip } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const TransactionAction = ({
  canCancel,
  onTxCancel,
  onTxSpeedUp,
}: {
  canCancel?: boolean;
  onTxCancel?: () => void;
  onTxSpeedUp?: () => void;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { t } = useTranslation();

  const action = (
    <View style={[styles.action, !canCancel && styles.disabled]}>
      <TouchableOpacity onPress={onTxSpeedUp} disabled={!canCancel}>
        <RcIconSpeedUpCC color={colors['neutral-title-1']} />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity onPress={onTxCancel} disabled={!canCancel}>
        <RcIconCancelCC color={colors['neutral-title-1']} />
      </TouchableOpacity>
    </View>
  );

  if (canCancel) {
    return action;
  }
  return (
    <Tip content={t('page.activities.signedTx.tips.canNotCancel')}>
      {action}
    </Tip>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    action: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    disabled: {
      opacity: 0.5,
    },
    divider: {
      height: 12,
      width: 0.5,
      marginHorizontal: 4,
      backgroundColor: colors['neutral-line'],
    },
  });
