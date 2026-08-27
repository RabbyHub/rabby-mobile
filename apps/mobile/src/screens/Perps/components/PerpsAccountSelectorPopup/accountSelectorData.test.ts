import type { Account } from '@/core/startupServices/preference';
import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';
import PQueue from 'p-queue';

import {
  buildPerpsAccountSelectorData,
  enqueuePortfolioFetches,
  type PerpsAccountInfoByAddress,
} from './accountSelectorData';

const account = (address: string, aliasName: string) =>
  ({
    address,
    aliasName,
    brandName: 'Rabby',
    type: 'HD Key Tree',
  } as Account);

const info = ({
  positionCount = 0,
  withdrawable = '0',
}: {
  positionCount?: number;
  withdrawable?: string;
}) =>
  ({
    assetPositions: Array.from({ length: positionCount }, () => ({})),
    withdrawable,
  } as ClearinghouseState);

describe('buildPerpsAccountSelectorData', () => {
  it('rebinds cached Perps info to the latest account objects', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const cachedInfo: PerpsAccountInfoByAddress = {
      [address.toLowerCase()]: info({ positionCount: 1 }),
    };
    const latestAccount = account(address, 'Latest alias');

    const [item] = buildPerpsAccountSelectorData([latestAccount], cachedInfo);

    expect(item.account).toBe(latestAccount);
    expect(item.account.aliasName).toBe('Latest alias');
    expect(item.info).toBe(cachedInfo[address.toLowerCase()]);
  });

  it('preserves the existing position and withdrawable ordering', () => {
    const positionAddress = '0x1111111111111111111111111111111111111111';
    const balanceAddress = '0x2222222222222222222222222222222222222222';
    const emptyAddress = '0x3333333333333333333333333333333333333333';
    const cachedInfo: PerpsAccountInfoByAddress = {
      [positionAddress]: info({ positionCount: 1 }),
      [balanceAddress]: info({ withdrawable: '20' }),
    };

    const result = buildPerpsAccountSelectorData(
      [
        account(emptyAddress, 'Empty'),
        account(balanceAddress, 'Balance'),
        account(positionAddress, 'Position'),
      ],
      cachedInfo,
    );

    expect(result.map(item => item.account.address)).toEqual([
      positionAddress,
      balanceAddress,
      emptyAddress,
    ]);
    expect(result[2]?.info).toBeNull();
  });

  it('sorts by the portfolio-value snapshot, falling back to withdrawable when uncached', () => {
    const positionAddress = '0x1111111111111111111111111111111111111111';
    const richAddress = '0x2222222222222222222222222222222222222222';
    const uncachedAddress = '0x3333333333333333333333333333333333333333';
    const poorAddress = '0x4444444444444444444444444444444444444444';
    const cachedInfo: PerpsAccountInfoByAddress = {
      // High withdrawable must NOT outrank a higher PV once PV is cached.
      [richAddress]: info({ withdrawable: '1' }),
      [uncachedAddress]: info({ withdrawable: '50' }),
      [poorAddress]: info({ withdrawable: '0' }),
      [positionAddress]: info({ positionCount: 1 }),
    };

    const result = buildPerpsAccountSelectorData(
      [
        account(poorAddress, 'Poor'),
        account(richAddress, 'Rich'),
        account(uncachedAddress, 'Uncached'),
        account(positionAddress, 'Position'),
      ],
      cachedInfo,
      {
        [richAddress]: 1000,
        [uncachedAddress]: null,
        [poorAddress]: 10,
        // positionAddress has a tiny PV but positions always rank first.
        [positionAddress]: 1,
      },
    );

    expect(result.map(item => item.account.address)).toEqual([
      positionAddress,
      richAddress,
      uncachedAddress,
      poorAddress,
    ]);
  });
});

describe('enqueuePortfolioFetches', () => {
  it('starts portfolio fetches from the richest account', async () => {
    const queue = new PQueue({ concurrency: 3 });
    const started: string[] = [];
    const fetcher = jest.fn(async (address: string) => {
      started.push(address);
    });

    await Promise.all(
      enqueuePortfolioFetches(
        queue,
        [
          { address: '0xlow', balance: 1 },
          { address: '0xempty' },
          { address: '0xrich', balance: 12.5 },
          { address: '0xinvalid', balance: NaN },
        ],
        fetcher,
      ),
    );

    expect(started).toEqual(['0xrich', '0xlow', '0xempty', '0xinvalid']);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
