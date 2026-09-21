import React, { memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

type CustomTestnetAssetDividerProps = {
  style?: StyleProp<ViewStyle>;
};

export const CustomTestnetAssetDivider = memo(
  ({ style }: CustomTestnetAssetDividerProps) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();

    return (
      <View style={[styles.container, style]}>
        <View style={styles.line} />
        <Text style={styles.text}>
          {t('page.multiAddressAssets.customNetworkTokenHeader')}
        </Text>
        <View style={styles.line} />
      </View>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    container: {
      height: 16,
      marginTop: 12,
      marginBottom: 17,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16.5,
      gap: 12,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: colors2024['neutral-line'],
    },
    text: {
      color: '#9A9CA9',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400',
    },
  }),
);
