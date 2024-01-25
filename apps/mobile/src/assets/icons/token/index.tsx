import { makeThemeIcon } from '@/components';

import { default as IconDefaultTokenLight } from './default.svg';
import { default as IconDefaultTokenDark } from './default-dark.svg';

export { IconDefaultTokenLight, IconDefaultTokenDark };

export { default as IconDefaultNft } from './nft.svg';

export const IconDefaultToken = makeThemeIcon(
  IconDefaultTokenLight,
  IconDefaultTokenDark,
);
