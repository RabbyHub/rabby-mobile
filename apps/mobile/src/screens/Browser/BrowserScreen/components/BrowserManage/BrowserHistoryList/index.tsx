import { DappInfo } from '@/core/services/dappService';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, View, ViewStyle } from 'react-native';
import { BrowserHistoryEmpty } from './BrowserHistoryEmpty';
import { BrowserHistorySiteList } from './BrowserHistorySiteList';
import { matomoRequestEvent } from '@/utils/analytics';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

export const BrowserHistoryList = ({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const {
    browserHistorySectionList,
    removeBrowserHistory,
    removeAllBrowserHistory,
  } = useBrowserHistory();
  const { openTab, setPartialBrowserState } = useBrowser();
  const { removeBookmark, addBookmark, getBookmark } = useBrowserBookmark();

  const handlePress = useMemoizedFn((dappInfo: DappInfo) => {
    openTab(dappInfo.url || dappInfo.origin);
    if (dappInfo.origin) {
      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Visit_Website Recent',
        label: dappInfo.origin,
      });
    }
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

  return (
    <View style={[styles.container, style]}>
      <BrowserHistorySiteList
        data={browserHistorySectionList}
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
    position: 'relative',
    height: '100%',
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
  bottomArea: {
    paddingVertical: 6,
    paddingHorizontal: 35,
    paddingBottom: 30,
    borderTopWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  bottomText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    lineHeight: 24,
  },
}));
