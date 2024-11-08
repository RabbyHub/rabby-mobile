import { useAccounts } from '@/hooks/account';
import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressItemInner2024 } from '@/screens/Address/components/AddressItemInner2024';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';
import DeleteSVG from '@/assets2024/icons/common/delete-cc.svg';
import MoreSVG from '@/assets2024/icons/common/more-cc.svg';
import { useDeleteAccountModal } from '@/screens/Address/useDeleteAccountModal';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useAliasNameEditModal } from '../AliasNameEditModal/useAliasNameEditModal';

export interface Props {
  type: 'address' | 'watch-address' | 'safe-address';
}

export const AddressQuickManager: React.FC<Props> = ({ type }) => {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const accountList = React.useMemo(() => {
    if (type === 'address') {
      return accounts.filter(
        account =>
          account.type !== KEYRING_TYPE.WatchAddressKeyring &&
          account.type !== KEYRING_TYPE.GnosisKeyring,
      );
    } else if (type === 'watch-address') {
      return accounts.filter(
        account => account.type === KEYRING_TYPE.WatchAddressKeyring,
      );
    } else if (type === 'safe-address') {
      return accounts.filter(
        account => account.type === KEYRING_TYPE.GnosisKeyring,
      );
    }

    return [];
  }, [accounts, type]);
  const removeAccount = useDeleteAccountModal();
  const editAliasName = useAliasNameEditModal();

  return (
    <ScrollView style={styles.root}>
      <View style={styles.list}>
        {accountList.map(account => (
          <View style={styles.addressItem} key={account.type + account.address}>
            <View style={styles.itemLeft}>
              <TouchableOpacity
                hitSlop={10}
                onPress={() => {
                  removeAccount({ account });
                }}>
                <DeleteSVG />
              </TouchableOpacity>
              <AddressItemInner2024
                style={styles.card}
                account={account}
                hiddenArrow
              />
            </View>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={() => {
                  editAliasName.show(account);
                }}
                hitSlop={10}
                style={styles.button}>
                <EditSVG
                  color={colors2024['neutral-body']}
                  width={20}
                  height={20}
                />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={10} style={styles.button}>
                <MoreSVG
                  color={colors2024['neutral-body']}
                  width={20}
                  height={20}
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    paddingHorizontal: 16,
    paddingTop: 30,
    flex: 1,
  },
  list: {
    flex: 1,
    gap: 12,
    paddingBottom: 54,
  },
  addressItem: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    justifyContent: 'space-between',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    padding: 0,
    marginLeft: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 5,
    borderRadius: 30,
  },
}));
