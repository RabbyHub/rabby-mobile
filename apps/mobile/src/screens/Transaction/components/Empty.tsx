import IconEmpty from '@/assets2024/images/lending/empty.png';
import IconEmptyDark from '@/assets2024/images/lending/empty-dark.png';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View, ViewProps } from 'react-native';

export const Empty = ({
  style,
  isShowDesc = true,
  title,
}: {
  style?: ViewProps['style'];
  title?: string;
  isShowDesc?: boolean;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.empty}>
        <Image
          source={isLight ? IconEmpty : IconEmptyDark}
          style={styles.image}
        />
        <Text style={styles.title}>
          {title || t('page.activities.signedTx.empty.title')}
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
    width: 163,
    height: 126,
  },
}));
