import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import {
  TokenListItem,
  TokenItemSkeleton,
} from '@/screens/Watchlist/components/TokenItem';
import { useHotTokenList } from '@/screens/Watchlist/hooks/useHotTokenList';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import {
  Keyboard,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IManageToken } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { toast } from '@/components2024/Toast';
import { useFocusEffect } from '@react-navigation/native';
import { tokenItemToITokenItem } from '@/utils/token';

export const HotTokenList = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const {
    hotTokenList,
    handleFetchHotTokenList,
    loading: hotTokenListLoading,
  } = useHotTokenList(true);
  const [watchlistTokenList, setWatchlistTokenList] = useState<IManageToken[]>(
    [],
  );

  const handleOpenTokenDetail = useCallback(
    (token: TokenDetailWithPriceCurve) => {
      navigateDeprecated(RootNames.TokenDetail, {
        token: tokenItemToITokenItem(token, ''),
        unHold: false,
        needUseCacheToken: true,
      });
    },
    [],
  );
  const fetchPinedTokenList = useCallback(() => {
    preferenceService.getUserTokenSettings().then(res => {
      setWatchlistTokenList(res.pinedQueue || []);
    });
  }, []);
  useFocusEffect(fetchPinedTokenList);

  const handlePress = useCallback(
    (token: TokenDetailWithPriceCurve) => {
      if (
        watchlistTokenList.some(
          t => t.chainId === token.chain && t.tokenId === token.id,
        )
      ) {
        preferenceService.removePinedToken({
          chainId: token.chain,
          tokenId: token.id,
        });
        toast.success(t('page.watchlist.toast.remove'));
      } else {
        preferenceService.pinToken({
          chainId: token.chain,
          tokenId: token.id,
        });
      }
      fetchPinedTokenList();
    },
    [fetchPinedTokenList, t, watchlistTokenList],
  );

  return (
    <>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('page.search.hotTokenList.title')}</Text>
      </View>
      <ScrollView
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        onScrollBeginDrag={() => {
          Keyboard.dismiss();
        }}
        refreshControl={
          <RefreshControl
            refreshing={hotTokenListLoading && hotTokenList.length !== 0}
            onRefresh={() => handleFetchHotTokenList(true)}
          />
        }
        style={styles.scrollView}>
        {hotTokenListLoading &&
          hotTokenList.length === 0 &&
          Array.from({ length: 8 }).map((_, idx) => (
            <TokenItemSkeleton key={idx} />
          ))}
        {hotTokenList.map(item => (
          <TokenListItem
            key={item.id}
            item={item}
            onPress={() => handleOpenTokenDetail(item)}
            rightSlot={
              <TouchableOpacity
                onPress={() => handlePress(item)}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                <RcIconFavorite
                  width={22}
                  height={21}
                  color={
                    watchlistTokenList.some(
                      t => t.chainId === item.chain && t.tokenId === item.id,
                    )
                      ? colors2024['orange-default']
                      : colors2024['neutral-line']
                  }
                />
              </TouchableOpacity>
            }
          />
        ))}
        <View style={styles.footer} />
      </ScrollView>
    </>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  scrollView: {
    paddingHorizontal: 12,
    flex: 1,
  },
  titleContainer: {
    paddingBottom: 16,
    paddingLeft: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  skeletonBlock: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
    marginTop: 8,
  },
  footer: {
    height: 120,
  },
}));
