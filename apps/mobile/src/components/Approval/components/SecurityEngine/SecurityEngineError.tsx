import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';

export function SecurityEngineError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors2024 } = useTheme2024();
  return (
    <View style={styles.container}>
      <Text style={{ color: colors2024['neutral-body'] }}>
        {t('global.failed')}
      </Text>
      <Text
        accessibilityRole="button"
        onPress={onRetry}
        style={{ color: colors2024['brand-default'] }}>
        {t('global.refresh')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, alignItems: 'center' },
});
