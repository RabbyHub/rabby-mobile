import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useCurrentAccount, useWalletBrandLogo } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { formatAddressToShow } from '@/utils/address';
import { createGetStyles } from '@/utils/styles';
import { splitNumberByStep } from '@/utils/number';

const getStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 4,
      padding: 12,
      backgroundColor: colors['neutral-card2'],

      width: '100%',
      height: 52,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    left: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    brandName: {
      color: colors['blue-default'],
      fontSize: 14,
      fontWeight: 'bold',
    },
    addressText: {
      color: colors['blue-default'],
      fontSize: 12,
      fontWeight: 'normal',
    },

    priceText: {
      color: colors['blue-default'],
      fontSize: 12,
      fontWeight: 'normal',
    },
  };
});

export default function FromAddressInfo({
  style,
}: React.PropsWithChildren<RNViewProps>) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { currentAccount } = useCurrentAccount();
  const { RcWalletIcon } = useWalletBrandLogo(currentAccount?.brandName);

  const usdValue = useMemo(() => {
    return `$${splitNumberByStep(currentAccount?.balance?.toFixed(2) || 0)}`;
  }, [currentAccount]);

  if (!RcWalletIcon) {
    console.warn('[FromAddressInfo] RcWalletIcon should not be null');
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <RcWalletIcon width={24} height={24} className="rounded-[24px]" />
        <View className="ml-[8]">
          <Text style={styles.brandName}>
            {currentAccount?.brandName || 'Unknown'}
          </Text>
          {/* TODO: format to lowercase */}
          <Text className="mt-[2]" style={styles.addressText}>
            {formatAddressToShow(currentAccount?.address)}
          </Text>
        </View>
      </View>

      <View>
        <Text style={styles.priceText}>{usdValue}</Text>
      </View>
    </View>
  );
}
