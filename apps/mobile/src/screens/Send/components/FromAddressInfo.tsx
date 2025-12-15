import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useWalletBrandLogo } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { formatAddressToShow } from '@/utils/address';
import { createGetStyles } from '@/utils/styles';
import { splitNumberByStep } from '@/utils/number';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { IS_ANDROID } from '@/core/native/utils';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

const getStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 4,
      padding: 12,
      backgroundColor: colors['blue-light-1'],

      width: '100%',
      height: 52,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    left: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      width: '100%',
    },
    nameAndAddr: {
      marginLeft: 8,
      flexShrink: 1,
      width: '100%',
      paddingRight: 8,
    },
    aliasName: {
      color: colors['blue-default'],
      fontSize: 14,
      fontWeight: '600',
    },
    addressText: {
      color: colors['blue-default'],
      fontSize: 12,
      fontWeight: '400',
      marginTop: 2,
    },

    rightCol: {
      flexShrink: 0,
    },
    priceText: {
      color: colors['blue-default'],
      fontSize: 13,
      fontWeight: IS_ANDROID ? 'normal' : '600',
    },
  };
});

export default function FromAddressInfo({
  style,
}: React.PropsWithChildren<RNViewProps>) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { balance } = useCurrentBalance({
    address: currentAccount?.address,
    AUTO_FETCH: true,
    fromScene: 'Unknown',
  });
  const { RcWalletIcon } = useWalletBrandLogo(currentAccount?.brandName);

  const usdValue = useMemo(() => {
    return `$${splitNumberByStep(balance?.toFixed(2) || 0)}`;
  }, [balance]);

  if (!RcWalletIcon) {
    console.warn('[FromAddressInfo] RcWalletIcon should not be null');
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <RcWalletIcon width={24} height={24} className="rounded-[24px]" />
        <View style={styles.nameAndAddr}>
          <Text style={styles.aliasName} numberOfLines={1}>
            {currentAccount?.aliasName || 'Unknown'}
          </Text>
          {/* TODO: format to lowercase */}
          <Text style={styles.addressText}>
            {formatAddressToShow(currentAccount?.address)}
          </Text>
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.priceText}>{usdValue}</Text>
      </View>
    </View>
  );
}
