import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { BrowserHistoryEmpty } from './BrowserHistoryEmpty';
import { BrowserHistorySiteList } from './BrowserHistorySiteList';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';

export const BrowserHistoryList = ({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { browserHistoryList, removeBrowserHistory } = useBrowserHistory();
  const { openTab } = useBrowser();
  const { removeBookmark, addBookmark, getBookmark } = useBrowserBookmark();

  const handlePress = useMemoizedFn((dappInfo: DappInfo) => {
    openTab(dappInfo.url || dappInfo.origin);
  });

  const handleFavoritePress = useMemoizedFn((dappInfo: DappInfo) => {
    const key = dappInfo.url || dappInfo.origin;
    // console.log('handleFavoritePress', 'favirate', key, dappInfo);
    if (getBookmark(key)) {
      console.log('remove?');
      removeBookmark(key);
    } else {
      console.log('add?');
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

  return (
    <View style={[styles.container, style]}>
      <BrowserHistorySiteList
        data={browserHistoryList}
        onPress={handlePress}
        onFavoritePress={handleFavoritePress}
        onDeletePress={handleDelete}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>History</Text>
          </View>
        }
        ListEmptyComponent={BrowserHistoryEmpty}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    // paddingHorizontal: 24,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  titleWarper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    marginRight: 'auto',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  subTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
