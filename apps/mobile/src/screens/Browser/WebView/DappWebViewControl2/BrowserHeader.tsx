import React, { useCallback } from 'react';
import {
  GestureResponderEvent,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { WebViewState, useWebViewControl } from '@/components/WebView/hooks';

import {
  RcBackCC,
  RcForwardCC,
  RcMoreCC,
  RcRefreshCC,
} from '@/assets2024/icons/browser';
import { RootNames } from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { DropdownMenuView } from './DropdownMenuView';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';
import { RcIconCloseCC } from '@/assets/icons/common';
import { useMemoizedFn } from 'ahooks';
// import { RcIconCloseCC, RcIconCloseCircleCC } from '@/assets/icons/common';

export const BOTTOM_NAV_CONTROL_PRESS_OPACITY = 0.3;

export type BottomNavControlCbCtx = {
  webviewState: WebViewState;
  webviewActions: ReturnType<typeof useWebViewControl>['webviewActions'];
};

type OnPressButtonCtx = {
  type: 'back' | 'forward' | 'reload' | 'favorite' | 'disconnect';
  event?: GestureResponderEvent;
};

export function BrowserHeader() {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const navigation = useRabbyAppNavigation();
  const { finalSceneCurrentAccount, sceneCurrentAccount } = useSceneAccountInfo(
    {
      forScene: '@ActiveDappWebViewModal',
    },
  );
  const { isVisible: isOpen, toggleSceneVisible } = useAccountSceneVisible(
    '@ActiveDappWebViewModal',
  );

  const handleClose = useMemoizedFn(() => {
    navigation.goBack();
  });

  return (
    <View style={styles.header}>
      {finalSceneCurrentAccount ? (
        <WalletIcon
          type={finalSceneCurrentAccount?.type}
          width={24}
          height={24}
          style={{ borderRadius: 6 }}
        />
      ) : null}
      <View style={styles.addressBar}>
        <Text style={styles.addressBarText}>Uniswap.org</Text>
      </View>
      <View>
        <TouchableOpacity onPress={handleClose}>
          <View style={styles.iconCloseCircle}>
            <RcIconCloseCC
              width={21}
              height={21}
              color={colors2024['neutral-title-1']}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 9,
    gap: 12,
    // borderBottomWidth: 1,
    // borderBottomColor: colors2024['neutral-line'],
  },
  addressBar: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
  },
  addressBarText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  iconCloseCircle: {
    width: 32,
    height: 32,
    backgroundColor: colors2024['neutral-bg-2'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
  },
}));
