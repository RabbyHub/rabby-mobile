import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';

export const BalanceChangeLoading = () => {
  const { t } = useTranslation();
  const { colors2024 } = useTheme2024();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingVertical: 16,
          paddingHorizontal: 12,
          backgroundColor: colors2024['neutral-bg-2'],
          borderRadius: 8,
          marginBottom: 16,
        },
        title: {
          color: colors2024['neutral-title-1'],
          fontFamily: 'SF Pro Rounded',
          fontSize: 14,
          fontStyle: 'normal',
          fontWeight: '700',
          lineHeight: 18,
        },
        row: {
          paddingTop: 15,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
      }),
    [colors2024],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('page.signTx.balanceChange.successTitle')}
      </Text>
      <View style={styles.row}>
        <CustomSkeleton circle width={24} height={24} />
        <CustomSkeleton width={158} height={20} style={{ borderRadius: 8 }} />
      </View>
      <View style={styles.row}>
        <CustomSkeleton circle width={24} height={24} />
        <CustomSkeleton width={158} height={20} style={{ borderRadius: 8 }} />
      </View>
    </View>
  );
};
