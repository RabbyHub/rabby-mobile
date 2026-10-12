import React, { memo, useCallback, type ReactElement } from 'react';
import { View } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';
import { ContextMenuView } from '@/components2024/ContextMenuView/ContextMenuView';
import { toast } from '@/components2024/Toast';
import { apisTheme } from '@/hooks/theme';
import { useRemovedTokens } from '@/hooks/useRemovedTokens';
import {
  isUserTokenPinnedInMemory,
  toggleUserTokenPinned,
} from '@/hooks/useTokenSettings';
import {
  tokenEntityResourceStore,
  tokenGroupResourceStore,
  type ITokenItem,
  type TokenEntityId,
  type TokenGroupId,
} from '@/store/tokens';
import i18n from '@/utils/i18n';

const TOKEN_MENU_TRIGGER_PROPS = { action: 'longPress' } as const;
type Props = (
  | { tokenId: TokenEntityId; groupId?: never }
  | { groupId: TokenGroupId; tokenId?: never }
) & {
  children: ReactElement;
  onRemoveToken(token: ITokenItem): void;
};

// Use once at list level; rows do not subscribe to removed-token preferences.
export function useRemoveTokenAction() {
  const addRemovedToken = useRemovedTokens(state => state.addRemovedToken);
  return useCallback(
    (token: ITokenItem) => {
      addRemovedToken({ chainId: token.chain, tokenId: token.id }).catch(
        error => {
          console.error('Remove token failed:', error);
          toast.show(i18n.t('page.singleHome.tokenActions.removeFailed'));
        },
      );
    },
    [addRemovedToken],
  );
}

/** Stable menu host; resolve the latest token and action state only on opening. */
export const TokenRowContextMenu = memo(
  ({ tokenId, groupId, onRemoveToken, children }: Props) => {
    const getMenuConfig = useCallback(() => {
      const token = groupId
        ? tokenGroupResourceStore.getValue(groupId)?.summary
        : tokenId
        ? tokenEntityResourceStore.getValue(tokenId)
        : undefined;
      if (!token) {
        return { menuActions: [] };
      }
      const isPinned = isUserTokenPinnedInMemory(token);
      const isDarkTheme = apisTheme.getBinaryMode() === 'dark';
      return {
        menuActions: [
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
            key: 'favorite',
            androidIconName: isPinned
              ? 'ic_rabby_menu_token_unfavorite'
              : 'ic_rabby_menu_token_favorite',
            action() {
              toggleUserTokenPinned(token);
            },
          },
          {
            title: i18n.t('page.singleHome.tokenActions.remove'),
            icon: isDarkTheme
              ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_remove_dark.png')
              : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_remove.png'),
            key: 'remove',
            androidIconName: 'ic_rabby_menu_token_remove',
            destructive: true,
            action() {
              onRemoveToken(token);
            },
          },
        ],
      };
    }, [groupId, onRemoveToken, tokenId]);
    return (
      <ContextMenuView
        getMenuConfig={getMenuConfig}
        preViewBorderRadius={14}
        triggerProps={TOKEN_MENU_TRIGGER_PROPS}>
        {IS_ANDROID ? <View collapsable={false}>{children}</View> : children}
      </ContextMenuView>
    );
  },
);
