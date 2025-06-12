import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';

import { WebViewState, useWebViewControl } from '@/components/WebView/hooks';

import {
  RcIconNavBack,
  RcIconNavForward,
  RcIconNavHome,
  RcIconNavReload,
} from '@/components/WebView/icons';
import TouchableView from '@/components/Touchable/TouchableView';
import { makeDebugBorder } from '@/utils/styles';

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
  type: 'back' | 'forward' | 'reload' | 'home';
  event?: GestureResponderEvent;
};

export function BottomNavControl({
  webviewState,
  webviewActions,
  afterNode,
  onPressHome,
  onPressButton,
}: BottomNavControlCbCtx & {
  afterNode?:
    | React.ReactNode
    | ((
        ctx: BottomNavControlCbCtx & {
          TouchableItem: typeof TouchableItem;
        },
      ) => React.ReactNode);
  onPressHome?: (ctx: BottomNavControlCbCtx) => void;
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
  const onPressNavHome = useCallback(() => {
    onPressHome?.({
      webviewState,
      webviewActions,
    });
  }, [onPressHome, webviewState, webviewActions]);

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
        case 'home':
          onPressNavHome();
          break;
        default:
          break;
      }
    },
    [webviewActions, onPressNavHome],
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

  return (
    <View style={[bottomNavStyles.navControls]}>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoBack && bottomNavStyles.disabledStyle,
        ]}
        onPress={event => onPressButtonInternal({ type: 'back', event })}>
        <RcIconNavBack width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoForward && bottomNavStyles.disabledStyle,
        ]}
        onPress={event => onPressButtonInternal({ type: 'forward', event })}>
        <RcIconNavForward width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={event => onPressButtonInternal({ type: 'reload', event })}>
        <RcIconNavReload width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={event => onPressButtonInternal({ type: 'home', event })}>
        <RcIconNavHome width={26} height={26} />
      </TouchableView>
      {renderedAfterNode || null}
      {/* <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={() => {}}>
        <RcIconDisconnect isActive width={26} height={26} />
      </TouchableView> */}
    </View>
  );
}

BottomNavControl.TouchableItem = TouchableItem;
