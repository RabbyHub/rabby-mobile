import { isSelfhostRegPkg } from './env';

export const UL_DOMAIN = 'https://go.rabby.io';

const MATCH_PREFIXES = {
  debug: '/mobile-debug/',
  regression: '/mobile-regression/',
  release: '/mobile/',
} as const;
export const UL_MATCH_PREFIX = __DEV__
  ? MATCH_PREFIXES.debug
  : isSelfhostRegPkg
  ? MATCH_PREFIXES.regression
  : MATCH_PREFIXES.release;
