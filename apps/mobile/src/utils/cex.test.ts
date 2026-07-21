import type {
  AddrDescResponse,
  Cex,
  ProjectItem,
} from '@rabby-wallet/rabby-api/dist/types';

import {
  findSupportedExchange,
  normalizeAddressDescCex,
  normalizeCex,
  resolveSupportedDepositExchange,
} from './cex';

const bitget: ProjectItem = {
  id: 'bitget',
  name: 'Bitget',
  logo_url: 'https://example.com/bitget.png',
  site_url: 'https://www.bitget.com',
};

const makeCex = (overrides: Partial<Cex> = {}): Cex => ({
  id: 'bitget',
  name: 'stale name',
  logo_url: 'https://example.com/stale.png',
  is_deposit: true,
  ...overrides,
});

const makeDesc = (cex?: Cex): AddrDescResponse['desc'] => ({
  cex,
  usd_value: 0,
  born_at: 0,
  is_danger: false,
  is_spam: false,
  is_scam: false,
  name: '',
  id: '',
});

describe('cex utils', () => {
  it('finds a supported exchange case-insensitively', () => {
    expect(findSupportedExchange([bitget], 'BITGET')).toBe(bitget);
  });

  it('accepts only deposit addresses from the supported list', () => {
    expect(resolveSupportedDepositExchange(makeCex(), [bitget])).toBe(bitget);
    expect(
      resolveSupportedDepositExchange(makeCex({ is_deposit: false }), [bitget]),
    ).toBeUndefined();
    expect(
      resolveSupportedDepositExchange(makeCex({ id: 'crypto' }), [bitget]),
    ).toBeUndefined();
  });

  it('uses canonical metadata from the supported list', () => {
    expect(normalizeCex(makeCex(), [bitget])).toEqual({
      id: 'bitget',
      name: 'Bitget',
      logo_url: 'https://example.com/bitget.png',
      is_deposit: true,
    });
  });

  it('normalizes display data without mutating the raw description', () => {
    const unsupportedCex = makeCex({ id: 'crypto', name: 'Crypto.com' });
    const rawDesc = makeDesc(unsupportedCex);

    const normalized = normalizeAddressDescCex(rawDesc, [bitget]);

    expect(normalized?.cex).toBeUndefined();
    expect(rawDesc.cex).toBe(unsupportedCex);
  });
});
