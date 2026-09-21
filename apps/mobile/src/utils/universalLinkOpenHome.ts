import { RootNames } from '@/constant/layout';
import {
  ALLOWED_UL_DOMAINS,
  MOBILE_HOME_COMPAT_URL,
  UL_MATCH_PREFIX,
} from '@/constant/universalLink';
import { urlUtils } from '@rabby-wallet/base-utils';

type RootStateSnapshot = {
  index: number;
  routes: ReadonlyArray<{ name: string }>;
};

export type RabbyGoTarget = 'home' | 'perps' | 'swap' | 'bridge';

export function isAllowedUniversalLinkUrl(
  urlInfo: NonNullable<ReturnType<typeof urlUtils.safeParseURL>>,
) {
  const exactDomain = `${urlInfo.protocol}//${urlInfo.host}`;
  return ALLOWED_UL_DOMAINS.includes(exactDomain);
}

export function parseOpenHomeAction(appLink: string) {
  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return null;
  }

  if (!isAllowedUniversalLinkUrl(urlInfo)) {
    return null;
  }

  if (
    !urlInfo.pathname.startsWith(UL_MATCH_PREFIX) ||
    urlInfo.searchParams.get('_cmd') !== 'open-home'
  ) {
    return null;
  }

  return { type: 'open-target', target: 'home' } as const;
}

export function normalizeRabbyGoTarget(target: string | null): RabbyGoTarget {
  switch (target) {
    case 'perps':
    case 'swap':
    case 'bridge':
      return target;
    case 'home':
    default:
      return 'home';
  }
}

export function parseRabbyGoTargetAction(appLink: string) {
  const urlInfo = urlUtils.safeParseURL(appLink);
  const rabbyGoCmd = urlInfo?.searchParams.get('_cmd');
  if (
    !urlInfo ||
    !isAllowedUniversalLinkUrl(urlInfo) ||
    !urlInfo.pathname.startsWith(UL_MATCH_PREFIX) ||
    (rabbyGoCmd && rabbyGoCmd !== 'open-home')
  ) {
    return null;
  }

  return {
    type: 'open-target',
    target: normalizeRabbyGoTarget(urlInfo.searchParams.get('target')),
  } as const;
}

export function isMobileHomeCompatTarget(target: string) {
  const urlInfo = urlUtils.safeParseURL(target);
  const compatUrlInfo = urlUtils.safeParseURL(MOBILE_HOME_COMPAT_URL);
  if (!urlInfo || !compatUrlInfo) {
    return false;
  }

  return (
    urlInfo.protocol === 'https:' &&
    urlInfo.protocol === compatUrlInfo.protocol &&
    urlInfo.host === compatUrlInfo.host &&
    urlInfo.pathname === compatUrlInfo.pathname &&
    !urlInfo.search &&
    !urlInfo.hash &&
    !urlInfo.username &&
    !urlInfo.password &&
    urlInfo.href === compatUrlInfo.href
  );
}

export function parseOpenDappAction(dappUrl: string) {
  if (isMobileHomeCompatTarget(dappUrl)) {
    return { type: 'open-target', target: 'home' } as const;
  }

  return { type: 'open-dapp', dappUrl } as const;
}

export function getRabbyGoTargetNestedRoute(target: RabbyGoTarget) {
  switch (target) {
    case 'perps':
      return { screen: RootNames.Perps, params: {} } as const;
    case 'swap':
    case 'bridge':
      return {
        screen: RootNames.SwapBridge,
        params: { activeTab: target },
      } as const;
    case 'home':
      return null;
  }
}

export function canResetRootToHome(state: RootStateSnapshot) {
  const activeRoute = state.routes[state.index];

  return Boolean(
    activeRoute &&
      activeRoute.name !== RootNames.Unlock &&
      activeRoute.name !== RootNames.StackGetStarted &&
      state.routes.some(route => route.name === RootNames.StackRoot),
  );
}

export function makeOpenHomeRootState() {
  return {
    index: 0,
    routes: [
      {
        name: RootNames.StackRoot,
        params: { screen: RootNames.Home },
      },
    ],
  };
}
