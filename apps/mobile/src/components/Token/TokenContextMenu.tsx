import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { useGetBinaryMode } from '@/hooks/theme';
import { keyBy } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { type TokenSelectType } from './TokenSelectorSheetModal';
import { IS_ANDROID } from '@/core/native/utils';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { Keyboard } from 'react-native';
import { tokenItemToITokenItem } from '@/utils/token';

interface Props {
  token: TokenItem;
  closeBottomSheet: () => void;
  children: React.ReactElement;
  type?: TokenSelectType;
  needToTokenMarketInfo?: boolean;
}
export const TokenItemContextMenu: React.FC<Props> = props => {
  const { children, token, type, needToTokenMarketInfo } = props;

  const { userTokenSettings, pinToken, removePinedToken } =
    useUserTokenSettings();

  // 获取当前账户地址
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

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
    Keyboard.dismiss();
    navigateDeprecated(
      needToTokenMarketInfo ? RootNames.TokenMarketInfo : RootNames.TokenDetail,
      {
        token: tokenItemToITokenItem(token, ''),
        needUseCacheToken: true,
        tokenSelectType: type,
        account: currentAccount,
      },
    );
  }, [needToTokenMarketInfo, token, type, currentAccount]);

  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActionDict = React.useMemo(() => {
    return keyBy(
      [
        {
          title: isPined
            ? t('page.tokenDetail.action.unfavorite')
            : t('page.tokenDetail.action.favorite'),
          icon: isPined
            ? isDarkTheme
              ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png')
              : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png')
            : isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite.png'),
          androidIconName: isPined
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
      ] as MenuAction[],
      item => item.key,
    );
  }, [isPined, t, isDarkTheme, handlePress, gotoTokenDetail]);

  const menuActions = React.useMemo(() => {
    return ['favorite', 'detail']
      .map(key => {
        return menuActionDict[key]!;
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
