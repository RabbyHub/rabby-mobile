import { DappInfo } from '@/core/services/dappService';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCardList } from '@/screens/Browser/components/BrowserSiteCardList';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, View, ViewStyle } from 'react-native';
import { BrowserBookmarkEmpty } from './BrowserBookmarkEmpty';
import { matomoRequestEvent } from '@/utils/analytics';

export const BrowserBookmarkList = ({
  style,
  isShowDelete,
}: {
  style?: StyleProp<ViewStyle>;
  isShowDelete?: boolean;
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { openTab, setPartialBrowserState } = useBrowser();
  const { bookmarkList, removeBookmark, addBookmark, getBookmark } =
    useBrowserBookmark();

  const handlePress = useMemoizedFn((dappInfo: DappInfo) => {
    openTab(dappInfo.url || dappInfo.origin);
    if (dappInfo.origin) {
      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Visit_Website Favorites',
        label: dappInfo.origin,
      });
    }
  });

  const handleDeletePress = useMemoizedFn((dappInfo: DappInfo) => {
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

  const { t } = useTranslation();

  return (
    <View style={[styles.container, style]}>
      <BrowserSiteCardList
        isInBottomSheet
        data={bookmarkList}
        onPress={handlePress}
        style={styles.list}
        ListEmptyComponent={BrowserBookmarkEmpty}
        isShowDelete={isShowDelete}
        onDeletePress={handleDeletePress}
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
  list: {
    paddingHorizontal: 20,
    marginBottom: 0,
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
