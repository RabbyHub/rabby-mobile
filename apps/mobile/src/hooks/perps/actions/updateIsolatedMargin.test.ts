jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
  perpsStore: { getState: jest.fn(() => ({})) },
}));

import type { UpdateIsolatedMarginDependencies } from './updateIsolatedMargin';
import {
  buildPerpsUpdateIsolatedMarginCommand,
  executePerpsUpdateIsolatedMargin,
} from './updateIsolatedMargin';

const account = { address: '0xabc', type: 'HdKeyring' } as const;
const command = buildPerpsUpdateIsolatedMarginCommand({
  account,
  coin: 'xyz:ABC',
  dexId: 'xyz',
  expectedSignedSize: '-2',
  targetMargin: '20',
});

const createDependencies = (
  overrides: Partial<UpdateIsolatedMarginDependencies> = {},
): UpdateIsolatedMarginDependencies => ({
  getLiveContext: () => ({
    account,
    dexId: 'xyz',
    hasPermission: true,
    position: {
      leverageType: 'isolated',
      marginUsed: '10.1234567',
      signedSize: '-2',
    },
  }),
  refresh: jest.fn().mockResolvedValue(undefined),
  updateIsolatedMargin: jest.fn().mockResolvedValue({ status: 'ok' }),
  ...overrides,
});

describe('updateIsolatedMargin action', () => {
  it('builds an immutable command and rejects more than two target decimals', () => {
    expect(command).toMatchObject({
      coin: 'xyz:ABC',
      targetMargin: '20',
      type: 'updateIsolatedMargin',
    });
    expect(Object.isFrozen(command)).toBe(true);
    expect(() =>
      buildPerpsUpdateIsolatedMarginCommand({
        account,
        coin: 'BTC',
        dexId: '',
        expectedSignedSize: '1',
        targetMargin: '1.001',
      }),
    ).toThrow('Invalid isolated margin update');
  });

  it('recomputes the signed six-decimal delta from the latest margin', async () => {
    const dependencies = createDependencies();
    await expect(
      executePerpsUpdateIsolatedMargin(command, dependencies),
    ).resolves.toMatchObject({ delta: '9.876543', kind: 'success' });
    expect(dependencies.updateIsolatedMargin).toHaveBeenCalledWith({
      coin: 'xyz:ABC',
      value: 9.876543,
    });
    expect(dependencies.refresh).toHaveBeenCalledWith('xyz');
  });

  it('uses the last guarded margin snapshot immediately before the request', async () => {
    const getLiveContext = jest
      .fn()
      .mockReturnValueOnce({
        account,
        dexId: 'xyz',
        hasPermission: true,
        position: {
          leverageType: 'isolated',
          marginUsed: '10',
          signedSize: '-2',
        },
      })
      .mockReturnValue({
        account,
        dexId: 'xyz',
        hasPermission: true,
        position: {
          leverageType: 'isolated',
          marginUsed: '11',
          signedSize: '-2',
        },
      });
    const dependencies = createDependencies({ getLiveContext });

    await expect(
      executePerpsUpdateIsolatedMargin(command, dependencies),
    ).resolves.toMatchObject({ delta: '9', kind: 'success' });
    expect(dependencies.updateIsolatedMargin).toHaveBeenCalledWith({
      coin: 'xyz:ABC',
      value: 9,
    });
  });

  it.each([
    ['account', { account: { address: '0xdef', type: 'HdKeyring' } }],
    ['dex', { dexId: 'other' }],
    [
      'mode',
      {
        position: { leverageType: 'cross', marginUsed: '10', signedSize: '-2' },
      },
    ],
    [
      'size',
      {
        position: {
          leverageType: 'isolated',
          marginUsed: '10',
          signedSize: '-1',
        },
      },
    ],
  ])('fails stale before signing when %s changes', async (_label, patch) => {
    const dependencies = createDependencies({
      getLiveContext: () => ({
        account,
        dexId: 'xyz',
        hasPermission: true,
        position: {
          leverageType: 'isolated',
          marginUsed: '10',
          signedSize: '-2',
        },
        ...patch,
      }),
    });
    await expect(
      executePerpsUpdateIsolatedMargin(command, dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(dependencies.updateIsolatedMargin).not.toHaveBeenCalled();
  });

  it('fails closed for region restriction', async () => {
    const dependencies = createDependencies({
      getLiveContext: () => ({
        account,
        dexId: 'xyz',
        hasPermission: false,
        position: {
          leverageType: 'isolated',
          marginUsed: '10',
          signedSize: '-2',
        },
      }),
    });
    await expect(
      executePerpsUpdateIsolatedMargin(command, dependencies),
    ).resolves.toEqual({
      failureReason: 'regionRestricted',
      kind: 'failed',
    });
  });

  it('classifies timeout and malformed acknowledgement as unknown outcome and refreshes', async () => {
    const timeoutDependencies = createDependencies({
      updateIsolatedMargin: jest.fn().mockRejectedValue(new Error('timeout')),
    });
    await expect(
      executePerpsUpdateIsolatedMargin(command, timeoutDependencies),
    ).resolves.toMatchObject({ kind: 'unknownOutcome' });
    expect(timeoutDependencies.refresh).toHaveBeenCalledWith('xyz');

    const malformedDependencies = createDependencies({
      updateIsolatedMargin: jest.fn().mockResolvedValue({ response: {} }),
    });
    await expect(
      executePerpsUpdateIsolatedMargin(command, malformedDependencies),
    ).resolves.toMatchObject({ kind: 'unknownOutcome' });
    expect(malformedDependencies.refresh).toHaveBeenCalledWith('xyz');
  });

  it('does not refresh or retry deterministic rejection and cancellation', async () => {
    const rejected = createDependencies({
      updateIsolatedMargin: jest.fn().mockResolvedValue({
        response: 'invalid margin',
        status: 'err',
      }),
    });
    await expect(
      executePerpsUpdateIsolatedMargin(command, rejected),
    ).resolves.toMatchObject({ kind: 'failed' });
    expect(rejected.refresh).not.toHaveBeenCalled();

    const cancelled = createDependencies({
      updateIsolatedMargin: jest.fn().mockRejectedValue('Canceled'),
    });
    await expect(
      executePerpsUpdateIsolatedMargin(command, cancelled),
    ).resolves.toMatchObject({
      failureReason: 'userCancelled',
      kind: 'failed',
    });
    expect(cancelled.refresh).not.toHaveBeenCalled();
  });
});
