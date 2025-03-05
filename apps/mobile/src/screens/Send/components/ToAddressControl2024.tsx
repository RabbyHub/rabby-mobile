import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { WhiteListItemSwitch } from './WhiteListItem';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useWhitelist } from '@/hooks/whitelist';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';
import { contactService } from '@/core/services';

export default function ToAddressControl2024({
  style,
  address,
  brandName,
  cexDes,
}: React.PropsWithChildren<
  RNViewProps & {
    address: string;
    brandName?: string;
    cexDes?: Cex;
  }
>) {
  const { styles } = useTheme2024({ getStyle });
  const { accounts } = useAccounts();
  const { isAddrOnWhitelist } = useWhitelist();
  const account: KeyringAccountWithAlias | null = useMemo(() => {
    if (!address) {
      return null;
    }
    const currentExistAccount = accounts.find(
      item =>
        isSameAddress(item.address, address) && item.brandName === brandName,
    );
    if (currentExistAccount) {
      return currentExistAccount;
    }
    return {
      address,
      brandName: KEYRING_TYPE.WatchAddressKeyring,
      aliasName: contactService.getAliasByAddress(address)?.alias,
      type: KEYRING_TYPE.WatchAddressKeyring,
    };
  }, [accounts, address, brandName]);
  const { t } = useTranslation();

  if (!account) {
    return null;
  }

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>{t('page.sendToken.To')}</Text>
      </View>
      <WhiteListItemSwitch
        account={account}
        cexDes={cexDes}
        inWhiteList={isAddrOnWhitelist(account.address)}
      />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    control: {
      width: '100%',
      marginBottom: 16,
      gap: 12,
    },

    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
