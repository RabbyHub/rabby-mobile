import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { useGetBinaryMode } from '@/hooks/theme';
import { addressUtils } from '@rabby-wallet/base-utils';
import { keyBy } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteAccountModal } from '../useDeleteAccountModal';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';

interface Props {
  account: KeyringAccountWithAlias;
  children: React.ReactElement;
  actions: ('copy' | 'pin' | 'edit' | 'delete')[];
}
export const AddressItemContextMenu: React.FC<Props> = props => {
  const { account, children, actions } = props;
  const removeAccount = useDeleteAccountModal();
  const editAliasName = useAliasNameEditModal();

  const { pinAddresses, togglePinAddressAsync } = usePinAddresses({
    disableAutoFetch: true,
  });
  const pinned = useMemo(
    () =>
      pinAddresses.some(
        e =>
          addressUtils.isSameAddress(e.address, account.address) &&
          e.brandName === account.brandName,
      ),
    [pinAddresses, account],
  );

  const handlePinned = useCallback(() => {
    togglePinAddressAsync({
      address: account.address,
      brandName: account.brandName,
      nextPinned: !pinned,
    });
  }, [togglePinAddressAsync, account.address, account.brandName, pinned]);

  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActionDict = React.useMemo(() => {
    return keyBy(
      [
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
          title: pinned
            ? t('page.addressDetail.addressListScreen.unpin')
            : t('page.addressDetail.addressListScreen.pin'),
          icon: pinned
            ? isDarkTheme
              ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png')
              : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png')
            : isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin.png'),
          androidIconName: pinned
            ? 'ic_rabby_menu_un_pin'
            : 'ic_rabby_menu_pin',
          key: 'pin',
          action() {
            handlePinned();
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
        // {
        //   title: t('page.addressDetail.addressListScreen.detail'),
        //   icon: isDarkTheme
        //     ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_more_dark.png')
        //     : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_more.png'),
        //   key: 'detail',
        //   androidIconName: 'ic_rabby_menu_more',
        //   action() {
        //     showAddressDetail({ account });
        //   },
        // },
        {
          title: t('page.addressDetail.addressListScreen.delete'),
          icon: isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete.png'),
          key: 'delete',
          androidIconName: 'ic_rabby_menu_delete',
          destructive: true,
          action() {
            removeAccount({ account });
          },
        },
      ] as MenuAction[],
      item => item.key,
    );
  }, [
    t,
    isDarkTheme,
    editAliasName,
    account,
    removeAccount,
    pinned,
    handlePinned,
  ]);

  const menuActions = React.useMemo(() => {
    return actions
      .map(key => {
        return menuActionDict[key];
      })
      .filter(v => v);
  }, [actions, menuActionDict]);

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
