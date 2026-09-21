import type { Account } from '@/core/startupServices/preference';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

import { createPerpsWithdrawLiveAbstractionQuery } from './perpsWithdrawLiveGuard';

const account = {
  address: '0xAbC',
  brandName: 'Rabby',
  type: KEYRING_CLASS.PRIVATE_KEY,
} as Account;

describe('Perps Pro withdraw live abstraction guard', () => {
  it('returns and reconciles a live mode only inside the frozen runtime', async () => {
    const query = jest.fn(async () => UserAbstractionResp.unifiedAccount);
    const reconcile = jest.fn(() => true);
    const guard = createPerpsWithdrawLiveAbstractionQuery({
      account,
      generation: 3,
      getRuntimeContext: () => ({ account, generation: 3 }),
      query,
      reconcile,
    });

    await expect(guard()).resolves.toBe(UserAbstractionResp.unifiedAccount);
    expect(query).toHaveBeenCalledWith(account.address);
    expect(reconcile).toHaveBeenCalledWith(UserAbstractionResp.unifiedAccount);
  });

  it('does not query after the account runtime has already changed', async () => {
    const query = jest.fn(async () => UserAbstractionResp.default);
    const guard = createPerpsWithdrawLiveAbstractionQuery({
      account,
      generation: 3,
      getRuntimeContext: () => ({ account, generation: 4 }),
      query,
      reconcile: () => true,
    });

    await expect(guard()).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('drops a response when the runtime changes while the query is in flight', async () => {
    let generation = 3;
    const query = jest.fn(async () => {
      generation = 4;
      return UserAbstractionResp.portfolioMargin;
    });
    const reconcile = jest.fn(() => true);
    const guard = createPerpsWithdrawLiveAbstractionQuery({
      account,
      generation: 3,
      getRuntimeContext: () => ({ account, generation }),
      query,
      reconcile,
    });

    await expect(guard()).resolves.toBeNull();
    expect(reconcile).not.toHaveBeenCalled();
  });
});
