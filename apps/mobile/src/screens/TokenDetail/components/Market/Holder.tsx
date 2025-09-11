import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';
import EmptyData from './EmptyData';

const Holder = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <EmptyData />
    </View>
  );
};

export default Holder;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
}));
