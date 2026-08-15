import type { Account } from '@/core/startupServices/preference';
import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';

import {
  buildPerpsAccountSelectorData,
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
});
