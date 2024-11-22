import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
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
import { addressUtils } from '@rabby-wallet/base-utils';
import { trigger } from 'react-native-haptic-feedback';

const { isSameAddress } = addressUtils;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-3'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
}));

interface AddressItemProps {
  account: KeyringAccountWithAlias;
}
export const AddressItem = (props: AddressItemProps) => {
  const { account } = props;
  const { switchAccount, currentAccount } = useCurrentAccount();
  const { styles } = useTheme2024({ getStyle });
  const removeAccount = useDeleteAccountModal();
  const editAliasName = useAliasNameEditModal();
  const showAddressDetail = useAddressDetailModal();
  const [isPressing, setIsPressing] = React.useState(false);

  const onDetail = useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    switchAccount(account);
    navigate(RootNames.SingleAddressStack, {
      screen: RootNames.SingleAddressHome,
    });
  }, [account, switchAccount]);

  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActions = React.useMemo(() => {
    return [
      {
        title: 'Edit Name',
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

  const isCurrentAccount = React.useMemo(() => {
    return (
      currentAccount &&
      isSameAddress(currentAccount.address, account.address) &&
      currentAccount.type === account.type
    );
  }, [currentAccount, account]);

  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.aliasName,
        menuActions: menuActions,
      }}
      triggerProps={{ action: 'longPress' }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([
          styles.root,
          isPressing && styles.rootPressing,
        ])}
        delayLongPress={200} // long press delay
        onPress={onDetail}
        onLongPress={() => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}>
        <AddressItemInner2024
          isPressing={isCurrentAccount || isPressing}
          account={account}
        />
      </TouchableOpacity>
    </ContextMenuView>
  );
};
