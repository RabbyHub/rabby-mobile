import {
  ContextMenuView,
  type MenuAction,
  type MenuConfig,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { apisTheme } from '@/hooks/theme';
import React from 'react';
import { aliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '../AddressViewer/CopyAddress';
import { KeyringAccountWithAlias } from '@/hooks/account';
import i18n from '@/utils/i18n';

interface Props {
  children: React.ReactElement<any>;
  account: KeyringAccountWithAlias;
  preViewBorderRadius?: number;
}
export const AccountSwitcherContextMenu: React.FC<Props> = props => {
  const { children, account, preViewBorderRadius = 20 } = props;
  const getMenuConfig = (): MenuConfig => {
    const isDarkTheme = apisTheme.getBinaryMode() === 'dark';
    const menuActions: MenuAction[] = [
      {
        title: i18n.t('page.whitelist.copyAddress'),
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_copy_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_copy.png'),
        androidIconName: 'ic_rabby_menu_copy',
        key: 'copy',
        action() {
          Clipboard.setString(account.address);
          toastCopyAddressSuccess(account.address);
        },
      },
      {
        title: i18n.t('page.addressDetail.addressListScreen.edit'),
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit.png'),
        androidIconName: 'ic_rabby_menu_edit',
        key: 'edit',
        action() {
          aliasNameEditModal.show(account);
        },
      },
    ];

    return {
      menuActions,
    };
  };

  return (
    <ContextMenuView
      menuTitle={account.address}
      getMenuConfig={getMenuConfig}
      preViewBorderRadius={preViewBorderRadius}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
