import {
  createInitialGasAccountState,
  failSnapshotRefreshState,
  finishSnapshotRefreshState,
  markSnapshotDirtyState,
  startSnapshotRefreshState,
  updateDiscoveryState,
  updateSessionState,
} from './state';

describe('Gas Account snapshot refresh state', () => {
  it('consumes the current invalidation when a refresh starts', () => {
    const initial = markSnapshotDirtyState(
      createInitialGasAccountState(),
      'transaction_completed',
    );

    const refreshing = startSnapshotRefreshState(initial, 'home_focus');

    expect(refreshing.snapshot).toMatchObject({
      status: 'refreshing',
      dirty: false,
      refreshReason: 'home_focus',
    });
  });

  it('preserves an invalidation raised while a refresh is running', () => {
    const refreshing = startSnapshotRefreshState(
      createInitialGasAccountState(),
      'screen_focus',
    );
    const invalidated = markSnapshotDirtyState(refreshing, 'deposit_confirmed');

    const finished = finishSnapshotRefreshState(invalidated, {
      account: { id: '0x1' },
    });

    expect(finished.snapshot).toMatchObject({
      status: 'ready',
      dirty: true,
      refreshReason: 'deposit_confirmed',
    });
  });

  it('keeps a failed resource invalid for the next activation', () => {
    const refreshing = startSnapshotRefreshState(
      createInitialGasAccountState(),
      'screen_focus',
    );

    const failed = failSnapshotRefreshState(refreshing);

    expect(failed.snapshot).toMatchObject({
      status: 'error',
      dirty: true,
    });
  });
});

describe('Gas Account hydration state', () => {
  const account = {
    address: '0xabc',
    type: 'SimpleKeyring',
    brandName: 'Rabby',
  };

  it('keeps the state identity for an equivalent session', () => {
    const initial = createInitialGasAccountState({
      session: {
        sig: 'sig',
        accountId: account.address,
        account,
        status: 'logged_in',
      },
    });

    expect(
      updateSessionState(initial, {
        account: { ...account },
      }),
    ).toBe(initial);
  });

  it('keeps the state identity for equivalent discovery data', () => {
    const initial = createInitialGasAccountState({
      discovery: {
        pendingHardwareAccount: account,
        accountsWithBalance: [account],
        status: 'ready',
        lastFetchedAt: 100,
      },
    });

    expect(
      updateDiscoveryState(initial, {
        pendingHardwareAccount: { ...account },
        accountsWithBalance: [{ ...account }],
      }),
    ).toBe(initial);
  });

  it('updates discovery when an account changes', () => {
    const initial = createInitialGasAccountState({
      discovery: {
        accountsWithBalance: [account],
        status: 'ready',
      },
    });

    const next = updateDiscoveryState(initial, {
      accountsWithBalance: [{ ...account, brandName: 'Ledger' }],
    });

    expect(next).not.toBe(initial);
    expect(next.discovery.accountsWithBalance[0].brandName).toBe('Ledger');
  });
});
