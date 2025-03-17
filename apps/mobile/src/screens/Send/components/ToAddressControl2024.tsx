import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { WhiteListItemSwitch } from './WhiteListItem';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useWhitelist } from '@/hooks/whitelist';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';
import { useWhiteListAddress } from '../hooks/useWhiteListAddress';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { ellipsisAddress } from '@/utils/address';
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
  const { isAddrOnWhitelist } = useWhitelist();
  const { findAccount } = useWhiteListAddress(true);
  const [currentAccount, setCurrentAccount] = useState<KeyringAccountWithAlias>(
    {
      address,
      brandName: brandName || KEYRING_CLASS.WATCH,
      aliasName:
        contactService.getAliasByAddress(address)?.alias ||
        ellipsisAddress(address),
      balance: 0,
      type: KEYRING_CLASS.WATCH,
    },
  );

  useEffect(() => {
    if (address) {
      findAccount(address, brandName).then(res => {
        if (res.account) {
          setCurrentAccount(res.account);
        }
      });
    }
  }, [address, brandName, findAccount]);
  const { t } = useTranslation();

  if (!currentAccount) {
    return null;
  }

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>{t('page.sendToken.To')}</Text>
      </View>
      <WhiteListItemSwitch
        account={currentAccount}
        cexDes={cexDes}
        inWhiteList={isAddrOnWhitelist(currentAccount.address)}
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
