import React from 'react';
import { Chain } from '@/constant/chains';
import { useTranslation } from 'react-i18next';
import { Account } from '@/core/services/preference';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { splitNumberByStep } from '@/utils/number';
import { contactService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { Tip } from '@/components/Tip';
import { StyleSheet, Text, View } from 'react-native';
import { AddressViewer } from '@/components/AddressViewer';
import { AppColorsVariants } from '@/constant/theme';
import { getWalletIcon } from '@/utils/walletInfo';

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
      paddingHorizontal: 16,
      gap: 12,
    },
    addressInfoContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 18,
      gap: 16,
    },
    addressContainer: {
      gap: 6,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
    },
    nickname: {
      overflow: 'hidden',
      fontSize: 15,
      lineHeight: 20,
      color: colors['neutral-body'],
      maxWidth: 130,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const BrandIcon = getWalletIcon(account?.brandName);

  return (
    <View style={styles.wrapper}>
      <View style={styles.addressInfoContainer}>
        <View style={styles.addressContainer}>
          <BrandIcon width={20} height={20} />
          <Tip content={nickname}>
            <Text numberOfLines={1} style={styles.nickname}>
              {nickname}
            </Text>
          </Tip>
          <AddressViewer showArrow={false} address={account.address} />
        </View>
        {isTestnet ? null : (
          <Text style={styles.balance}>${displayBalance}</Text>
        )}
      </View>
    </View>
  );
};
