import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { RcIconCopyCC } from '@/assets/icons/common';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { Text } from '@/components';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressItem } from '../AddressItem/AddressItem';
import { useAliasNameEditModal } from '../AliasNameEditModal/useAliasNameEditModal';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';
import { trigger } from 'react-native-haptic-feedback';

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
}

export const AddressInfoItem: React.FC<AddressInfoProps> = props => {
  const { account } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const editAliasName = useAliasNameEditModal();

  const onCopy = useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    Clipboard.setString(account.address);
    toastCopyAddressSuccess(account.address);
  }, [account?.address]);

  return (
    <AddressItem account={account}>
      {({ WalletIcon, WalletName }) => (
        <View style={styles.addressInfoView}>
          <WalletIcon width={66} height={66} borderRadius={16} />
          <View style={styles.addressInfoRight}>
            <TouchableOpacity
              style={styles.nameButton}
              onPress={() => {
                editAliasName.show(account);
              }}>
              <WalletName style={styles.addressName} />
              <EditSVG
                color={colors2024['neutral-body']}
                width={20}
                height={20}
                style={styles.editButton}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addressButton} onPress={onCopy}>
              <Text style={styles.addressText}>
                {account.address.toLowerCase()}
                <View style={styles.textIconWrapper}>
                  <RcIconCopyCC
                    style={styles.textCopyIcon}
                    color={colors2024['neutral-secondary']}
                    height={17}
                    width={17}
                  />
                </View>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </AddressItem>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  addressInfoView: {
    padding: 20,
    paddingTop: 13,
    gap: 12,
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  addressInfoRight: {
    gap: 4,
    flex: 1,
  },
  addressName: {
    color: colors2024['neutral-body'],
    fontSize: 18,
    paddingRight: 20,
  },
  addressButton: {
    flexDirection: 'row',
  },
  addressText: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  textIconWrapper: {
    width: 18,
    height: 17,
    position: 'relative',
  },
  textCopyIcon: {
    position: 'absolute',
    left: 4,
    top: 1,
  },
  nameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    marginLeft: -20,
  },
}));
