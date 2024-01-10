import clsx from 'clsx';
import React from 'react';
import { WalletConnectAccount } from './WalletConnectAccount';
import { Chain } from '@debank/common';
import { useTranslation } from 'react-i18next';
import { CommonAccount } from './CommonAccount';
import { Account } from '@/core/services/preference';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { splitNumberByStep } from '@/utils/number';
import { contactService } from '@/core/services';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KEYRING_ICONS, KEYRING_ICONS_WHITE } from '@/constant/icon';
import { useGetAppThemeMode, useThemeColors } from '@/hooks/theme';
import { Tip } from '@/components/Tip';
import { StyleSheet, Text, View } from 'react-native';
import { AddressViewer } from '@/components/AddressViewer';
import { AppColorsVariants } from '@/constant/theme';

export interface Props {
  account: Account;
  isTestnet?: boolean;
  chain?: Chain;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors['neutral-card-3'],
      borderRadius: 8,
      padding: 12,
      gap: 12,
    },
    addressInfoContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 18,
    },
    addressContainer: {
      gap: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    nickname: {
      maxWidth: 170,
      overflow: 'hidden',
      fontSize: 15,
      lineHeight: 20,
      color: colors['neutral-body'],
    },
    addressViewer: {
      fontSize: 13,
      color: colors['neutral-foot'],
    },
    balance: {
      fontSize: 13,
      color: colors['neutral-foot'],
      fontWeight: '500',
    },
  });

export const AccountInfo: React.FC<Props> = ({
  account,
  chain,
  isTestnet = false,
}) => {
  const [nickname, setNickname] = React.useState<string>();
  const { balance } = useCurrentBalance(account?.address);
  const displayBalance = splitNumberByStep((balance || 0).toFixed(2));
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const init = async () => {
    const result = await contactService.getAliasByAddress(
      account?.address?.toLowerCase() || '',
    );
    if (result) {
      setNickname(result.alias);
    }
  };

  React.useEffect(() => {
    init();
  }, [account]);

  const binaryTheme = useGetAppThemeMode();
  const isDarkTheme = binaryTheme === 'dark';

  return (
    <View style={styles.wrapper}>
      <View style={styles.addressInfoContainer}>
        <View style={styles.addressContainer}>
          <Tip content={nickname}>
            <Text style={styles.nickname}>{nickname}</Text>
          </Tip>
          <AddressViewer showArrow={false} address={account.address} />
        </View>
        {isTestnet ? null : (
          <Text style={styles.balance}>${displayBalance}</Text>
        )}
      </View>
      {account?.type === KEYRING_CLASS.WALLETCONNECT && (
        <WalletConnectAccount chain={chain} account={account} />
      )}
      {account?.type === KEYRING_CLASS.WATCH && (
        <CommonAccount
          icon={
            (isDarkTheme ? KEYRING_ICONS_WHITE : KEYRING_ICONS)[
              KEYRING_CLASS.WATCH
            ]
          }
          tip={t('page.signFooterBar.addressTip.watchAddress')}
        />
      )}
    </View>
  );
};
