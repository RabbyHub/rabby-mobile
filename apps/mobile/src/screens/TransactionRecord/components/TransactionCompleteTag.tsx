import { AppColorsVariants } from '@/constant/theme';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Spin } from './Spin';
import { useMemo } from 'react';
import { sortBy } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import RcIconCompleteCC from '@/assets/icons/transaction-record/icon-complete-cc.svg';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Tip } from '@/components';

export const TransactionCompleteTag = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={styles.tag}>
      <RcIconCompleteCC color={colors['neutral-foot']} />
      <Text style={styles.tagText}>Completed</Text>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tag: {
      backgroundColor: colors['neutral-card2'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 4,
    },
    tagText: {
      color: colors['neutral-foot'],
      fontSize: 12,
      lineHeight: 14,
    },
  });
