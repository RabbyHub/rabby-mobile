import RcIconRight from '@/assets/icons/dapp/icon-right.svg';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleProp,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { BrowserBookmarkEmpty } from './BrowserBookmarkEmpty';
import { BrowserBookmarkItem } from './BrowserBookmarkItem';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTranslation } from 'react-i18next';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useMemoizedFn } from 'ahooks';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { BrowserHistorySiteItem } from '../BrowserManage/BrowserHistoryList/BrowserHistorySiteList';

export const BrowserBookmarkSection = ({
  onPress,
  style,
}: {
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const [isFold, setIsFold] = useState(true);
  const { openTab } = useBrowser();
  const { browserHistoryList: allBrowserHistoryList, removeBrowserHistory } =
    useBrowserHistory();
  const browserHistoryList = useMemo(() => {
    return allBrowserHistoryList.slice(0, 30);
  }, [allBrowserHistoryList]);

  const {
    bookmarkList: data,
    removeBookmark,
    addBookmark,
    getBookmark,
  } = useBrowserBookmark();

  const { list } = useMemo(() => {
    return {
      list: isFold ? (data || []).slice(0, 8) : data || [],
    };
  }, [data, isFold]);

  const handlePressHistory = useMemoizedFn((dappInfo: DappInfo) => {
    openTab(dappInfo.url || dappInfo.origin);
  });

  const handleFavoritePress = useMemoizedFn((dappInfo: DappInfo) => {
    const key = dappInfo.url || dappInfo.origin;
    if (getBookmark(key)) {
      removeBookmark(key);
    } else {
      addBookmark({
        url: key,
        name: dappInfo.name,
        icon: dappInfo.icon,
        createdAt: Date.now(),
      });
    }
  });

  const handleDelete = useMemoizedFn((dappInfo: DappInfo) => {
    removeBrowserHistory(dappInfo.url || dappInfo.origin);
  });

  const { t } = useTranslation();

  const { width } = useWindowDimensions();
  const gapStyle = useMemo(() => {
    return {
      columnGap: Math.floor((width - 48 - 56 * 4) / 3),
    };
  }, [width]);

  return (
    <ScrollView
      style={[styles.container, style]}
      keyboardShouldPersistTaps="handled"
      onStartShouldSetResponder={() => {
        Keyboard.dismiss();
        return false;
      }}>
      {list.length <= 0 && browserHistoryList?.length <= 0 ? (
        <BrowserBookmarkEmpty />
      ) : null}

      {list?.length ? (
        <>
          <View style={styles.header}>
            <View style={styles.titleWarper}>
              <Text style={styles.title}>
                {t('page.browser.BrowserBookmarkSection.title')}
              </Text>
            </View>
            {data?.length && data.length > 8 ? (
              <View
                onStartShouldSetResponder={event => true}
                onTouchEnd={e => {
                  e.stopPropagation();
                }}>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    setIsFold(prev => !prev);
                  }}>
                  {isFold ? (
                    <View style={styles.headerExtra}>
                      <Text style={styles.headerExtraText}>
                        {t('page.browser.BrowserBookmarkSection.showAll')}
                      </Text>
                      <RcIconRight style={styles.arrowDown} />
                    </View>
                  ) : (
                    <View style={styles.headerExtra}>
                      <Text style={styles.headerExtraText}>
                        {t('page.browser.BrowserBookmarkSection.fold')}
                      </Text>
                      <RcIconRight style={styles.arrowUp} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <View style={[styles.list, gapStyle]}>
            {list.map(item => {
              return (
                <View key={item.url || item.origin} style={styles.item}>
                  <BrowserBookmarkItem data={item} onPress={onPress} />
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {browserHistoryList?.length ? (
        <View
          // eslint-disable-next-line react-native/no-inline-styles
          style={{
            marginTop: list.length ? 30 : 0,
          }}>
          <View style={styles.header}>
            <View style={styles.titleWarper}>
              <Text style={styles.title}>
                {t('page.browserManage.BrowserHistoryList.title')}
              </Text>
            </View>
          </View>
          <View style={styles.historyList}>
            {browserHistoryList.map(item => (
              <BrowserHistorySiteItem
                key={item.url}
                item={item}
                onDeletePress={handleDelete}
                onFavoritePress={handleFavoritePress}
                onPress={handlePressHistory}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginTop: 12,
    paddingHorizontal: 0,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  titleWarper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 'auto',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  headerExtra: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerExtraText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  list: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    paddingHorizontal: 24,
  },
  item: {
    // width: '25%',
    width: 56,
  },
  arrowDown: {
    transform: [
      {
        rotate: '90deg',
      },
    ],
  },
  arrowUp: {
    transform: [
      {
        rotate: '-90deg',
      },
    ],
  },
  historyListWrapper: {
    // marginTop: 30,
  },
  historyList: {
    paddingHorizontal: 24,
  },
}));
