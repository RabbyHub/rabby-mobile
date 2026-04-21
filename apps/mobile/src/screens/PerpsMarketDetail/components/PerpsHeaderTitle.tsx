import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { AssetAvatar } from '@/components';
import { default as RcCaretDownCircleCC } from '@/components/AccountSwitcher/icons/caret-down-circle.svg';
import { default as RcCaretDownCircleDarkCC } from '@/components/AccountSwitcher/icons/caret-down-circle-dark.svg';
import { apiContact } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { formatPerpsCoin } from '@/utils/perps';
import { Text } from '@/components/Typography';
import { HeaderBackPressable } from '@/hooks/navigation';
import { PerpsHeaderRight } from './PerpsHeaderRight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PerpsHeaderTitle: React.FC<{
  account?: Account | null;
  onSelectCoin: () => void;
  popupIsOpen: boolean;
  coin: string;
  displayName: string;
  quoteCoin?: string;
  logoUrl?: string;
}> = ({
  logoUrl,
  coin,
  displayName,
  quoteCoin = 'USDC',
  account,
  onSelectCoin,
  popupIsOpen,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { top } = useSafeAreaInsets();
  const IconCom = isLight ? RcCaretDownCircleCC : RcCaretDownCircleDarkCC;

  const alias = useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  return (
    <View style={[styles.headerOuter, { marginTop: top }]}>
      <View style={styles.headerInner}>
        <View style={styles.headerLeft}>
          <HeaderBackPressable />
          <AssetAvatar logo={logoUrl} logoStyle={styles.icon} size={24} />
          <TouchableOpacity onPress={onSelectCoin} style={styles.touchable}>
            <Text style={styles.text}>{displayName}</Text>
            <Text style={styles.quote}>/{quoteCoin}</Text>
            <IconCom
              width={20}
              height={20}
              style={[
                styles.addressCaretIcon,
                popupIsOpen && styles.reverseCaret,
              ]}
              color={colors2024['neutral-bg-4']}
            />
          </TouchableOpacity>
        </View>
        <PerpsHeaderRight marketName={coin} />
      </View>
    </View>
  );
};

const HEADER_HEIGHT = 58;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap: 4,
    justifyContent: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  headerOuter: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 12,
    paddingRight: 16,
    paddingVertical: 10,
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
    backgroundColor: 'white',
  },
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    justifyContent: 'center',
  },
  text: {
    marginLeft: 4,
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  quote: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-info'],
    marginRight: 4,
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },
}));
