import { useTheme2024 } from '@/hooks/theme';
import TokenHeader from '@/screens/Meme/components/TokenHeader';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

const noop = () => {};

export const SearchTokenHeader = () => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <TokenHeader
        volumeSort="default"
        fdvSort="default"
        changeSort="default"
        onVolumeSort={noop}
        onFdvSort={noop}
        onChangeSort={noop}
        showVolumeSort={false}
        showFdvSort={false}
        showChangeSort={false}
        leftLabel={`${t('page.search.tokenHeader.token')}/FDV`}
        style={styles.tokenHeader}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    paddingTop: 6,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  tokenHeader: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
}));
