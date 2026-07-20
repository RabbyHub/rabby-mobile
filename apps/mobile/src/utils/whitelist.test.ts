import {
  addWhitelistRecord,
  mergeWhitelistAddresses,
  normalizeWhitelistAddresses,
  normalizeWhitelistRecords,
  reorderWhitelistRecords,
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

  it('reorders existing records case-insensitively and preserves metadata', () => {
    const first = {
      address: '0x1111111111111111111111111111111111111111',
      addedAt: 111,
    };
    const second = {
      address: '0x2222222222222222222222222222222222222222',
      addedAt: 222,
    };
    const reordered = reorderWhitelistRecords(
      [first, second],
      [
        '0x2222222222222222222222222222222222222222'.toUpperCase(),
        '0x1111111111111111111111111111111111111111',
      ],
    );

    expect(reordered).toEqual([second, first]);
    expect(reordered[0]).toBe(second);
    expect(reordered[1]).toBe(first);
  });

  it.each([
    {
      name: 'a missing address',
      next: ['0x1111111111111111111111111111111111111111'],
    },
    {
      name: 'a foreign address',
      next: [
        '0x1111111111111111111111111111111111111111',
        '0x3333333333333333333333333333333333333333',
      ],
    },
    {
      name: 'a duplicate address',
      next: [
        '0x1111111111111111111111111111111111111111',
        '0x1111111111111111111111111111111111111111'.toUpperCase(),
      ],
    },
    {
      name: 'an empty address',
      next: ['0x1111111111111111111111111111111111111111', ''],
    },
    {
      name: 'a non-string address',
      next: [
        '0x1111111111111111111111111111111111111111',
        123,
      ] as unknown as string[],
    },
  ])('rejects an invalid whitelist order containing $name', ({ next }) => {
    const current = [
      {
        address: '0x1111111111111111111111111111111111111111',
        addedAt: 111,
      },
      {
        address: '0x2222222222222222222222222222222222222222',
        addedAt: 222,
      },
    ];

    expect(() => reorderWhitelistRecords(current, next)).toThrow(
      'Invalid whitelist order',
    );
    expect(current.map(record => record.address)).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ]);
  });

  it('rejects duplicate current records instead of silently normalizing them', () => {
    const current = [
      '0x1111111111111111111111111111111111111111',
      '0x1111111111111111111111111111111111111111'.toUpperCase(),
    ];

    expect(() =>
      reorderWhitelistRecords(current, [
        '0x1111111111111111111111111111111111111111',
      ]),
    ).toThrow('Invalid whitelist order');
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
