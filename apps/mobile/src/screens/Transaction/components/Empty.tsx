import RcIconEmpty from '@/assets2024/icons/history/ImgEmpty.svg';
import RcIconEmptyDark from '@/assets2024/icons/history/ImgEmptyDark.svg';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ViewProps } from 'react-native';

export const Empty = ({
  style,
  isShowDesc = true,
}: {
  style?: ViewProps['style'];
  isShowDesc?: boolean;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.empty}>
        {isLight ? (
          <RcIconEmpty style={styles.image} />
        ) : (
          <RcIconEmptyDark style={styles.image} />
        )}
        <Text style={styles.title}>
          {t('page.activities.signedTx.empty.title')}
        </Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) => ({
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
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  desc: {
    color: colors['neutral-body'],
    fontSize: 14,
    lineHeight: 17,
  },
  image: {
    marginTop: 200,
    marginBottom: 16,
  },
}));
