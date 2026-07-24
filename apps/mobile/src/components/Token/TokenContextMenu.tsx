import {
  ContextMenuView,
  type MenuAction,
  type MenuConfig,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { apisTheme } from '@/hooks/theme';
import React from 'react';
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
import i18n from '@/utils/i18n';

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

  const handlePress = () => {
    toggleUserTokenPinned(token);
  };

  const gotoTokenDetail = () => {
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
  };

  const getMenuConfig = (): MenuConfig => {
    const isPinned = isUserTokenPinnedInMemory(token);
    const isDarkTheme = apisTheme.getBinaryMode() === 'dark';
    const menuActions: MenuAction[] = [
      {
        title: isPinned
          ? i18n.t('page.tokenDetail.action.unfavorite')
          : i18n.t('page.tokenDetail.action.favorite'),
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
        title: i18n.t('component.TokenSelector.contextMenu.viewDetail'),
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
  };

  return (
    <ContextMenuView
      getMenuConfig={getMenuConfig}
      preViewBorderRadius={20}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
