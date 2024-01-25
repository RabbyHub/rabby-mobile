import { default as IconNFTLight } from './default-nft.svg';
import { default as IconNFTDark } from './dark-nft.svg';
export { IconNFTLight, IconNFTDark };

export { default as IconNumberNFT } from './numbernft.svg';
import { default as IconPlayLight } from './playIcon.svg';
import { default as IconPlayDark } from './playIcon-dark.svg';
import { makeThemeIcon } from '@/hooks/makeThemeIcon';
export { IconPlayLight, IconPlayDark };

export const IconDefaultNFT = makeThemeIcon(IconNFTLight, IconNFTDark);
export const IconPlay = makeThemeIcon(IconPlayLight, IconPlayDark);
