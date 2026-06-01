import { resolveDappAccount } from './dappAccount';

const account = (address: string, type: string, aliasName?: string) =>
  ({
    address,
    type,
    aliasName,
  } as any);

describe('resolveDappAccount', () => {
  const simple = account(
    '0x1111111111111111111111111111111111111111',
    'SimpleKeyring',
    'Simple',
  );
  const hardware = account(
    '0x2222222222222222222222222222222222222222',
    'HardwareKeyring',
    'Hardware',
  );
  const fallback = account(
    '0x3333333333333333333333333333333333333333',
    'WatchAddressKeyring',
    'Fallback',
  );

  it('prefers the dapp current account when address and type both match', () => {
    expect(
      resolveDappAccount({
        dappInfo: {
          currentAccount: {
            address: simple.address.toUpperCase(),
            type: simple.type,
          },
        },
        accounts: [hardware, simple],
        transactions: [
          {
            address: hardware.address,
            createdAt: 100,
            keyringType: hardware.type,
          },
        ],
        fallbackAccount: fallback,
      }),
    ).toBe(simple);
  });

  it('falls back to the most recent transaction account and preserves transaction order', () => {
    const transactions = [
      {
        address: simple.address,
        createdAt: 1,
        keyringType: simple.type,
      },
      {
        address: hardware.address,
        createdAt: 2,
        keyringType: hardware.type,
      },
    ];

    expect(
      resolveDappAccount({
        dappInfo: {
          currentAccount: {
            address: fallback.address,
            type: fallback.type,
          },
        },
        accounts: [simple, hardware],
        transactions,
      }),
    ).toBe(hardware);
    expect(transactions.map(tx => tx.address)).toEqual([
      simple.address,
      hardware.address,
    ]);
  });

  it('allows transaction account matching by address when keyring type is absent', () => {
    expect(
      resolveDappAccount({
        accounts: [simple],
        transactions: [
          {
            address: simple.address.toUpperCase(),
            createdAt: 1,
          },
        ],
      }),
    ).toBe(simple);
  });

  it('falls back to the first account and then the explicit fallback account', () => {
    expect(
      resolveDappAccount({
        accounts: [simple, hardware],
        transactions: [],
        fallbackAccount: fallback,
      }),
    ).toBe(simple);

    expect(
      resolveDappAccount({
        accounts: [],
        transactions: [],
        fallbackAccount: fallback,
      }),
    ).toBe(fallback);
  });
});
