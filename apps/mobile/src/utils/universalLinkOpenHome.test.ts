jest.mock('@/constant/universalLink', () => ({
  ALLOWED_UL_DOMAINS: ['https://go.rabby.io', 'rabbygo://go.rabby.io'],
  MOBILE_HOME_COMPAT_URL: 'https://go.rabby.io/fallback/mobile-home/index.html',
  UL_MATCH_PREFIX: '/mobile/',
}));

import { RootNames } from '@/constant/layout';
import {
  ALLOWED_UL_DOMAINS,
  MOBILE_HOME_COMPAT_URL,
  UL_MATCH_PREFIX,
} from '@/constant/universalLink';
import {
  canResetRootToHome,
  getRabbyGoTargetNestedRoute,
  isAllowedUniversalLinkUrl,
  isMobileHomeCompatTarget,
  makeOpenHomeRootState,
  normalizeRabbyGoTarget,
  parseOpenDappAction,
  parseOpenHomeAction,
  parseRabbyGoTargetAction,
} from './universalLinkOpenHome';

const allowedHttpDomain = ALLOWED_UL_DOMAINS.find(domain =>
  domain.startsWith('https://'),
)!;
const allowedAppDomain = ALLOWED_UL_DOMAINS.find(
  domain => !domain.startsWith('https://'),
)!;

describe('parseOpenHomeAction', () => {
  it('accepts the current environment path and campaign subpaths', () => {
    expect(
      parseOpenHomeAction(
        `${allowedHttpDomain}${UL_MATCH_PREFIX}money?_cmd=open-home&utm_source=test`,
      ),
    ).toEqual({ type: 'open-target', target: 'home' });
  });

  it.each([
    `${allowedHttpDomain}/wrong-path/?_cmd=open-home`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}money`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}money?_cmd=unknown`,
    `${allowedHttpDomain}.evil.test${UL_MATCH_PREFIX}money?_cmd=open-home`,
    'not a url',
  ])('rejects %s', link => {
    expect(parseOpenHomeAction(link)).toBeNull();
  });
});

