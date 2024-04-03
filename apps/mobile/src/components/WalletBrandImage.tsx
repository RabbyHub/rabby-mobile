import { useWalletBrandLogo } from '@/hooks/account';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { DisplayedKeyring } from '@rabby-wallet/keyring-utils';

export function WalletBrandImage({
  brandType,
  size = 24,
}: RNViewProps & {
  brandType?: DisplayedKeyring['type'];
  size?: number;
}) {
  const { styles } = useThemeStyles(getStyles);

  const { RcWalletIcon } = useWalletBrandLogo(brandType);

  return (
    <RcWalletIcon
      width={size}
      height={size}
      style={[styles.brandLogo, { width: size, height: size }]}
    />
  );
}

const getStyles = createGetStyles(colors => {
  return {
    brandLogo: {},
  };
});
