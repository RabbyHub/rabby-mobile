import RcIconEmpty from '@/assets/icons/customTestnet/empty-cc.svg';
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
        <RcIconEmpty style={styles.image} color={colors['neutral-body']} />
        <Text style={styles.desc}>No Custom Network</Text>
      </View>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    desc: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 17,
    },
    image: {
      marginBottom: 12,
    },
  });
