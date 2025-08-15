import { isSelfhostRegPkg } from './env';

const RABBY_GO_ENVS = {
  debug: { protocol: 'rabbygo-debug:', pathPrefix: '/mobile-debug/' },
  regression: {
    protocol: 'rabbygo-regression:',
    pathPrefix: '/mobile-regression/',
  },
  release: { protocol: 'rabbygo:', pathPrefix: '/mobile/' },
};

const UL_APP_PROTOCOL = __DEV__
  ? `${RABBY_GO_ENVS.debug.protocol}//`
  : isSelfhostRegPkg
  ? `${RABBY_GO_ENVS.regression.protocol}//`
  : `${RABBY_GO_ENVS.release.protocol}//`;

const UL_HTTP_DOMAIN = 'https://go.rabby.io';
const UL_APP_DOMAIN = `${UL_APP_PROTOCOL}go.rabby.io`;

export const ALLOWED_UL_DOMAINS = [UL_HTTP_DOMAIN, UL_APP_DOMAIN];

const MATCH_PREFIXES = {
  debug: `${RABBY_GO_ENVS.debug.pathPrefix}`,
  regression: `${RABBY_GO_ENVS.regression.pathPrefix}`,
  release: `${RABBY_GO_ENVS.release.pathPrefix}`,
} as const;
export const UL_MATCH_PREFIX = __DEV__
  ? MATCH_PREFIXES.debug
  : isSelfhostRegPkg
  ? MATCH_PREFIXES.regression
  : MATCH_PREFIXES.release;
