import {
  createInitialGasAccountState,
  failSnapshotRefreshState,
  finishSnapshotRefreshState,
  markSnapshotDirtyState,
  startSnapshotRefreshState,
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
