import { IS_ANDROID } from '@/core/native/utils';
import { isNonPublicProductionEnv } from './';

const RABBY_GO_ENVS = {
  debug: {
    protocol: 'rabbygo-debug:',
    hostname: IS_ANDROID ? 'go-debug.rabby.io' : 'go.rabby.io',
    pathPrefix: '/mobile-debug/',
  },
  regression: {
    protocol: 'rabbygo-regression:',
    hostname: IS_ANDROID ? 'go-regression.rabby.io' : 'go.rabby.io',
    pathPrefix: '/mobile-regression/',
  },
  release: {
    protocol: 'rabbygo:',
    hostname: 'go.rabby.io',
    pathPrefix: '/mobile/',
  },
};

const UL_CONFIG = __DEV__
  ? RABBY_GO_ENVS.debug
  : isNonPublicProductionEnv
  ? RABBY_GO_ENVS.regression
  : RABBY_GO_ENVS.release;

export const UL_PROTOCOL = UL_CONFIG.protocol;
export const UL_HOSTNAME = UL_CONFIG.hostname;
export const UL_PATH_PREFIX = UL_CONFIG.pathPrefix;

const UL_HTTP_DOMAIN = `https://${UL_HOSTNAME}`;
const UL_HTTP_DOMAIN_PROD = `https://${RABBY_GO_ENVS.release.hostname}`;
const UL_APP_DOMAIN = `${UL_PROTOCOL}//${UL_HOSTNAME}`;
const UL_APP_DOMAIN_PROD = `${UL_PROTOCOL}//${RABBY_GO_ENVS.release.hostname}`;

export const ALLOWED_UL_DOMAINS = [
  ...new Set(
    [
      UL_HTTP_DOMAIN,
      UL_APP_DOMAIN,
      UL_HTTP_DOMAIN_PROD,
      UL_APP_DOMAIN_PROD,
    ].filter(Boolean),
  ),
];

const MATCH_PREFIXES = {
  debug: `${RABBY_GO_ENVS.debug.pathPrefix}`,
  regression: `${RABBY_GO_ENVS.regression.pathPrefix}`,
  release: `${RABBY_GO_ENVS.release.pathPrefix}`,
} as const;
export const UL_MATCH_PREFIX = __DEV__
  ? MATCH_PREFIXES.debug
  : isNonPublicProductionEnv
  ? MATCH_PREFIXES.regression
  : MATCH_PREFIXES.release;
