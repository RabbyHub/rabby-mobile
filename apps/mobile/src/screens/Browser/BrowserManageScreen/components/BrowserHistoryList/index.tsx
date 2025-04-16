import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useBrowserHistory } from '@/hooks/useBrowserHistory';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/useBrowserBookmark';
import { BrowserHistoryEmpty } from './BrowserHistoryEmpty';
import { BrowserHistorySiteList } from './BrowserHistorySiteList';

export const BrowserHistoryList = ({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { browserHistoryList, removeBrowserHistory } = useBrowserHistory();
  const { openUrlAsDapp } = useBrowser();
  const { removeBookmark, addBookmark, getBookmark } = useBrowserBookmark();

  const handlePress = useMemoizedFn((dappInfo: DappInfo) => {
    openUrlAsDapp(dappInfo.url || dappInfo.origin);
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

  return (
    <View style={[styles.container, style]}>
      <BrowserHistorySiteList
        data={browserHistoryList}
        onPress={handlePress}
        onFavoritePress={handleFavoritePress}
        onDeletePress={handleDelete}
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
