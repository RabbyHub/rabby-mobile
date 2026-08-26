import { createPerpsUserAbstractionLifecycle } from './userAbstractionLifecycle';

type TestAccount = { address: string; type: string };

const ACCOUNT_A: TestAccount = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
};
const ACCOUNT_B: TestAccount = {
  address: '0x2222222222222222222222222222222222222222',
  type: 'PrivateKeyring',
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
};

const sameAccount = (left: TestAccount | null, right: TestAccount | null) =>
  !!left &&
  !!right &&
  left.address.toLowerCase() === right.address.toLowerCase() &&
  left.type === right.type;

describe('Perps user abstraction lifecycle', () => {
  it('requires an explicit address before querying', async () => {
    const query = jest.fn();
    const lifecycle = createPerpsUserAbstractionLifecycle({
      getRuntimeContext: () => ({
        account: { ...ACCOUNT_A, address: '' },
        generation: 1,
      }),
      isSameAccount: sameAccount,
      onLoading: jest.fn(),
      onResolved: jest.fn(),
      query,
    });

    await expect(
      lifecycle.refresh({ ...ACCOUNT_A, address: '' }),
    ).rejects.toThrow('Perps abstraction address is required');
    expect(query).not.toHaveBeenCalled();
  });

  it('drops a late response from the previous account', async () => {
    let runtime = { account: ACCOUNT_A as TestAccount | null, generation: 1 };
    const requestA = deferred<string>();
    const requestB = deferred<string>();
    const onResolved = jest.fn();
    const lifecycle = createPerpsUserAbstractionLifecycle({
      getRuntimeContext: () => runtime,
      isSameAccount: sameAccount,
      onLoading: jest.fn(),
      onResolved,
      query: address =>
        address === ACCOUNT_A.address ? requestA.promise : requestB.promise,
    });

    const resultA = lifecycle.refresh(ACCOUNT_A);
    runtime = { account: ACCOUNT_B, generation: 2 };
    const resultB = lifecycle.refresh(ACCOUNT_B);
    requestB.resolve('unifiedAccount');
    await expect(resultB).resolves.toBe('unifiedAccount');
    requestA.resolve('default');
    await expect(resultA).resolves.toBeNull();

    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ account: ACCOUNT_B, generation: 2 }),
      'unifiedAccount',
    );
  });

  it('keeps the latest same-account request authoritative', async () => {
    const runtime = { account: ACCOUNT_A as TestAccount | null, generation: 3 };
    const oldRequest = deferred<string>();
    const newRequest = deferred<string>();
    const requests = [oldRequest, newRequest];
    const onResolved = jest.fn();
    const lifecycle = createPerpsUserAbstractionLifecycle({
      getRuntimeContext: () => runtime,
      isSameAccount: sameAccount,
      onLoading: jest.fn(),
      onResolved,
      query: () => requests.shift()!.promise,
    });

    const oldResult = lifecycle.refresh(ACCOUNT_A);
    const newResult = lifecycle.refresh(ACCOUNT_A);
    newRequest.resolve('unifiedAccount');
    await expect(newResult).resolves.toBe('unifiedAccount');
    oldRequest.resolve('default');
    await expect(oldResult).resolves.toBeNull();

    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 2 }),
      'unifiedAccount',
    );
  });

  it('rejects the first A response after an A to B to A generation cycle', async () => {
    let runtime = { account: ACCOUNT_A as TestAccount | null, generation: 7 };
    const firstA = deferred<string>();
    const secondA = deferred<string>();
    const requests = [firstA, secondA];
    const onResolved = jest.fn();
    const lifecycle = createPerpsUserAbstractionLifecycle({
      getRuntimeContext: () => runtime,
      isSameAccount: sameAccount,
      onLoading: jest.fn(),
      onResolved,
      query: () => requests.shift()!.promise,
    });

    const firstResult = lifecycle.refresh(ACCOUNT_A);
    runtime = { account: ACCOUNT_B, generation: 8 };
    runtime = { account: ACCOUNT_A, generation: 9 };
    const secondResult = lifecycle.refresh(ACCOUNT_A);
    secondA.resolve('unifiedAccount');
    await expect(secondResult).resolves.toBe('unifiedAccount');
    firstA.resolve('default');
    await expect(firstResult).resolves.toBeNull();

    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ generation: 9 }),
      'unifiedAccount',
    );
  });
});
