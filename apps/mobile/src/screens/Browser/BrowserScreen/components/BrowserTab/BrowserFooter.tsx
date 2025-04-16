import React, { useCallback } from 'react';
import {
  GestureResponderEvent,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { WebViewState, useWebViewControl } from '@/components/WebView/hooks';

import {
  RcIconBackCC,
  RcIconForwardCC,
  RcIconMoreCC,
  RcIconRefreshCC,
} from '@/assets2024/icons/browser';
import { RootNames } from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { TabActions } from '@react-navigation/native';
import { DropdownMenuView } from './DropdownMenuView';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';

export const BOTTOM_NAV_CONTROL_PRESS_OPACITY = 0.3;

export type BottomNavControlCbCtx = {
  webviewState: WebViewState;
  webviewActions: ReturnType<typeof useWebViewControl>['webviewActions'];
};

type OnPressButtonCtx = {
  type: 'back' | 'forward' | 'reload' | 'favorite' | 'disconnect';
  event?: GestureResponderEvent;
};

export function BrowserFooter({
  webviewState,
  webviewActions,
  isFavorited,
  isConnected,
  onPressButton,
  canGoBack,
  canGoForward,
  tabsCount,
  url,
  onPressViewTabs,
}: BottomNavControlCbCtx & {
  isFavorited?: boolean;
  isConnected?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  url?: string;
  tabsCount?: number;
  onPressViewTabs?(): void;

  /**
   * @description customize all button press event
   */
  onPressButton?: (
    ctx: BottomNavControlCbCtx &
      OnPressButtonCtx & {
        defaultAction: (ctx: BottomNavControlCbCtx & OnPressButtonCtx) => void;
      },
  ) => void;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });
  const { bookmarkStore, addBookmark, removeBookmark } = useBrowserBookmark();
  const isBookmark = !!bookmarkStore.entities[webviewState.url];

  const navigation = useRabbyAppNavigation();

  const builtInOnPressButton = useCallback(
    (ctx: OnPressButtonCtx) => {
      switch (ctx.type) {
        case 'back':
          webviewActions.handleGoBack();
          break;
        case 'forward':
          webviewActions.handleGoForward();
          break;
        case 'reload':
          webviewActions.handleReload();
          break;
        default:
          break;
      }
    },
    [webviewActions],
  );

  const onPressButtonInternal = useCallback(
    (ctx: OnPressButtonCtx) => {
      if (typeof onPressButton === 'function') {
        onPressButton({
          ...ctx,
          webviewState,
          webviewActions,
          defaultAction: builtInOnPressButton,
        });
        return;
      }

      builtInOnPressButton(ctx);
    },
    [webviewState, webviewActions, onPressButton, builtInOnPressButton],
  );

  const menuConfigs = React.useMemo(() => {
    const urlInfo = urlUtils.canoicalizeDappUrl(webviewState.url);

    const menuActions = [
      {
        title: 'Favorite',
        iosIconSource: isBookmark
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite_filled.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite.png'),
        androidIconName: isBookmark
          ? 'ic_rabby_menu_favorite_filled'
          : 'ic_rabby_menu_favorite',
        key: 'favorite',
        onSelect: () => {
          if (isBookmark) {
            removeBookmark(webviewState.url);
          } else {
            addBookmark({
              url: webviewState.url,
              name: webviewState.title,
              createdAt: Date.now(),
            });
          }
        },
      },
      isConnected && {
        title: 'Disconnect',
        textColor: colors2024['red-dark'],
        iosIconSource: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_disconnect.png'),
        androidIconName: 'ic_rabby_menu_disconnect',
        key: 'disconnect',
        onSelect: () => {
          console.debug('Disconnect clicked');
          onPressButtonInternal({ type: 'disconnect' });
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
      menuActions: menuActions.reverse(),
    } as React.ComponentProps<typeof DropdownMenuView>['menuConfig'];
  }, [
    webviewState.url,
    webviewState.title,
    isBookmark,
    isConnected,
    colors2024,
    removeBookmark,
    addBookmark,
    onPressButtonInternal,
  ]);

  return (
    <View style={[styles.navControls]}>
      <TouchableOpacity
        style={[styles.navControlItem]}
        disabled={!canGoBack}
        onPress={event => onPressButtonInternal({ type: 'back', event })}>
        <RcIconBackCC
          color={
            canGoBack ? colors2024['neutral-body'] : colors2024['neutral-info']
          }
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.navControlItem,
          !webviewState?.canGoForward && styles.disabledStyle,
        ]}
        onPress={event => onPressButtonInternal({ type: 'forward', event })}>
        <RcIconForwardCC
          color={
            canGoForward
              ? colors2024['neutral-body']
              : colors2024['neutral-info']
          }
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navControlItem]}
        onPress={event => onPressButtonInternal({ type: 'reload', event })}>
        <RcIconRefreshCC color={colors2024['neutral-body']} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navControlItem]}
        onPress={onPressViewTabs}>
        <Text>{tabsCount || 0}</Text>
      </TouchableOpacity>
      <View style={[styles.navControlItem]}>
        <DropdownMenuView menuConfig={menuConfigs}>
          <RcIconMoreCC color={colors2024['neutral-body']} />
        </DropdownMenuView>
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  navControls: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 12,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  navControlItem: {
    height: '100%',
    width: '100%',
    flexShrink: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // ...makeDebugBorder('orange'),
  },
  disabledStyle: {
    opacity: 0.3,
  },
}));
