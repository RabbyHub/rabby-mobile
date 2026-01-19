import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
  onDelete?: () => void;
  showQRcode?: boolean;
}

export const AddressDetailInner: React.FC<
  AddressInfoProps & {
    __IN_SHEET_MODAL__?: boolean;
  }
> = props => {
  const { account, onCancel, onDelete, __IN_SHEET_MODAL__ = false } = props;
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

  const showBackUp =
    account.type === KEYRING_TYPE.HdKeyring ||
    account.type === KEYRING_TYPE.SimpleKeyring;

  return (
    <View style={styles.root}>
      {__IN_SHEET_MODAL__ ? (
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
      ) : null}
      <AddressInfoItem account={account} />
      <View style={styles.cardList}>
        <View style={styles.group}>
          <Text style={styles.subTitle}>
            {t('page.addressDetail.basicInfo')}
          </Text>
          <AddressAssetsItem onCancel={onCancel} account={account} />
        </View>
        {showBackUp ? (
          <View style={styles.group}>
            <Text style={styles.subTitle}>{t('global.Backup')}</Text>
            <AddressBackupItem onCancel={onCancel} account={account} />
          </View>
        ) : null}
        <View style={styles.group}>
          <Text style={styles.subTitle}>{t('global.Other')}</Text>
          <Card style={styles.card}>
            <Item
              label={t('page.addressDetail.add-to-whitelist')}
              value={
                <AppSwitch2024
                  onValueChange={setInWhitelist}
                  changeValueImmediately={false}
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
        </View>

        <Card
          style={[styles.card, styles.delete]}
          onPress={() => {
            removeAccount({
              account,
              onFinished: () => {
                onDelete?.();
                onCancel();
              },
            });
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
  subTitle: {
    paddingLeft: 28,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 20,
  },
  cardList: {
    gap: 20,
  },
  group: {
    gap: 8,
  },
  card: {
    marginHorizontal: 16,
    width: 'auto',
    borderRadius: 24,
  },
  delete: {
    borderColor: colors2024['red-default'],
    backgroundColor: colors2024['red-light-1'],
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
