import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View, ViewProps } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import EmptyDataPNG from '@/assets2024/images/detail/empty-mark-info.png';
import RcIconEmptyTokenDark from '@/assets2024/singleHome/empty-token-dark.svg';
interface Props {
  style?: ViewProps['style'];
}
const EmptyData = ({ style }: Props) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={[styles.container, style]}>
      {isLight ? (
        <Image source={EmptyDataPNG} style={styles.image} />
      ) : (
        <RcIconEmptyTokenDark style={styles.image} />
      )}
      <Text style={styles.text}>{t('page.tokenDetail.marketInfo.empty')}</Text>
    </View>
  );
};

export default EmptyData;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  image: {
    width: 163,
    height: 126,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
}));
