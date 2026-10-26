import { createPerpsFundingLedgerQuery } from './fundingHistoryLedgerQuery';

type Scope = Readonly<{ account: string; generation: number }>;

const getScopeKey = (scope: Scope) =>
  `${scope.account.toLowerCase()}::${scope.generation}`;

describe('funding history ledger query', () => {
  it('shares one request inside an account generation', async () => {
    let resolveRequest: ((items: readonly string[]) => void) | undefined;
    const fetchLedger = jest.fn(
      () =>
        new Promise<readonly string[]>(resolve => {
          resolveRequest = resolve;
        }),
    );
    const applyLedger = jest.fn();
    const scope = { account: '0xabc', generation: 1 };
    const query = createPerpsFundingLedgerQuery({
      applyLedger,
      fetchLedger,
      getScope: () => scope,
      getScopeKey,
    });

    const first = query();
    const second = query();
    expect(first).toBe(second);
    expect(fetchLedger).toHaveBeenCalledTimes(1);

    resolveRequest?.(['ledger']);
    await expect(first).resolves.toBe(true);
    expect(applyLedger).toHaveBeenCalledWith(['ledger'], scope);
  });

  it('drops an A to B to A response from the old generation', async () => {
    let scope: Scope = { account: '0xabc', generation: 1 };
    let resolveRequest: ((items: readonly string[]) => void) | undefined;
    const applyLedger = jest.fn();
    const query = createPerpsFundingLedgerQuery({
      applyLedger,
      fetchLedger: () =>
        new Promise<readonly string[]>(resolve => {
          resolveRequest = resolve;
        }),
      getScope: () => scope,
      getScopeKey,
    });

    const request = query();
    scope = { account: '0xdef', generation: 2 };
    scope = { account: '0xabc', generation: 3 };
    resolveRequest?.(['stale-ledger']);

    await expect(request).resolves.toBe(false);
    expect(applyLedger).not.toHaveBeenCalled();
  });

  it('allows a retry after a failed request', async () => {
    const onError = jest.fn();
    const fetchLedger = jest
      .fn<Promise<readonly string[]>, [Scope]>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(['ledger']);
    const applyLedger = jest.fn();
    const scope = { account: '0xabc', generation: 1 };
    const query = createPerpsFundingLedgerQuery({
      applyLedger,
      fetchLedger,
      getScope: () => scope,
      getScopeKey,
      onError,
    });

    await expect(query()).resolves.toBe(false);
    await expect(query()).resolves.toBe(true);
    expect(fetchLedger).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(applyLedger).toHaveBeenCalledWith(['ledger'], scope);
  });
});
