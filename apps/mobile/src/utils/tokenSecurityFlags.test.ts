import {
  mergeTokenSecurityFields,
  unlabeledCustomTokenSecurityFlags,
} from './tokenSecurityFlags';

describe('unlabeledCustomTokenSecurityFlags', () => {
  it('does not treat unlabeled custom tokens as explicit scam', () => {
    expect(unlabeledCustomTokenSecurityFlags.is_verified).toBeNull();
    expect(unlabeledCustomTokenSecurityFlags.is_suspicious).toBe(false);
    expect(unlabeledCustomTokenSecurityFlags.is_scam).toBe(false);
  });
});

describe('mergeTokenSecurityFields', () => {
  it('keeps API null over a stale route is_verified false', () => {
    expect(
      mergeTokenSecurityFields(
        {
          is_verified: false,
          is_suspicious: true,
          is_scam: true,
          is_core: false,
        },
        {
          is_verified: null,
          is_suspicious: null,
          is_scam: false,
          is_core: null,
        },
      ),
    ).toEqual({
      is_verified: null,
      is_suspicious: null,
      is_scam: false,
      is_core: null,
    });
  });

  it('falls back to the route token only when the API field is missing', () => {
    expect(
      mergeTokenSecurityFields(
        {
          is_verified: false,
          is_suspicious: true,
          is_scam: true,
          is_core: false,
        },
        {},
      ),
    ).toEqual({
      is_verified: false,
      is_suspicious: true,
      is_scam: true,
      is_core: false,
    });
  });

  it('keeps an explicit API false scam label', () => {
    expect(
      mergeTokenSecurityFields({ is_verified: null }, { is_verified: false })
        .is_verified,
    ).toBe(false);
  });
});
