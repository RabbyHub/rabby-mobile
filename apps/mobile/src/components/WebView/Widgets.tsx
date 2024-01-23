import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { WebViewState, useWebViewControl } from '@/components/WebView/hooks';

import {
  RcIconNavBack,
  RcIconNavForward,
  RcIconNavHome,
  RcIconNavReload,
} from '@/components/WebView/icons';
import TouchableView from '@/components/Touchable/TouchableView';

export const BOTTOM_NAV_CONTROL_PRESS_OPACITY = 0.3;

export const bottomNavStyles = StyleSheet.create({
  navControls: {
    width: '100%',
    height: 52,
    paddingHorizontal: 26,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navControlItem: {
    height: '100%',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disabledStyle: {
    opacity: 0.3,
  },
});

function TouchableItem(props: React.ComponentProps<typeof TouchableView>) {
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

export function BottomNavControl({
  webviewState,
  webviewActions,
  afterNode,
  onPressHome,
}: BottomNavControlCbCtx & {
  afterNode?:
    | React.ReactNode
    | ((
        ctx: BottomNavControlCbCtx & {
          TouchableItem: typeof TouchableItem;
        },
      ) => React.ReactNode);
  onPressHome?: (ctx: BottomNavControlCbCtx) => void;
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

  return (
    <View style={[bottomNavStyles.navControls]}>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoBack && bottomNavStyles.disabledStyle,
        ]}
        onPress={webviewActions.handleGoBack}>
        <RcIconNavBack width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoForward && bottomNavStyles.disabledStyle,
        ]}
        onPress={webviewActions.handleGoForward}>
        <RcIconNavForward width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={webviewActions.handleReload}>
        <RcIconNavReload width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={BOTTOM_NAV_CONTROL_PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={onPressNavHome}>
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
