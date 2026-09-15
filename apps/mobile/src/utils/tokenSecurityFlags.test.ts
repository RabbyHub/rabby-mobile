import { unlabeledCustomTokenSecurityFlags } from './tokenSecurityFlags';

describe('unlabeledCustomTokenSecurityFlags', () => {
  it('does not treat unlabeled custom tokens as explicit scam', () => {
    expect(unlabeledCustomTokenSecurityFlags.is_verified).toBeNull();
    expect(unlabeledCustomTokenSecurityFlags.is_suspicious).toBe(false);
    expect(unlabeledCustomTokenSecurityFlags.is_scam).toBe(false);
  });
});
