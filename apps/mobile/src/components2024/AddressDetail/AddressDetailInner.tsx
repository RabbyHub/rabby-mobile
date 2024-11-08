import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressInfoItem } from './AddressInfoItem';
import { AddressAssetsItem } from './AddressAssetsItem';
import { AddressBackupItem } from './AddressBackupItem';
import { Card } from '../Card';
import { Item } from './Item';
import { useDeleteAccountModal } from '@/screens/Address/useDeleteAccountModal';
import DeleteSVG from '@/assets2024/icons/common/delete-cc.svg';
import { AppSwitch2024 } from '@/components/customized/Switch2024';

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
}

export const AddressDetailInner: React.FC<AddressInfoProps> = props => {
  const { account, onCancel } = props;
  const { styles } = useTheme2024({ getStyle });
  const { isAddrOnWhitelist, addWhitelist, removeWhitelist } = useWhitelist();
  const inWhiteList = useMemo(
    () => isAddrOnWhitelist(account.address),
    [account.address, isAddrOnWhitelist],
  );
  const setInWhitelist = useCallback(
    (bool: boolean) => {
      bool ? addWhitelist(account.address) : removeWhitelist(account.address);
    },
    [account.address, addWhitelist, removeWhitelist],
  );
  const { pinAddresses, togglePinAddressAsync } = usePinAddresses();
  const pinned = useMemo(
    () =>
      pinAddresses.some(e =>
        addressUtils.isSameAddress(e.address, account.address),
      ),
    [account.address, pinAddresses],
  );

  const setPinned = useCallback(
    (bool: boolean) => {
      togglePinAddressAsync({
        address: account.address,
        brandName: account.brandName,
        nextPinned: bool,
      });
    },
    [togglePinAddressAsync, account.address, account.brandName],
  );
  const removeAccount = useDeleteAccountModal();

  return (
    <View style={styles.root}>
      <AddressInfoItem account={account} />
      <View style={styles.cardList}>
        <AddressAssetsItem onCancel={onCancel} account={account} />
        <AddressBackupItem onCancel={onCancel} account={account} />
        <Card style={styles.card}>
          <Item
            label="Add to Whitelist"
            value={
              <AppSwitch2024
                onValueChange={setInWhitelist}
                value={inWhiteList}
              />
            }
          />
        </Card>
        <Card style={styles.card}>
          <Item
            label="Pin in list"
            value={<AppSwitch2024 onValueChange={setPinned} value={pinned} />}
          />
        </Card>
        <Card
          style={styles.card}
          onPress={() => {
            removeAccount({ account });
          }}>
          <Item
            label="Delete Address"
            labelStyle={styles.labelText}
            value={<DeleteSVG width={20} height={20} />}
          />
        </Card>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    flex: 1,
  },
  cardList: {
    gap: 12,
  },
  card: {
    marginHorizontal: 16,
  },
  labelText: {
    color: colors2024['red-default'],
  },
}));
