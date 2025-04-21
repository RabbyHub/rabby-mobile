import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { useGetBinaryMode } from '@/hooks/theme';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IS_ANDROID } from '@/core/native/utils';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '../AddressViewer/CopyAddress';
import { KeyringAccountWithAlias } from '@/hooks/account';

interface Props {
  children: React.ReactElement;
  account: KeyringAccountWithAlias;
}
export const AccountSwitcherContextMenu: React.FC<Props> = props => {
  const { children, account } = props;
  const editAliasName = useAliasNameEditModal();
  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActions = React.useMemo(
    () => [
      {
        title: t('page.whitelist.copyAddress'),
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
        title: t('page.addressDetail.addressListScreen.edit'),
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit.png'),
        androidIconName: 'ic_rabby_menu_edit',
        key: 'edit',
        action() {
          editAliasName.show(account);
        },
      },
    ],
    [t, editAliasName, account, isDarkTheme],
  );

  if (IS_ANDROID) {
    return <>{children}</>;
  }

  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.address,
        menuActions: menuActions,
      }}
      preViewBorderRadius={20}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
