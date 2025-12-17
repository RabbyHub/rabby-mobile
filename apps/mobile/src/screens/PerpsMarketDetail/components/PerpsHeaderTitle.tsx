import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { AssetAvatar } from '@/components';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTranslation } from 'react-i18next';
// caret-down-cc.svg
import { default as RcCaretDownCircleCC } from '@/components/AccountSwitcher/icons/caret-down-circle.svg';
import { default as RcCaretDownCircleDarkCC } from '@/components/AccountSwitcher/icons/caret-down-circle-dark.svg';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { ellipsisAddress } from '@/utils/address';
import { apiContact } from '@/core/apis';
import { Account } from '@/core/services/preference';

export const PerpsHeaderTitle: React.FC<{
  market?: MarketData;
  account?: Account | null;
  onSelectCoin: () => void;
  popupIsOpen: boolean;
}> = ({ market, account, onSelectCoin, popupIsOpen }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const IconCom = isLight ? RcCaretDownCircleCC : RcCaretDownCircleDarkCC;

  const alias = useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  if (!market) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onSelectCoin} style={styles.touchable}>
        <AssetAvatar logo={market.logoUrl} logoStyle={styles.icon} size={24} />
        <Text style={styles.text}>{market.name} - USD</Text>
        <IconCom
          width={20}
          height={20}
          style={[styles.addressCaretIcon, popupIsOpen && styles.reverseCaret]}
          color={colors2024['neutral-bg-4']}
        />
      </TouchableOpacity>
      {account ? (
        <View style={styles.addressContainer}>
          <WalletIcon
            style={styles.walletIcon}
            width={18}
            height={18}
            type={account.brandName}
            address={account.address}
          />
          <Text style={styles.address}>
            {alias || ellipsisAddress(account?.address)}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  addressContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletIcon: {},
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
  addressCaretIcon: {
    // marginLeft: 4,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 1000,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },
}));
