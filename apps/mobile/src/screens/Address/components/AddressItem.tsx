import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias, useCurrentAccount } from '@/hooks/account';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { useDeleteAccountModal } from '../useDeleteAccountModal';
import { AddressItemInner2024 } from './AddressItemInner2024';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { useAddressDetailModal } from '../useAddressDetailModal';
import { noop } from 'lodash';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
}));

interface AddressItemProps {
  account: KeyringAccountWithAlias;
}
export const AddressItem = (props: AddressItemProps) => {
  const { account } = props;
  const { switchAccount } = useCurrentAccount();
  const { styles } = useTheme2024({ getStyle });
  const removeAccount = useDeleteAccountModal();
  const editAliasName = useAliasNameEditModal();
  const showAddressDetail = useAddressDetailModal();

  const onDetail = useCallback(() => {
    switchAccount(account);
    navigate(RootNames.StackRoot, { screen: RootNames.Home });
  }, [account, switchAccount]);

  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActions = React.useMemo(() => {
    return [
      {
        title: 'Edit name',
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit.png'),
        androidIconName: 'ic_rabby_menu_edit',
        key: 'edit',
        action() {
          editAliasName.show(account);
        },
      },

      {
        title: 'Address Details',
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_more_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_more.png'),
        key: 'detail',
        androidIconName: 'ic_rabby_menu_more',
        action() {
          showAddressDetail({ account });
        },
      },
      {
        title: 'Delete',
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
    ] as MenuAction[];
  }, [isDarkTheme, editAliasName, account, showAddressDetail, removeAccount]);

  return (
    <TouchableOpacity style={styles.root} onPress={onDetail} onLongPress={noop}>
      <ContextMenuView
        menuConfig={{
          menuTitle: account.aliasName,
          menuActions: menuActions,
        }}>
        <AddressItemInner2024 account={account} />
      </ContextMenuView>
    </TouchableOpacity>
  );
};
