import {
  mergeWhitelistAddresses,
  normalizeWhitelistAddresses,
  normalizeWhitelistRecords,
  sortWhitelistRecords,
} from './whitelist';

describe('whitelist utils', () => {
  it('normalizes addresses and removes case-insensitive duplicates', () => {
    expect(
      normalizeWhitelistAddresses([
        '0x1111111111111111111111111111111111111111',
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x2222222222222222222222222222222222222222'.toUpperCase(),
        '',
      ]),
    ).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ]);
  });

  it('merges incoming whitelist addresses without reordering existing entries', () => {
    expect(
      mergeWhitelistAddresses(
        [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        [
          '0x2222222222222222222222222222222222222222'.toUpperCase(),
          '0x3333333333333333333333333333333333333333',
        ],
      ),
    ).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
    ]);
  });

  it('migrates legacy string arrays to whitelist records', () => {
    expect(
      normalizeWhitelistRecords([
        '0x1111111111111111111111111111111111111111',
        {
          address: '0x2222222222222222222222222222222222222222',
        },
        '0x2222222222222222222222222222222222222222',
      ]),
    ).toEqual([
      {
        address: '0x1111111111111111111111111111111111111111',
      },
      {
        address: '0x2222222222222222222222222222222222222222',
      },
    ]);
  });

  it('sorts by resolved time first and falls back to address alphabetically', () => {
    expect(
      sortWhitelistRecords(
        [
          {
            address: '0xcccccccccccccccccccccccccccccccccccccccc',
          },
          {
            address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          {
            address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        ],
        {
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': 200,
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': 100,
        },
      ).map(item => item.address),
    ).toEqual([
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xcccccccccccccccccccccccccccccccccccccccc',
    ]);
  });
});
