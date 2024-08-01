import RcIconEmpty from '@/assets/icons/history/empty.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export const Empty = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.empty}>
        <RcIconEmpty style={styles.image} />
        <Text style={styles.title}>
          {t('page.activities.signedTx.empty.title')}
        </Text>
        <Text style={styles.desc}>
          {t('page.activities.signedTx.empty.desc')}
        </Text>
      </View>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      height: '80%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      color: colors['neutral-title1'],
      fontSize: 17,
      lineHeight: 20,
      fontWeight: '500',
      marginBottom: 8,
    },
    desc: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 17,
    },
    image: {
      marginBottom: 16,
    },
  });
