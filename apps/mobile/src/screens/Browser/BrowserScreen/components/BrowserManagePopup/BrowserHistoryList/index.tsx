import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { BrowserHistoryEmpty } from './BrowserHistoryEmpty';
import { BrowserHistorySiteList } from './BrowserHistorySiteList';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTranslation } from 'react-i18next';
import { DropDownMenuView } from '@/components2024/DropDownMenu';
import { RcIconAddPlusCircle } from '@/assets2024/icons/browser';

export const BrowserHistoryList = ({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { browserHistorySectionList, removeBrowserHistory } =
    useBrowserHistory();
  const { openTab } = useBrowser();
  const { removeBookmark, addBookmark, getBookmark } = useBrowserBookmark();

  const handlePress = useMemoizedFn((dappInfo: DappInfo) => {
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

  return (
    <View style={[styles.container, style]}>
      <BrowserHistorySiteList
        data={browserHistorySectionList}
        onPress={handlePress}
        onFavoritePress={handleFavoritePress}
        onDeletePress={handleDelete}
        ListEmptyComponent={BrowserHistoryEmpty}
      />
      <View
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          ...styles.bottomArea,
          borderColor: isLight
            ? 'rgba(0, 0, 0, 0.06)'
            : 'rgba(255, 255, 255, 0.06)',
        }}>
        <DropDownMenuView
          triggerProps={{ action: 'press' }}
          menuConfig={{
            menuActions: [
              {
                title: t('page.browserManage.BrowserTabList.closeAllTabs'),
                key: 'close_all_tabs',
                icon: isLight
                  ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear.png')
                  : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear_dark.png'),
                androidIconName: isLight
                  ? 'ic_rabby_menu_clear'
                  : 'ic_rabby_menu_clear_dark',
                action: () => {
                  // closeAllTabs();
                },
              },
            ],
          }}>
          <TouchableOpacity>
            <Text style={styles.bottomText}>{t('global.Edit')}</Text>
          </TouchableOpacity>
        </DropDownMenuView>
        <TouchableOpacity onPress={() => openTab()}>
          <RcIconAddPlusCircle
            width={44}
            height={44}
            color={colors2024['neutral-foot']}
            borderColor={colors2024['neutral-line']}
            backgroundColor={colors2024['neutral-bg-1']}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            // navigation.goBack();
          }}>
          <Text style={styles.bottomText}>{t('global.Done')}</Text>
        </TouchableOpacity>
      </View>
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
  },
  bottomText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    lineHeight: 24,
  },
}));
