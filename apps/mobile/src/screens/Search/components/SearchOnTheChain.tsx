import { View, Text, Pressable, TextStyle, StyleProp } from 'react-native';
import React from 'react';
import { RcNextSearchCC } from '@/assets/icons/common';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { ItemLoader } from './Skeleton';

type Props = {
  filterText?: string;
  loading: boolean;
  searched: boolean;
  hasTokens: boolean;
  handleSearch: () => void;
  titleStyle: StyleProp<TextStyle>;
};

const SearchOnTheChain = ({
  filterText,
  loading,
  searched,
  hasTokens,
  handleSearch,
  titleStyle,
}: Props) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  if (!filterText) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.title}>{t('page.search.searchWeb.title')}</Text>
        <ItemLoader />
        <ItemLoader />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      {searched ? (
        hasTokens ? (
          <Text style={titleStyle}>{t('page.search.searchWeb.title')}</Text>
        ) : (
          <Text style={styles.title}>
            {t('page.search.searchWeb.noResult')}{' '}
            <Text style={styles.boldTitle}>”{filterText}”</Text>
          </Text>
        )
      ) : (
        <Pressable style={styles.wrapper} onPress={handleSearch}>
          <RcNextSearchCC
            width={16}
            height={16}
            color={colors2024['brand-default']}
          />
          <Text style={styles.searchTitle}>
            {t('page.search.searchWeb.searchTips')}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

export default SearchOnTheChain;

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  loadingContainer: {
    gap: 8,
    display: 'flex',
  },
  container: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    flexDirection: 'row',
    paddingBottom: 64,
    paddingTop: 100,
  },
  searchTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['brand-default'],
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 12,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  tokenList: {
    gap: 8,
  },
  boldTitle: {
    fontWeight: '700',
  },
}));
