import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  RcIconBackCC,
  RcIconForwardCC,
  RcIconMoreCC,
  RcIconRefreshCC,
} from '@/assets2024/icons/browser';
import { IS_ANDROID } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { DropdownMenuView } from './DropdownMenuView';

export function BrowserFooter({
  isConnected,
  canGoBack,
  canGoForward,
  canReload,
  canViewMore,
  tabsCount,
  isBookmark,

  url,

  onGoBack,
  onGoForward,
  onReload,
  onViewTabs,
  onBookmark,
  onDisconnect,
}: {
  isBookmark?: boolean;
  isConnected?: boolean;
  canReload?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  url?: string;
  tabsCount?: number;
  canViewMore?: boolean;

  onGoBack?(): void;
  onGoForward?(): void;
  onReload?(): void;
  onViewTabs?(): void;
  onBookmark?(): void;
  onDisconnect?(): void;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const menuConfigs = React.useMemo(() => {
    const urlInfo = urlUtils.canoicalizeDappUrl(url || '');

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
          onBookmark?.();
        },
      },
      isConnected && {
        title: 'Disconnect',
        textColor: colors2024['red-dark'],
        iosIconSource: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_disconnect.png'),
        androidIconName: 'ic_rabby_menu_disconnect',
        key: 'disconnect',
        onSelect: () => {
          onDisconnect?.();
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
  }, [url, isBookmark, isConnected, colors2024, onBookmark, onDisconnect]);

  return (
    <View style={[styles.navControls]}>
      <TouchableOpacity
        style={[styles.navControlItem]}
        disabled={!canGoBack}
        onPress={onGoBack}>
        <RcIconBackCC
          color={
            canGoBack ? colors2024['neutral-body'] : colors2024['neutral-info']
          }
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navControlItem]}
        disabled={!canGoForward}
        onPress={onGoForward}>
        <RcIconForwardCC
          color={
            canGoForward
              ? colors2024['neutral-body']
              : colors2024['neutral-info']
          }
        />
      </TouchableOpacity>
      <TouchableOpacity
        disabled={!canReload}
        style={[styles.navControlItem]}
        onPress={onReload}>
        <RcIconRefreshCC
          color={
            canReload ? colors2024['neutral-body'] : colors2024['neutral-info']
          }
        />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.navControlItem]} onPress={onViewTabs}>
        <Text>{tabsCount || 0}</Text>
      </TouchableOpacity>
      {canViewMore ? (
        <View style={[styles.navControlItem]}>
          <DropdownMenuView menuConfig={menuConfigs}>
            <RcIconMoreCC color={colors2024['neutral-body']} />
          </DropdownMenuView>
        </View>
      ) : (
        <View style={[styles.navControlItem]}>
          <RcIconMoreCC color={colors2024['neutral-foot']} />
        </View>
      )}
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
