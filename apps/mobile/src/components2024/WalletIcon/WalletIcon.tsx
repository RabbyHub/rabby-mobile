import { getWalletIcon } from '@/utils/walletInfo';
import { KEYRING_TYPE, WALLET_NAME } from '@rabby-wallet/keyring-utils';
import { StyleProp, ViewStyle } from 'react-native';

type EValue = `${KEYRING_TYPE}`;

export interface WalletIconProps {
  type: keyof typeof WALLET_NAME | EValue | string;
  isLight?: boolean;
  style?: StyleProp<ViewStyle>;
  width: number;
  height: number;
}

export const WalletIcon: React.FC<WalletIconProps> = ({
  type,
  isLight,
  style,
  width,
  height,
}) => {
  const Icon = getWalletIcon(type, isLight);

  return <Icon width={width} height={height} style={style} />;
};
