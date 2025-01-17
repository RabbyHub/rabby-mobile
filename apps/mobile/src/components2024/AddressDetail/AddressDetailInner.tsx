import React, { useCallback, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';
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
import QrcodeSVG from '@/assets2024/icons/common/qrcode-cc.svg';
import { useQrCodeModal } from '../QrCodeModal/useQrCodeModal';
import { useTranslation } from 'react-i18next';

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
}

export const AddressDetailInner: React.FC<AddressInfoProps> = props => {
  const { account, onCancel } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
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
      pinAddresses.some(
        e =>
          addressUtils.isSameAddress(e.address, account.address) &&
          e.brandName === account.brandName,
      ),
    [account, pinAddresses],
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
  const qrCodeModal = useQrCodeModal();
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <View style={styles.qrCodeView}>
        <TouchableOpacity
          style={styles.qrCode}
          hitSlop={10}
          onPress={() => {
            qrCodeModal.show(account.address);
          }}>
          <QrcodeSVG
            width={20}
            height={20}
            color={colors2024['neutral-body']}
          />
        </TouchableOpacity>
      </View>
      <AddressInfoItem account={account} />
      <View style={styles.cardList}>
        <AddressAssetsItem onCancel={onCancel} account={account} />
        <AddressBackupItem onCancel={onCancel} account={account} />
        <Card style={styles.card}>
          <Item
            label={t('page.addressDetail.add-to-whitelist')}
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
            label={t('page.addressDetail.pin-in-list')}
            value={<AppSwitch2024 onValueChange={setPinned} value={pinned} />}
          />
        </Card>
        <Card
          style={styles.card}
          onPress={() => {
            removeAccount({ account, onFinished: onCancel });
          }}>
          <Item
            label={t('page.addressDetail.delete-address')}
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
    marginBottom: 56,
  },
  cardList: {
    gap: 12,
  },
  card: {
    marginHorizontal: 16,
    width: 'auto',
  },
  labelText: {
    color: colors2024['red-default'],
  },
  qrCode: {},
  qrCodeView: {
    alignItems: 'flex-end',
    paddingRight: 24,
    paddingTop: 10,
  },
}));
