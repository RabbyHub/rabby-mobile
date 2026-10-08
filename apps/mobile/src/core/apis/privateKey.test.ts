import SimpleKeyring from '@rabby-wallet/eth-simple-keyring';

jest.mock('i18next', () => ({ t: (key: string) => key }));
jest.mock('@/core/serviceApi/keyring', () => ({ keyringServiceApi: {} }));
jest.mock('./keyring', () => ({ _setCurrentAccountFromKeyring: jest.fn() }));
jest.mock('./lock', () => ({ verifyPasswordOrUnlock: jest.fn() }));
jest.mock('./account', () => ({ accountEvents: {} }));
jest.mock('@/utils/walletUnlockGuard', () => ({
  withWalletUnlock: (operation: unknown) => operation,
}));

import { validateAndCleanPrivateKey } from './privateKey';

// Public scalar fixtures only. Native UI and Service imports are outside this
// validator unit contract; the external decoder remains real.
const PRIVATE_KEY = `${'0'.repeat(63)}1`;
const EXPECTED_ADDRESS = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
const INVALID_PRIVATE_KEY = 'background.error.invalidPrivateKey';

describe('validateAndCleanPrivateKey', () => {
  it.each([
    ['bare key', PRIVATE_KEY, PRIVATE_KEY],
    ['hex prefix', `0x${PRIVATE_KEY}`, PRIVATE_KEY],
    ['surrounding whitespace', ` \t${PRIVATE_KEY}\t `, PRIVATE_KEY],
    [
      'line breaks',
      `0x${PRIVATE_KEY.slice(0, 32)}\r\n${PRIVATE_KEY.slice(32)}`,
      PRIVATE_KEY,
    ],
    ['mixed hex case', `${'0'.repeat(62)}aB`, `${'0'.repeat(62)}aB`],
  ])(
    'preserves supported normalization for %s',
    async (_label, raw, cleaned) => {
      expect(validateAndCleanPrivateKey(raw)).toBe(cleaned);

      const keyring = new SimpleKeyring();
      await keyring.deserialize([cleaned]);
      expect(await keyring.getAccounts()).toHaveLength(1);
    },
  );

  it('derives the expected address with the real strict decoder', async () => {
    const keyring = new SimpleKeyring();
    await keyring.deserialize([validateAndCleanPrivateKey(`0x${PRIVATE_KEY}`)]);

    expect(await keyring.getAccounts()).toEqual([EXPECTED_ADDRESS]);
  });

  it.each([
    ['non-hex suffix', `${PRIVATE_KEY}G`],
    ['odd hex suffix', `${PRIVATE_KEY}0`],
    ['space followed by garbage', `${PRIVATE_KEY} G`],
    ['line break followed by garbage', `${PRIVATE_KEY}\nG`],
    ['non-hex character at the boundary', `${PRIVATE_KEY.slice(0, -1)}G`],
    [
      'internal whitespace',
      `${PRIVATE_KEY.slice(0, 32)} ${PRIVATE_KEY.slice(32)}`,
    ],
    ['too short', PRIVATE_KEY.slice(1)],
    ['too long', `${PRIVATE_KEY}00`],
    ['zero scalar', '0'.repeat(64)],
    [
      'scalar at the curve order',
      'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
    ],
    ['scalar above the curve order', 'f'.repeat(64)],
    ['empty input', ''],
  ])('rejects %s without accepting a truncated key', (_label, raw) => {
    expect(() => validateAndCleanPrivateKey(raw)).toThrow(INVALID_PRIVATE_KEY);
  });
});
