import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
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

  const menuActions = React.useMemo(() => {
    return [
      {
        title: 'Edit',
        icon: require('@/assets2024/icons/menu/edit.png'),
        key: 'edit',
        action() {
          editAliasName.show(account);
        },
      },

      {
        title: 'Address Detail',
        icon: require('@/assets2024/icons/menu/detail.png'),
        key: 'detail',
        action() {
          showAddressDetail({ account });
        },
      },
      {
        title: 'Delete',
        icon: require('@/assets2024/icons/menu/delete.png'),
        key: 'delete',
        destructive: true,
        action() {
          removeAccount({ account });
        },
      },
    ] as MenuAction[];
  }, [account, showAddressDetail, editAliasName, removeAccount]);

  return (
    <TouchableOpacity style={styles.root} onPress={onDetail}>
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
