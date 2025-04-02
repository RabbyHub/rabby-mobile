import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { useGetBinaryMode } from '@/hooks/theme';
import { keyBy } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { type TokenSelectType } from './TokenSelectorSheetModal';

interface Props {
  token: TokenItem;
  closeBottomSheet: () => void;
  children: React.ReactElement;
  type?: TokenSelectType;
}
export const TokenItemContextMenu: React.FC<Props> = props => {
  const { children, token, closeBottomSheet, type } = props;

  const { userTokenSettings, pinToken, removePinedToken } =
    useUserTokenSettings();

  const isPined = useMemo(
    () =>
      userTokenSettings.pinedQueue.some(
        pinned => pinned.chainId === token.chain && pinned.tokenId === token.id,
      ),
    [token.chain, token.id, userTokenSettings.pinedQueue],
  );

  const handlePress = useCallback(() => {
    if (isPined) {
      removePinedToken(token);
    } else {
      pinToken(token);
    }
  }, [isPined, pinToken, removePinedToken, token]);

  const gotoTokenDetail = useCallback(() => {
    setTimeout(() => {
      closeBottomSheet();
    }, 100);

    navigate(RootNames.TokenDetail, {
      token: ensureAbstractPortfolioToken(token),
      needUseCacheToken: true,
      tokenSelectType: type,
    });
  }, [closeBottomSheet, token, type]);

  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActionDict = React.useMemo(() => {
    return keyBy(
      [
        {
          title: isPined
            ? t('page.addressDetail.addressListScreen.unpin')
            : t('page.addressDetail.addressListScreen.pin'),
          icon: isPined
            ? isDarkTheme
              ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png')
              : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png')
            : isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin.png'),
          androidIconName: isPined
            ? 'ic_rabby_menu_un_pin'
            : 'ic_rabby_menu_pin',
          key: 'pin',
          action() {
            handlePress();
          },
        },
        {
          title: t('component.TokenSelector.contextMenu.viewDetail'),
          icon: isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
          key: 'detail',
          androidIconName: 'ic_rabby_menu_more',
          action() {
            gotoTokenDetail();
          },
        },
      ] as MenuAction[],
      item => item.key,
    );
  }, [isPined, t, isDarkTheme, handlePress, gotoTokenDetail]);

  const menuActions = React.useMemo(() => {
    return ['pin', 'detail']
      .map(key => {
        return menuActionDict[key];
      })
      .filter(v => v);
  }, [menuActionDict]);

  return (
    <ContextMenuView
      menuConfig={{
        // menuTitle: null,
        menuActions: menuActions,
      }}
      preViewBorderRadius={20}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
