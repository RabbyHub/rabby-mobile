import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';

export const BalanceChangeLoading = () => {
  const { t } = useTranslation();
  const { colors } = useTheme2024();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingVertical: 16,
          paddingHorizontal: 16,
          backgroundColor: colors['neutral-bg-2'],
          borderRadius: 8,
          marginBottom: 16,
        },
        title: {
          fontSize: 14,
          lineHeight: 16,
          fontWeight: '500',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          color: colors['neutral-title-1'],
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
      }),
    [colors],
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
    </View>
  );
};
