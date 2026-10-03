import { act, renderHook } from '@testing-library/react-native';
import { useRequest } from 'ahooks';
import { getAuthTransactionKey, useAuthFormGuard } from './useAuthFormGuard';

const values = { amount: '1', account: '0x01', token: '0x02', chain: 'eth' };

describe('useAuthFormGuard', () => {
  function setup() {
    const changed = jest.fn();
    const submit = jest.fn();
    const hook = renderHook(({ form }) => useAuthFormGuard(form, changed), {
      initialProps: { form: values },
    });
    return { ...hook, changed, submit };
  }

  it('retains the snapshot across dismiss-before-finish and submits only once', async () => {
    const { result, rerender, submit, changed } = setup();
    const attempt = result.current;
    act(() => attempt.onBeforeAuth());
    rerender({ form: { ...values } });
    act(() => attempt.onAuthModalDismiss());
    await act(async () => {
      await attempt.onFinished(submit);
      await attempt.onFinished(submit);
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not submit a cancelled attempt or a callback after unmount', async () => {
    const { result, unmount, submit } = setup();
    const attempt = result.current;
    act(() => {
      attempt.onBeforeAuth();
      attempt.onCancel();
    });
    await act(async () => {
      await attempt.onFinished(submit);
    });
    act(() => attempt.onBeforeAuth());
    unmount();
    await attempt.onFinished(submit);
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(['amount', 'account', 'token', 'chain'])(
    'rejects changed %s through the original callback',
    async field => {
      const { result, rerender, submit, changed } = setup();
      const attempt = result.current;
      act(() => attempt.onBeforeAuth());
      rerender({ form: { ...values, [field]: 'changed' } });
      // Restoring the value does not revive an invalidated authentication.
      rerender({ form: { ...values } });
      await act(async () => {
        await attempt.onFinished(submit);
      });
      expect(submit).not.toHaveBeenCalled();
      expect(changed).toHaveBeenCalledTimes(1);
    },
  );

  it('blocks auth-time input and rejects post-dismiss input before React rerenders', async () => {
    const { result, submit } = setup();
    const attempt = result.current;
    act(() => attempt.onBeforeAuth());
    expect(attempt.blockInput()).toBe(true);
    act(() => attempt.onAuthModalDismiss());
    expect(attempt.blockInput()).toBe(false);
    await act(async () => {
      await attempt.onFinished(submit);
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps input blocked until submission settles, even if dismissal is late', async () => {
    const { result } = setup();
    const attempt = result.current;
    let finish!: () => void;
    const submit = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    act(() => attempt.onBeforeAuth());
    const submitted = attempt.onFinished(submit);
    act(() => attempt.onAuthModalDismiss());
    expect(attempt.blockInput()).toBe(true);
    // Hardware buttons call before/finish synchronously, without a modal.
    act(() => attempt.onBeforeAuth());
    await attempt.onFinished(submit);
    expect(submit).toHaveBeenCalledTimes(1);
    finish();
    await submitted;
    expect(attempt.blockInput()).toBe(false);
  });

  it('rejects a refreshed Perps payload, quote amount or approval step with unchanged input', async () => {
    const tx = {
      from: '0x01',
      to: '0x02',
      data: '0xa1',
      value: '0x0',
      chainId: 1,
    };
    const reviewed = {
      ...values,
      transactionKey: getAuthTransactionKey([tx]),
      receiveAmount: 1,
      approveStep: true,
    };
    for (const update of [
      { transactionKey: getAuthTransactionKey([{ ...tx, data: '0xa2' }]) },
      { receiveAmount: 2 },
      { approveStep: false },
    ]) {
      const submitLatest = jest.fn();
      const { result, rerender, unmount } = renderHook(
        ({ form }) => useAuthFormGuard(form, jest.fn()),
        { initialProps: { form: reviewed } },
      );
      const attempt = result.current;
      act(() => attempt.onBeforeAuth());
      rerender({ form: { ...reviewed, ...update } });
      await act(async () => {
        await attempt.onFinished(submitLatest);
      });
      expect(submitLatest).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('ignores gas-only refreshes in the reviewed transaction key', () => {
    const tx = {
      from: '0x01',
      to: '0x02',
      data: '0xa1',
      value: '0x0',
      chainId: 1,
      gas: '0x10',
    };
    expect(getAuthTransactionKey([tx])).toBe(
      getAuthTransactionKey([{ ...tx, gas: '0x20' }]),
    );
    for (const update of [
      { from: '0x03' },
      { to: '0x03' },
      { data: '0xa2' },
      { value: '0x1' },
      { chainId: 2 },
    ]) {
      expect(getAuthTransactionKey([tx])).not.toBe(
        getAuthTransactionKey([{ ...tx, ...update }]),
      );
    }
    expect(getAuthTransactionKey([tx, tx])).not.toBe(
      getAuthTransactionKey([tx]),
    );
  });

  it('checks the latest form before an ahooks submit callback can use a refreshed payload', async () => {
    const onDeposit = jest.fn();
    const tx = {
      from: '0x01',
      to: '0x02',
      data: '0xa1',
      value: '0x0',
      chainId: 1,
    };
    const { result, rerender } = renderHook(
      ({ transaction }) => {
        const form = useAuthFormGuard(
          { ...values, transactionKey: getAuthTransactionKey([transaction]) },
          jest.fn(),
        );
        const { runAsync } = useRequest(async () => onDeposit(transaction), {
          manual: true,
        });
        return { form, runAsync };
      },
      { initialProps: { transaction: tx } },
    );
    const original = result.current;
    act(() => original.form.onBeforeAuth());
    rerender({ transaction: { ...tx, data: '0xa2' } });
    await act(async () => {
      await original.form.onFinished(original.runAsync);
    });
    expect(onDeposit).not.toHaveBeenCalled();
    // Confirm this really is ahooks' latest-service callback, not a stale fake.
    await act(async () => {
      await original.runAsync();
    });
    expect(onDeposit).toHaveBeenCalledWith({ ...tx, data: '0xa2' });
  });
});
