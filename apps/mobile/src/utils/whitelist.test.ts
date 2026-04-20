import {
  addWhitelistRecord,
  mergeWhitelistAddresses,
  normalizeWhitelistAddresses,
  normalizeWhitelistRecords,
  syncWhitelistRecords,
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

  it('records addedAt when appending a new whitelist address', () => {
    expect(
      addWhitelistRecord(
        [
          {
            address: '0x1111111111111111111111111111111111111111',
          },
        ],
        '0x2222222222222222222222222222222222222222',
        123,
      ),
    ).toEqual([
      {
        address: '0x1111111111111111111111111111111111111111',
      },
      {
        address: '0x2222222222222222222222222222222222222222',
        addedAt: 123,
      },
    ]);
  });

  it('preserves existing addedAt and stamps newly added records during sync', () => {
    expect(
      syncWhitelistRecords(
        [
          {
            address: '0x1111111111111111111111111111111111111111',
            addedAt: 111,
          },
          {
            address: '0x3333333333333333333333333333333333333333',
            addedAt: 333,
          },
        ],
        [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        999,
      ),
    ).toEqual([
      {
        address: '0x1111111111111111111111111111111111111111',
        addedAt: 111,
      },
      {
        address: '0x2222222222222222222222222222222222222222',
        addedAt: 999,
      },
    ]);
  });
});
