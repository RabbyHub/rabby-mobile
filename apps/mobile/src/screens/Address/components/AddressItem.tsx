import React, { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import {
  KeyringAccountWithAlias,
  useCurrentAccount,
  usePinAddresses,
} from '@/hooks/account';
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
import { addressUtils } from '@rabby-wallet/base-utils';
import { trigger } from 'react-native-haptic-feedback';
import { AddressItemShadowView } from './AddressItemShadowView';
import { useTranslation } from 'react-i18next';

const { isSameAddress } = addressUtils;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-3'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
}));

interface AddressItemProps {
  account: KeyringAccountWithAlias;
  lastSelectedAccount?: KeyringAccountWithAlias;
  onSelect?: () => void;
}
export const AddressItemEntry = (props: AddressItemProps) => {
  const { account, lastSelectedAccount, onSelect } = props;
  const { switchAccount } = useCurrentAccount();
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
    onSelect?.();
    navigate(RootNames.SingleAddressStack, {
      screen: RootNames.SingleAddressHome,
    });
  }, [account, onSelect, switchAccount]);

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
  const menuActions = React.useMemo(() => {
    return [
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
        androidIconName: pinned ? 'ic_rabby_menu_un_pin' : 'ic_rabby_menu_pin',
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
      {
        title: t('page.addressDetail.addressListScreen.detail'),
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
    ] as MenuAction[];
  }, [
    t,
    isDarkTheme,
    editAliasName,
    account,
    showAddressDetail,
    removeAccount,
    pinned,
    handlePinned,
  ]);

  const isCurrentAccount = React.useMemo(() => {
    return (
      lastSelectedAccount &&
      isSameAddress(lastSelectedAccount.address, account.address) &&
      lastSelectedAccount.type === account.type
    );
  }, [lastSelectedAccount, account]);

  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.aliasName,
        menuActions: menuActions,
      }}
      preViewBorderRadius={20}
      triggerProps={{ action: 'longPress' }}>
      <AddressItemShadowView>
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
      </AddressItemShadowView>
    </ContextMenuView>
  );
};
