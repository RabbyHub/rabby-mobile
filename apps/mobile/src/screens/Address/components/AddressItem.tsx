import React, { useCallback, useMemo } from 'react';
import { GestureResponderEvent, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  KeyringAccountWithAlias,
  useCurrentAccount,
  usePinAddresses,
} from '@/hooks/account';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { PinBadge } from './PinBadge';
import { addressUtils } from '@rabby-wallet/base-utils';
import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { useDeleteAccountModal } from '../useDeleteAccountModal';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 0,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  itemInfo: {
    gap: 6,
  },
  itemNameText: {
    fontSize: 17,
    lineHeight: 22,
  },
  itemBalanceText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    width: 30,
    height: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

interface AddressItemProps {
  account: KeyringAccountWithAlias;
}
export const AddressItem = (props: AddressItemProps) => {
  const { account } = props;
  const { switchAccount } = useCurrentAccount();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const removeAccount = useDeleteAccountModal();
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: false,
  });
  const pinned = useMemo(
    () =>
      pinAddresses.some(e =>
        addressUtils.isSameAddress(e.address, account.address),
      ),
    [pinAddresses, account],
  );

  const onDetail = useCallback(() => {
    switchAccount(account);
    navigate(RootNames.StackRoot, { screen: RootNames.Home });
  }, [account, switchAccount]);

  const onSettings = useCallback((event: GestureResponderEvent) => {
    console.log('onSettings', event);
  }, []);

  const menuActions = React.useMemo(() => {
    return [
      {
        title: 'Edit',
        icon: require('@/assets2024/icons/menu/edit.png'),
        key: 'edit',
      },

      {
        title: 'Address Detail',
        icon: require('@/assets2024/icons/menu/detail.png'),
        key: 'detail',
      },
      {
        title: 'Delete',
        icon: require('@/assets2024/icons/menu/delete.png'),
        key: 'delete',
        action() {
          removeAccount({ account });
        },
      },
    ] as MenuAction[];
  }, [account, removeAccount]);

  return (
    <TouchableOpacity style={styles.root} onPress={onDetail}>
      <ContextMenuView
        menuConfig={{
          menuTitle: account.aliasName,
          menuActions: menuActions,
        }}>
        <Card style={styles.card}>
          <InnerAddressItem account={account}>
            {({ WalletIcon, WalletName, WalletBalance }) => (
              <View style={styles.item}>
                <WalletIcon width={40} height={40} />
                <View style={styles.itemInfo}>
                  <View style={styles.itemName}>
                    <WalletName style={styles.itemNameText} />
                    {pinned && <PinBadge />}
                  </View>
                  <WalletBalance style={styles.itemBalanceText} />
                </View>
              </View>
            )}
          </InnerAddressItem>

          <View style={styles.arrow}>
            <ArrowRightCC
              color={colors2024['neutral-body']}
              width={20}
              height={20}
            />
          </View>
        </Card>
      </ContextMenuView>
    </TouchableOpacity>
  );
};
