jest.mock('@rabby-wallet/keyring-utils/dist/types', () => ({
  KEYRING_CLASS: {
    PRIVATE_KEY: 'PRIVATE_KEY',
    MNEMONIC: 'MNEMONIC',
    HARDWARE: {
      LEDGER: 'LEDGER',
      ONEKEY: 'ONEKEY',
      KEYSTONE: 'KEYSTONE',
    },
    GNOSIS: 'GNOSIS',
  },
}));

import { getBrandColors } from './brand';

describe('getBrandColors', () => {
  it('returns cex colors in light mode', () => {
    expect(getBrandColors('binance', true)).toEqual({
      brandColor: 'rgba(255, 170, 0, 1)',
      brandBg: 'rgba(255, 207, 60, 0.2)',
    });
  });

  it('returns account type colors when there is no cex mapping', () => {
    expect(getBrandColors('LEDGER', true)).toEqual({
      brandColor: 'rgba(0, 0, 0, 1)',
      brandBg: 'rgba(0, 0, 0, 0.2)',
    });
    expect(getBrandColors('LEDGER', false)).toEqual({
      brandColor: 'rgba(255, 255, 255, 1)',
      brandBg: 'rgba(255, 255, 255, 0.2)',
    });
  });

  it('falls back to default colors when the brand is unknown', () => {
    expect(getBrandColors('unknown', true)).toEqual({
      brandColor: 'rgba(0, 0, 0, 1)',
      brandBg: 'rgba(0, 0, 0, 0.2)',
    });
    expect(getBrandColors('unknown', false)).toEqual({
      brandColor: 'rgba(255, 255, 255, 1)',
      brandBg: 'rgba(255, 255, 255, 0.2)',
    });
  });
});