describe('parseRabbyGoTargetAction', () => {
  it.each([
    ['home', 'home'],
    ['perps', 'perps'],
    ['swap', 'swap'],
    ['bridge', 'bridge'],
  ] as const)('maps target=%s to %s', (target, expected) => {
    expect(
      parseRabbyGoTargetAction(
        `${allowedHttpDomain}${UL_MATCH_PREFIX}money?target=${target}&utm_source=test`,
      ),
    ).toEqual({ type: 'open-target', target: expected });
  });

  it.each(['perps', 'swap', 'bridge'] as const)(
    'lets target=%s override the fallback _cmd=open-home',
    target => {
      expect(
        parseRabbyGoTargetAction(
          `${allowedAppDomain}${UL_MATCH_PREFIX}?target=${target}&_cmd=open-home`,
        ),
      ).toEqual({ type: 'open-target', target });
    },
  );

  it.each([
    `${allowedHttpDomain}${UL_MATCH_PREFIX}`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}?_cmd=open-home`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}?target=PERPS`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}?target=../../unlock`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}?target=unknown`,
  ])('falls back to home for a missing or invalid target in %s', link => {
    expect(parseRabbyGoTargetAction(link)).toEqual({
      type: 'open-target',
      target: 'home',
    });
  });

  it.each([
    `${allowedHttpDomain}/wrong-path/?target=perps`,
    `${allowedHttpDomain}.evil.test${UL_MATCH_PREFIX}?target=perps`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}?_cmd=open-dapp&target=perps`,
    `${allowedHttpDomain}${UL_MATCH_PREFIX}?_cmd=unknown&target=perps`,
    'not a url',
  ])('does not take over an unrelated or non-target command %s', link => {
    expect(parseRabbyGoTargetAction(link)).toBeNull();
  });
});

describe('normalizeRabbyGoTarget', () => {
  it.each([
    [null, 'home'],
    ['', 'home'],
    ['unknown', 'home'],
    ['perps', 'perps'],
    ['swap', 'swap'],
    ['bridge', 'bridge'],
  ] as const)('normalizes %p to %s', (target, expected) => {
    expect(normalizeRabbyGoTarget(target)).toBe(expected);
  });
});

describe('isAllowedUniversalLinkUrl', () => {
  it.each([
    `${allowedHttpDomain}${UL_MATCH_PREFIX}?_cmd=open-home`,
    `${allowedAppDomain}${UL_MATCH_PREFIX}?_cmd=open-home`,
  ])('accepts the exact configured origin for %s', link => {
    expect(isAllowedUniversalLinkUrl(new URL(link))).toBe(true);
  });

  it.each([
    'https://go.rabby.io.evil.test/mobile/?_cmd=open-dapp',
    'rabbygo://go.rabby.io.evil.test/mobile/?_cmd=open-dapp',
  ])('rejects an allowlist-prefix host for %s', link => {
    expect(isAllowedUniversalLinkUrl(new URL(link))).toBe(false);
  });
});

describe('isMobileHomeCompatTarget', () => {
  it('accepts only the exact HTTPS compatibility target', () => {
    expect(isMobileHomeCompatTarget(MOBILE_HOME_COMPAT_URL)).toBe(true);
  });

  it.each([
    'http://go.rabby.io/fallback/mobile-home/index.html',
    'https://go.rabby.io/fallback/mobile-home/',
    'https://go.rabby.io/fallback/mobile-home',
    'https://go.rabby.io/fallback/mobile-home/child',
    'https://go.rabby.io/fallback/mobile-home/index.html?utm_source=test',
    'https://go.rabby.io/fallback/mobile-home/index.html?',
    'https://go.rabby.io/fallback/mobile-home/index.html#section',
    'https://go.rabby.io/fallback/mobile-home/index.html#',
    'https://go.rabby.io.evil.test/fallback/mobile-home/index.html',
    'https://go.rabby.io@evil.test/fallback/mobile-home/index.html',
    'not a url',
  ])('rejects %s', target => {
    expect(isMobileHomeCompatTarget(target)).toBe(false);
  });
});

describe('parseOpenDappAction', () => {
  it('maps the compatibility target to open-home', () => {
    expect(parseOpenDappAction(MOBILE_HOME_COMPAT_URL)).toEqual({
      type: 'open-target',
      target: 'home',
    });
  });

  it('preserves every other open-dapp target', () => {
    const dappUrl = 'https://example.com/swap?chain=eth#confirm';
    expect(parseOpenDappAction(dappUrl)).toEqual({
      type: 'open-dapp',
      dappUrl,
    });
  });
});

describe('getRabbyGoTargetNestedRoute', () => {
  it('keeps home at the root', () => {
    expect(getRabbyGoTargetNestedRoute('home')).toBeNull();
  });

  it('maps perps to its transaction screen', () => {
    expect(getRabbyGoTargetNestedRoute('perps')).toEqual({
      screen: RootNames.Perps,
      params: {},
    });
  });

  it.each(['swap', 'bridge'] as const)(
    'maps %s to the matching SwapBridge tab',
    target => {
      expect(getRabbyGoTargetNestedRoute(target)).toEqual({
        screen: RootNames.SwapBridge,
        params: { activeTab: target },
      });
    },
  );
});

describe('canResetRootToHome', () => {
  it('allows an existing Home flow', () => {
    expect(
      canResetRootToHome({
        index: 0,
        routes: [{ name: RootNames.StackRoot }],
      }),
    ).toBe(true);
  });

  it('allows clearing a screen pushed on top of Home', () => {
    expect(
      canResetRootToHome({
        index: 1,
        routes: [
          { name: RootNames.StackRoot },
          { name: RootNames.StackSettings },
        ],
      }),
    ).toBe(true);
  });

  it.each([
    {
      index: 1,
      routes: [{ name: RootNames.StackRoot }, { name: RootNames.Unlock }],
    },
    {
      index: 0,
      routes: [{ name: RootNames.StackGetStarted }],
    },
    {
      index: 3,
      routes: [{ name: RootNames.StackRoot }],
    },
  ])('rejects protected or invalid root state %#', state => {
    expect(canResetRootToHome(state)).toBe(false);
  });
});

describe('makeOpenHomeRootState', () => {
  it('creates the canonical StackRoot to Home state', () => {
    expect(makeOpenHomeRootState()).toEqual({
      index: 0,
      routes: [
        {
          name: RootNames.StackRoot,
          params: { screen: RootNames.Home },
        },
      ],
    });
  });
});
