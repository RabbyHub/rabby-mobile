import {
  ContextMenuView,
  type MenuAction,
  type MenuConfig,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { useGetBinaryMode } from '@/hooks/theme';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { type TokenSelectType } from './TokenSelectorSheetModal';
import { Keyboard } from 'react-native';
import { tokenItemToITokenItem } from '@/utils/token';
import { storeApiAccountsSwitcher } from '@/hooks/accountsSwitcher';
import {
  isUserTokenPinnedInMemory,
  toggleUserTokenPinned,
} from '@/hooks/useTokenSettings';

interface Props {
  token: TokenItem;
  children: React.ReactElement<any>;
  type?: TokenSelectType;
  needToTokenMarketInfo?: boolean;
  isCustomTestnetToken?: boolean;
}
export const TokenItemContextMenu: React.FC<Props> = props => {
  const { children, token, type, needToTokenMarketInfo, isCustomTestnetToken } =
    props;

  const handlePress = useCallback(() => {
    toggleUserTokenPinned(token);
  }, [token]);

  const gotoTokenDetail = useCallback(() => {
    Keyboard.dismiss();
    const currentAccount = storeApiAccountsSwitcher.getSceneAccountInfo({
      forScene: 'MakeTransactionAbout',
    }).finalSceneCurrentAccount;
    if (needToTokenMarketInfo) {
      navigateDeprecated(RootNames.TokenMarketInfo, {
        token: tokenItemToITokenItem(token, ''),
        needUseCacheToken: true,
        tokenSelectType: type,
        account: currentAccount,
      });
      return;
    }
    navigateDeprecated(RootNames.TokenDetail, {
      token: tokenItemToITokenItem(token, ''),
      needUseCacheToken: true,
      tokenSelectType: type,
      account: currentAccount,
      isCustomTestnetToken,
    });
  }, [isCustomTestnetToken, needToTokenMarketInfo, token, type]);

  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const getMenuConfig = useCallback((): MenuConfig => {
    const isPinned = isUserTokenPinnedInMemory(token);
    const menuActions: MenuAction[] = [
      {
        title: isPinned
          ? t('page.tokenDetail.action.unfavorite')
          : t('page.tokenDetail.action.favorite'),
        icon: isPinned
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite.png'),
        androidIconName: isPinned
          ? 'ic_rabby_menu_token_unfavorite'
          : 'ic_rabby_menu_token_favorite',
        key: 'favorite',
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
    ];

    return {
      menuActions: isCustomTestnetToken
        ? menuActions.filter(action => action.key === 'detail')
        : menuActions,
    };
  }, [
    gotoTokenDetail,
    handlePress,
    isCustomTestnetToken,
    isDarkTheme,
    t,
    token,
  ]);

  return (
    <ContextMenuView
      getMenuConfig={getMenuConfig}
      preViewBorderRadius={20}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
