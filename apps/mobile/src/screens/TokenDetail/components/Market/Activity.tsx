import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';
import InfoContainer from './InfoContainer';
import EmptyData from './EmptyData';

const Summary = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  return (
    <InfoContainer title={t('page.tokenDetail.marketInfo.summary')}>
      <EmptyData />
    </InfoContainer>
  );
};

const Details = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <InfoContainer title={t('page.tokenDetail.marketInfo.details')}>
      <EmptyData />
    </InfoContainer>
  );
};

const Activity = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      <Summary />
      <Details />
    </View>
  );
};

export default Activity;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    gap: 12,
  },
  summary: {
    color: colors2024['red-default'],
  },
  details: {
    color: colors2024['red-default'],
  },
}));
