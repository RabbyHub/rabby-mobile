import { RcIconClose1CC, RcIconMore1CC } from '@/assets2024/icons/browser';
import { IS_ANDROID } from '@/core/native/utils';
import {
  useBrowser,
  useBrowserActiveTabState,
} from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { EVENT_BROWSER_ACTION, eventBus } from '@/utils/events';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { DropdownMenuView } from '../BrowserScreen/components/BrowserTab/DropdownMenuView';
import { useTranslation } from 'react-i18next';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import RcIconFavoriteCC from '@/assets2024/icons/browser/favorite-cc.svg';

export const BrowserHandler = () => {
  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
  const {
    browserState,
    setPartialBrowserState,
    closeTab,
    onHideBrowser,
    activeTabId,
  } = useBrowser();
  const handleCloseBrowser = useMemoizedFn(() => {
    closeTab(activeTabId);
    setPartialBrowserState({
      isShowBrowser: false,
      isShowSearch: false,
      searchText: '',
      searchTabId: '',
      trigger: '',
    });
    // onHideBrowser();
    matomoRequestEvent({
      category: 'Websites Usage',
      action: `Website_Exit`,
      label: 'Click X',
    });
  });

  const [activeTabState] = useBrowserActiveTabState();

  const handleAction = useMemoizedFn(
    (
      type:
        | 'refresh'
        | 'disconnect'
        | 'favorite'
        | 'contentMode'
        | 'clearCache',
    ) => {
      eventBus.emit(EVENT_BROWSER_ACTION, {
        type,
      });
    },
  );

  const menuConfigs = React.useMemo(() => {
    const urlInfo = urlUtils.canoicalizeDappUrl(activeTabState.url || '');

    const menuActions = [
      {
        title: t('page.browser.menu.refresh'),
        iosIconSource: isLight
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_refresh.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_refresh_dark.png'),
        androidIcon: { color: colors2024['neutral-body'] },
        androidIconName: isLight
          ? 'ic_rabby_menu_refresh'
          : 'ic_rabby_menu_refresh_dark',
        key: 'refresh',
        onSelect: () => {
          handleAction('refresh');
        },
      },
      activeTabState.isDapp && {
        title: t('page.browser.menu.favorite'),
        iosIconSource: activeTabState.isBookmark
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite_filled.png')
          : isLight
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite_dark.png'),
        androidIcon: { color: colors2024['neutral-body'] },
        androidIconName: activeTabState.isBookmark
          ? 'ic_rabby_menu_favorite_filled'
          : isLight
          ? 'ic_rabby_menu_favorite'
          : 'ic_rabby_menu_favorite_dark',
        key: 'favorite',
        onSelect: () => {
          handleAction('favorite');
        },
      },
      {
        title:
          activeTabState.contentMode === 'desktop'
            ? t('page.browser.menu.contentModeMobile')
            : t('page.browser.menu.contentModeDesktop'),
        iosIconSource: isLight
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_content_mode.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_content_mode_dark.png'),

        androidIcon: { color: colors2024['neutral-body'] },
        androidIconName: isLight
          ? 'ic_rabby_menu_content_mode'
          : 'ic_rabby_menu_content_mode_dark',
        key: 'contentMode',
        onSelect: () => {
          handleAction('contentMode');
        },
      },
      {
        title: t('page.browser.menu.clearCache'),
        iosIconSource: isLight
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear_cache.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear_cache_dark.png'),

        androidIcon: { color: colors2024['neutral-body'] },
        androidIconName: isLight
          ? 'ic_rabby_menu_clear_cache'
          : 'ic_rabby_menu_clear_cache_dark',
        key: 'clearCache',
        onSelect: () => {
          handleAction('clearCache');
        },
      },

      activeTabState.isConnected && {
        title: t('page.browser.menu.disconnect'),
        textColor: colors2024['red-dark'],
        iosIconSource: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_disconnect.png'),
        androidIcon: { color: colors2024['neutral-body'] },
        androidIconName: 'ic_rabby_menu_disconnect',
        key: 'disconnect',
        onSelect: () => {
          handleAction('disconnect');
        },
      },
    ].filter(Boolean);

    if (IS_ANDROID) {
      return {
        menuActions: [
          // patch for Android
          {
            title: urlInfo.hostname,
            key: 'hostname',
            disabled: true,
            onSelect: () => void 0,
          },
          ...menuActions,
        ],
      } as React.ComponentProps<typeof DropdownMenuView>['menuConfig'];
    }

    return {
      iosMenuTitle: urlInfo.hostname,
      menuActions: menuActions,
    } as React.ComponentProps<typeof DropdownMenuView>['menuConfig'];
  }, [
    activeTabState.contentMode,
    activeTabState.isBookmark,
    activeTabState.isConnected,
    activeTabState.isDapp,
    activeTabState.url,
    colors2024,
    handleAction,
    isLight,
    t,
  ]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        // setPartialBrowserState({
        //   isShowBrowser: false,
        // });
      }}>
      {browserState.isShowBrowser &&
      !browserState.isShowSearch &&
      !browserState.isShowManage ? (
        <View style={styles.handleComponent}>
          <View style={styles.handleComponentContainer}>
            {activeTabState.isDapp ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    handleAction('favorite');
                  }}
                  hitSlop={5}>
                  <View style={{ paddingLeft: 12 }}>
                    <RcIconFavoriteCC
                      color={
                        activeTabState.isBookmark
                          ? colors2024['orange-default']
                          : colors2024['neutral-line']
                      }
                      width={24}
                      height={24}
                    />
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            ) : null}

            {activeTabState.url ? (
              <DropdownMenuView menuConfig={menuConfigs}>
                <View style={styles.handleItem}>
                  <RcIconMore1CC
                    width={24}
                    height={24}
                    color={colors2024['neutral-title-1']}
                  />
                </View>
              </DropdownMenuView>
            ) : (
              <View style={styles.handleItem}>
                <RcIconMore1CC
                  width={24}
                  height={24}
                  color={colors2024['neutral-title-1']}
                />
              </View>
            )}
            <View style={styles.divider} />

            <TouchableOpacity onPress={handleCloseBrowser} hitSlop={5}>
              <View style={styles.handleItemLast}>
                <RcIconClose1CC
                  width={24}
                  height={24}
                  color={colors2024['neutral-title-1']}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.placeholder} />
      )}
    </TouchableWithoutFeedback>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    handleComponent: {
      display: 'flex',
      flexDirection: 'row',
      paddingBottom: 7,
      justifyContent: 'flex-end',
      paddingRight: 10,
      height: 40,
    },
    handleComponentContainer: {
      display: 'flex',
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-5'],
      alignItems: 'center',
      flexDirection: 'row',
      borderRadius: 19,
      gap: 8,

      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isLight ? colors2024['neutral-InvertHighlight'] : '#000',
    },
    handleItem: {
      paddingVertical: 4,
      paddingLeft: 12,
    },
    handleItemLast: {
      paddingVertical: 4,
      paddingRight: 12,
    },
    divider: {
      // width: StyleSheet.hairlineWidth,
      width: 1,
      height: 20,
      backgroundColor: colors2024['neutral-line'],
    },
    placeholder: {
      height: 40,
    },
  };
});
