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
import { trigger } from 'react-native-haptic-feedback';
import { toast } from '@/components2024/Toast';

const MenuIcons = {
  copyDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_copy_dark.png'),
  copy: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_copy.png'),
  unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png'),
  unpin: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png'),
  pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin_dark.png'),
  pin: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin.png'),
  editDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit_dark.png'),
  edit: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit.png'),
  deleteDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete_dark.png'),
  delete: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete.png'),
};
interface Props {
  account: KeyringAccountWithAlias;
  children: React.ReactElement;
  preViewBorderRadius?: number;
  actions: ('copy' | 'pin' | 'edit' | 'delete')[];
}
export const AddressItemContextMenu: React.FC<Props> = props => {
  const { account, children, actions, preViewBorderRadius = 20 } = props;
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
      (
        [
          {
            title: t('page.whitelist.copyAddress'),
            icon: isDarkTheme ? MenuIcons.copyDark : MenuIcons.copy,
            androidIconName: 'ic_rabby_menu_copy',
            key: 'copy',
            action() {
              trigger('impactLight', {
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false,
              });
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
                ? MenuIcons.unpinDark
                : MenuIcons.unpin
              : isDarkTheme
              ? MenuIcons.pinDark
              : MenuIcons.pin,
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
            icon: isDarkTheme ? MenuIcons.editDark : MenuIcons.edit,
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
            icon: isDarkTheme ? MenuIcons.deleteDark : MenuIcons.delete,
            key: 'delete',
            androidIconName: 'ic_rabby_menu_delete',
            destructive: true,
            action() {
              removeAccount({
                account,
                onFinished: () => {
                  toast.success(t('global.Deleted'));
                },
              });
            },
          },
        ] as MenuAction[]
      ).filter(Boolean),
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
      .filter(v => v) as MenuAction[];
  }, [actions, menuActionDict]);

  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.address,
        menuActions: menuActions,
      }}
      preViewBorderRadius={preViewBorderRadius}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
