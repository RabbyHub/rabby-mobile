import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';

import { WebViewState, useWebViewControl } from '@/components/WebView/hooks';

import {
  RcIconMore,
  RcIconNavBack,
  RcIconNavForward,
  // RcIconNavHome,
  RcIconNavReload,
} from './icons';
import TouchableView from '@/components/Touchable/TouchableView';
import { makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { DropdownMenuView, MenuAction } from './DropdownMenuView';
import { urlUtils } from '@rabby-wallet/base-utils';
import { IS_ANDROID } from '@/core/native/utils';

export const BOTTOM_NAV_CONTROL_PRESS_OPACITY = 0.3;

export const bottomNavStyles = StyleSheet.create({
  navControls: {
    width: '100%',
    height: 52,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // ...makeDebugBorder('orange'),
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
});

function TouchableItem(
  props: Omit<React.ComponentProps<typeof TouchableView>, 'ref'>,
) {
  return (
    <TouchableView
      pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
      {...props}
      style={[bottomNavStyles.navControlItem, props.style]}
    />
  );
}

export type BottomNavControlCbCtx = {
  webviewState: WebViewState;
  webviewActions: ReturnType<typeof useWebViewControl>['webviewActions'];
};

type OnPressButtonCtx = {
  type: 'back' | 'forward' | 'reload' | 'favorite' | 'disconnect';
  event?: GestureResponderEvent;
};

export function BottomNavControl2({
  webviewState,
  webviewActions,
  isFavorited,
  isConnected,
  afterNode,
  onPressButton,
}: BottomNavControlCbCtx & {
  isFavorited?: boolean;
  isConnected?: boolean;
  afterNode?:
    | React.ReactNode
    | ((
        ctx: BottomNavControlCbCtx & {
          TouchableItem: typeof TouchableItem;
        },
      ) => React.ReactNode);
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
  const { colors2024 } = useTheme2024();

  const renderedAfterNode = useMemo(() => {
    if (typeof afterNode === 'function') {
      return (
        afterNode({
          webviewState,
          webviewActions,
          TouchableItem,
        }) || null
      );
    }

    return afterNode || null;
  }, [afterNode, webviewState, webviewActions]);

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
        iosIconSource: isFavorited
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite_filled.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite.png'),
        androidIconName: isFavorited
          ? 'ic_rabby_menu_favorite_filled'
          : 'ic_rabby_menu_favorite',
        key: 'favorite',
        onSelect: () => {
          console.debug('Favorite clicked');
          onPressButtonInternal({ type: 'favorite' });
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
    colors2024,
    isFavorited,
    isConnected,
    onPressButtonInternal,
  ]);

  return (
    <View style={[bottomNavStyles.navControls]}>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoBack && bottomNavStyles.disabledStyle,
        ]}
        onPress={event => onPressButtonInternal({ type: 'back', event })}>
        <RcIconNavBack
          isActive={webviewState?.canGoBack}
          width={31}
          height={30}
        />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoForward && bottomNavStyles.disabledStyle,
        ]}
        onPress={event => onPressButtonInternal({ type: 'forward', event })}>
        <RcIconNavForward
          isActive={webviewState?.canGoForward}
          width={31}
          height={30}
        />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={event => onPressButtonInternal({ type: 'reload', event })}>
        <RcIconNavReload isActive width={31} height={30} />
      </TouchableView>
      <View style={[bottomNavStyles.navControlItem]}>
        <DropdownMenuView menuConfig={menuConfigs}>
          <RcIconMore isActive width={31} height={30} />
        </DropdownMenuView>
      </View>

      {renderedAfterNode || null}
    </View>
  );
}

BottomNavControl2.TouchableItem = TouchableItem;
