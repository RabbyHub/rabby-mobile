import {
  defaultTokenFilter,
  includeLpTokensFilter,
  isLpToken,
  lpTokenFilter,
} from './lpToken';

describe('lpToken utils', () => {
  it('defaultTokenFilter excludes suspicious, unverified, and protocol-backed non-core tokens', () => {
    expect(defaultTokenFilter({ is_verified: false })).toBe(false);
    expect(defaultTokenFilter({ is_suspicious: true })).toBe(false);
    expect(defaultTokenFilter({ is_core: false })).toBe(false);
    expect(defaultTokenFilter({ is_core: null, protocol_id: 'uni' })).toBe(
      false,
    );
    expect(defaultTokenFilter({ is_core: true })).toBe(true);
  });

  it('includeLpTokensFilter keeps lp tokens but still excludes suspicious and explicit non-core plain tokens', () => {
    expect(
      includeLpTokensFilter({
        is_core: false,
        protocol_id: 'uni',
      }),
    ).toBe(true);
    expect(
      includeLpTokensFilter({
        is_core: false,
        protocol_id: undefined,
      }),
    ).toBe(false);
  });

  it('isLpToken matches verified protocol-backed non-core tokens', () => {
    expect(
      isLpToken({
        is_verified: true,
        is_core: false,
        protocol_id: 'uni',
      }),
    ).toBe(true);
    expect(
      isLpToken({
        is_verified: false,
        is_core: false,
        protocol_id: 'uni',
      }),
    ).toBe(false);
  });

  it('lpTokenFilter switches between the lp-only and default modes', () => {
    const token = {
      is_verified: true,
      is_core: false,
      protocol_id: 'uni',
    };

    expect(lpTokenFilter(token, true)).toBe(true);
    expect(lpTokenFilter(token, false)).toBe(false);
    expect(lpTokenFilter(token, undefined)).toBe(false);
  });
});
