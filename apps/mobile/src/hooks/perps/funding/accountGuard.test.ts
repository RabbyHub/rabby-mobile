import type { Account } from '@/core/startupServices/preference';

import { isSamePerpsFundingAccount } from './accountGuard';

const account = (address: string, type: string) =>
  ({ address, type } as Account);

describe('isSamePerpsFundingAccount', () => {
  it('matches address case-insensitively but keeps signer type in identity', () => {
    expect(
      isSamePerpsFundingAccount(
        account('0x00000000000000000000000000000000000000aB', 'a'),
        account('0x00000000000000000000000000000000000000Ab', 'a'),
      ),
    ).toBe(true);
    expect(
      isSamePerpsFundingAccount(
        account('0x00000000000000000000000000000000000000aB', 'a'),
        account('0x00000000000000000000000000000000000000Ab', 'b'),
      ),
    ).toBe(false);
  });

  it('rejects missing accounts', () => {
    expect(isSamePerpsFundingAccount(null, account('0x1', 'a'))).toBe(false);
  });
});
