import RcIconHistory from '@/assets/icons/dapp/icon-history.svg';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { DappHistoryCardList } from './DappHistoryCardList';
import { DappHistorySectionEmpty } from './DappHistorySectionEmpty';
import { useBrowserHistory } from '@/hooks/useBrowserHistory';
import { useMemoizedFn } from 'ahooks';
import { useBrowserTabs } from '../../hooks/useBrowserTabs';
import { useBrowserBookmark } from '@/hooks/useBrowserBookmark';

export const BrowserHistoryList = ({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { browserHistoryList, removeBrowserHistory } = useBrowserHistory();
  const { openUrlAsDapp } = useBrowserTabs();
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
      <DappHistoryCardList
        data={browserHistoryList}
        onPress={handlePress}
        onFavoritePress={handleFavoritePress}
        onDeletePress={handleDelete}
        ListEmptyComponent={DappHistorySectionEmpty}
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
