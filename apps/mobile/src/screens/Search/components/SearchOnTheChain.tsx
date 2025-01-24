import { View, Text, Pressable } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { RcNextSearchCC } from '@/assets/icons/common';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { trigger } from 'react-native-haptic-feedback';
import { ExternalTokenRow } from '@/screens/Home/components/AssetRenderItems';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { RootNames } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { openapi } from '@/core/request';
import { ItemLoader } from './Skeleton';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';

type Props = {
  filterText?: string;
};

const SearchOnTheChain = ({ filterText }: Props) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [resultTokens, setResultTokens] = useState<AbstractPortfolioToken[]>(
    [],
  );
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchedRef = useRef<string>('');
  const { t } = useTranslation();
  const handleSearch = async (text?: string) => {
    if (!text) {
      return;
    }
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    searchedRef.current = text;
    setLoading(true);
    try {
      const res = await openapi.searchTokens({
        q: text,
      });
      setResultTokens(
        res.map(
          token =>
            ({
              ...token,
              _isPined: false,
              _isFold: false,
              _isExcludeBalance: false,
              _usdValueStr: 0,
              _amountStr: 1,
              _tokenId: token.id,
            } as unknown as AbstractPortfolioToken),
        ),
      );
      setSearched(true);
    } catch (error) {
      console.log('get web chain error)', filterText, error);
    } finally {
      setLoading(false);
    }
  };
  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      navigate(RootNames.TokenDetail, {
        token: ensureAbstractPortfolioToken(token),
        unHold: true,
      });
    },
    [],
  );
  useEffect(() => {
    if (filterText !== searchedRef.current) {
      setSearched(false);
      setResultTokens([]);
    }
  }, [filterText]);

  if (!filterText) {
    return null;
  }

  if (loading) {
    return (
      <View>
        <Text style={styles.title}>{t('page.search.searchWeb.title')}</Text>
        <ItemLoader />
        <ItemLoader />
      </View>
    );
  }
  return (
    <View>
      {searched ? (
        resultTokens.length === 0 ? (
          <Text style={styles.title}>
            {t('page.search.searchWeb.noResult')}{' '}
            <Text style={styles.boldTitle}>”{filterText}”</Text>
          </Text>
        ) : (
          <Text style={styles.title}>{t('page.search.searchWeb.title')}</Text>
        )
      ) : (
        <Pressable
          style={styles.wrapper}
          onPress={() => handleSearch(filterText)}>
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
      <View>
        {resultTokens?.map(item => (
          <ExternalTokenRow
            data={item}
            key={`${item.id}-${item.chain}`}
            filterText={filterText}
            onTokenPress={handleOpenTokenDetail}
            logoSize={40}
          />
        ))}
      </View>
    </View>
  );
};

export default SearchOnTheChain;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
  boldTitle: {
    fontWeight: '700',
  },
}));
