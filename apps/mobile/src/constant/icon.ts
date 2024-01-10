import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import IconWatchPurple from '@/assets/icons/wallet/watch-purple.svg';
import IconWatchWhite from '@/assets/icons/wallet/IconWatch-white.svg';
import { SvgProps } from 'react-native-svg';

export const KEYRING_ICONS = {
  [KEYRING_CLASS.WATCH]: IconWatchPurple,
} as const;

export type KeyringWithIcon = keyof typeof KEYRING_ICONS;

export const KEYRING_ICONS_WHITE: Record<
  KeyringWithIcon,
  React.FC<SvgProps>
> = {
  [KEYRING_CLASS.WATCH]: IconWatchWhite,
};

export const KEYRINGS_LOGOS = KEYRING_ICONS_WHITE;
