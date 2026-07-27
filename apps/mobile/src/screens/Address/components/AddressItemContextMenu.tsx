import { aliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import {
  ContextMenuView,
  MenuAction,
  MenuConfig,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { KeyringAccountWithAlias, storeApiAccounts } from '@/hooks/account';
import { apisTheme } from '@/hooks/theme';
import { addressUtils } from '@rabby-wallet/base-utils';
import { keyBy } from 'lodash';
import React from 'react';
import { useDeleteAccountModal } from '../useDeleteAccountModal';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { trigger } from 'react-native-haptic-feedback';
import { toast } from '@/components2024/Toast';
import i18n from '@/utils/i18n';

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
  children: React.ReactElement<any>;
  preViewBorderRadius?: number;
  actions: ('copy' | 'pin' | 'edit' | 'delete')[];
}
type RemoveAccount = ReturnType<typeof useDeleteAccountModal>;

const AddressItemContextMenuInner: React.FC<
  Props & {
    removeAccount?: RemoveAccount;
  }
> = props => {
  const { account, children, actions, preViewBorderRadius = 20 } = props;
  const { removeAccount } = props;

  const getMenuConfig = (): MenuConfig => {
    const isDarkTheme = apisTheme.getBinaryMode() === 'dark';
    const pinned = storeApiAccounts
      .getPinAddresses()
      .some(
        e =>
          addressUtils.isSameAddress(e.address, account.address) &&
          e.brandName === account.brandName,
      );
    const menuActionDict = keyBy(
      (
        [
          {
            title: i18n.t('page.whitelist.copyAddress'),
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
              ? i18n.t('page.addressDetail.addressListScreen.unpin')
              : i18n.t('page.addressDetail.addressListScreen.pin'),
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
              storeApiAccounts
                .togglePinAddressAsync({
                  address: account.address,
                  brandName: account.brandName,
                  nextPinned: !pinned,
                })
                .catch(error => {
                  console.error('Toggle pinned address failed:', error);
                });
            },
          },
          {
            title: i18n.t('page.addressDetail.addressListScreen.edit'),
            icon: isDarkTheme ? MenuIcons.editDark : MenuIcons.edit,
            androidIconName: 'ic_rabby_menu_edit',
            key: 'edit',
            action() {
              aliasNameEditModal.show(account);
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
            title: i18n.t('page.addressDetail.addressListScreen.delete'),
            icon: isDarkTheme ? MenuIcons.deleteDark : MenuIcons.delete,
            key: 'delete',
            androidIconName: 'ic_rabby_menu_delete',
            destructive: true,
            action() {
              removeAccount?.({
                account,
                onFinished: () => {
                  toast.success(i18n.t('global.Deleted'));
                },
              });
            },
          },
        ] as MenuAction[]
      ).filter(Boolean),
      item => item.key,
    );

    return {
      menuTitle: account.address,
      menuActions: actions
        .map(key => menuActionDict[key])
        .filter(v => v) as MenuAction[],
    };
  };

  return (
    <ContextMenuView
      getMenuConfig={getMenuConfig}
      preViewBorderRadius={preViewBorderRadius}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};

const AddressItemContextMenuWithDelete: React.FC<Props> = props => {
  const removeAccount = useDeleteAccountModal();

  return (
    <AddressItemContextMenuInner {...props} removeAccount={removeAccount} />
  );
};

export const AddressItemContextMenu: React.FC<Props> = props => {
  if (props.actions.includes('delete')) {
    return <AddressItemContextMenuWithDelete {...props} />;
  }

  return <AddressItemContextMenuInner {...props} />;
};
