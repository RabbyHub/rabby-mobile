import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createStore, Provider } from 'jotai';
import type { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import * as apiSecurityEngine from '@/core/apis/securityEngine';
import { useApprovalSecurityEngine } from './useApprovalSecurityEngine';
import {
  useActionSecurity,
  type PreparedSecurityActions,
} from './useActionSecurity';

// Component/unit coverage: keep the real approval state and gate, and control
// the engine boundary to exercise completion order, failures and retries.
jest.mock('@/core/apis/securityEngine', () => ({
  executeSecurityEngine: jest.fn(),
  getSecurityEngineRules: jest.fn(async () => []),
  getSecurityEngineUserData: jest.fn(async () => ({
    originWhitelist: [],
    originBlacklist: [],
    contractWhitelist: [],
    contractBlacklist: [],
    addressWhitelist: [],
    addressBlacklist: [],
  })),
}));

const execute = jest.mocked(apiSecurityEngine.executeSecurityEngine);
const danger: Result = {
  id: '1016',
  enable: true,
  level: Level.DANGER,
  value: true,
  valueDescription: '',
  valueDefine: { type: 'boolean' },
  threshold: {},
};
const prepared = (count = 1): PreparedSecurityActions<string> => ({
  type: count > 1 ? 'multi' : 'single',
  actions: Array.from({ length: count }, (_, i) => ({
    data: `action-${i}`,
    requireData: null,
    ctx: {},
  })),
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
function mount(input: PreparedSecurityActions<string> | null) {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(
    ({ input: next }) => {
      const state = useApprovalSecurityEngine();
      return { state, gate: useActionSecurity(next, state, 'transaction') };
    },
    { initialProps: { input }, wrapper },
  );
}

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([]);
});

test('blocks before evaluation, then accepts a completed empty verdict set', async () => {
  const { result, rerender } = mount(null);
  expect(result.current.gate.blocked).toBe(true);
  expect(result.current.gate.canSubmit()).toBe(false);
  const pending = deferred<Result[]>();
  execute.mockReturnValueOnce(pending.promise);
  rerender({ input: prepared() });
  expect(result.current.gate.blocked).toBe(true);
  await act(async () => pending.resolve([]));
  expect(result.current.gate.ready).toBe(true);
  expect(result.current.gate.canSubmit()).toBe(true);
});

test('a batch requires every action to finish and each risk to be acknowledged', async () => {
  const pending = deferred<Result[]>();
  execute.mockResolvedValueOnce([danger]).mockReturnValueOnce(pending.promise);
  const { result } = mount(prepared(2));
  expect(result.current.gate.blocked).toBe(true);
  await act(async () => pending.resolve([danger]));
  expect(result.current.gate.resultList).toEqual([[danger], [danger]]);
  expect(result.current.gate.securityLevel).toBe(Level.DANGER);
  act(() =>
    result.current.state.processRule(
      danger.id,
      result.current.gate.securityScopes[0],
    ),
  );
  expect(result.current.gate.blocked).toBe(true);
  const secondScope = result.current.gate.securityScopes[1];
  act(() =>
    result.current.state.processAllRules([
      ...result.current.state.currentTx.processedRules,
      ...result.current.gate.pendingRuleKeys,
    ]),
  );
  expect(result.current.gate.canSubmit()).toBe(true);
  act(() => result.current.state.unProcessRule(danger.id, secondScope));
  expect(result.current.gate.canSubmit()).toBe(false);
});

test.each(['reject', 'error'] as const)(
  'fails closed on %s and permits retry',
  async failure => {
    if (failure === 'reject')
      execute.mockRejectedValueOnce(new Error('offline'));
    else execute.mockResolvedValueOnce([{ ...danger, level: Level.ERROR }]);
    const { result } = mount(prepared());
    await waitFor(() => expect(result.current.gate.error).toBe(true));
    expect(result.current.gate.canSubmit()).toBe(false);
    act(() => result.current.gate.retry());
    await waitFor(() => expect(result.current.gate.ready).toBe(true));
    expect(result.current.gate.canSubmit()).toBe(true);
  },
);

test('a late clean result cannot overwrite the current dangerous evaluation', async () => {
  const old = deferred<Result[]>();
  execute.mockReturnValueOnce(old.promise).mockResolvedValueOnce([danger]);
  const { result, rerender } = mount(prepared());
  rerender({ input: prepared() });
  await waitFor(() => expect(result.current.gate.ready).toBe(true));
  await act(async () => old.resolve([]));
  expect(result.current.gate.engineResults).toEqual([danger]);
  expect(result.current.gate.canSubmit()).toBe(false);
});

test('rule/user-data refresh reevaluates every batch action and invalidates old acknowledgements', async () => {
  execute.mockResolvedValue([danger]);
  const { result } = mount(prepared(2));
  await waitFor(() => expect(result.current.gate.ready).toBe(true));
  act(() =>
    result.current.state.processAllRules(result.current.gate.pendingRuleKeys),
  );
  const oldSubmit = result.current.gate.canSubmit;
  expect(oldSubmit()).toBe(true);
  act(() => {
    result.current.state.setUserData(prev => ({
      ...prev,
      addressBlacklist: ['0x123'],
    }));
    expect(oldSubmit()).toBe(false);
  });
  await waitFor(() => expect(result.current.gate.ready).toBe(true));
  expect(result.current.gate.canSubmit()).toBe(false);
  expect(execute).toHaveBeenCalledTimes(4);
  act(() =>
    result.current.state.processAllRules(result.current.gate.pendingRuleKeys),
  );
  expect(result.current.gate.canSubmit()).toBe(true);
  expect(oldSubmit()).toBe(false);
  jest
    .mocked(apiSecurityEngine.getSecurityEngineRules)
    .mockResolvedValueOnce([{ id: 'changed' }] as never);
  await act(async () => {
    await result.current.state.init();
  });
  await waitFor(() => expect(result.current.gate.ready).toBe(true));
  expect(execute).toHaveBeenCalledTimes(6);
  expect(result.current.gate.canSubmit()).toBe(false);
});

test('unchanged settings do not restart evaluation when action rows initialize', async () => {
  const { result } = mount(prepared());
  await waitFor(() => expect(result.current.gate.ready).toBe(true));
  const scopes = result.current.gate.securityScopes;
  await act(async () => {
    await result.current.state.init();
  });
  expect(result.current.gate.securityScopes).toBe(scopes);
  expect(execute).toHaveBeenCalledTimes(1);
});

test('batch-to-single transition and unmount cannot reuse old verdicts or submission callbacks', async () => {
  const { result, rerender, unmount } = mount(prepared(2));
  await waitFor(() => expect(result.current.gate.ready).toBe(true));
  const oldSubmit = result.current.gate.canSubmit;
  const pending = deferred<Result[]>();
  execute.mockReturnValueOnce(pending.promise);
  rerender({ input: prepared() });
  expect(oldSubmit()).toBe(false);
  expect(result.current.gate.resultList).toEqual([]);
  await act(async () => pending.resolve([]));
  expect(result.current.gate.resultList).toHaveLength(1);
  const currentSubmit = result.current.gate.canSubmit;
  act(() => result.current.gate.invalidate());
  expect(currentSubmit()).toBe(false);
  act(() => result.current.gate.retry());
  await waitFor(() => expect(result.current.gate.ready).toBe(true));
  const finalSubmit = result.current.gate.canSubmit;
  unmount();
  expect(finalSubmit()).toBe(false);
});
