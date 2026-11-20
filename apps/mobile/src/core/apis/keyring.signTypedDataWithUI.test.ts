const mockSignTypedMessage = jest.fn();
const mockSetCurrentRequestDeferFn = jest.fn();

jest.mock('@/core/serviceApi/keyring', () => ({
  keyringServiceApi: {
    getKeyringForAccount: jest.fn(async () => ({})),
    signTypedMessage: (...args: unknown[]) => mockSignTypedMessage(...args),
  },
}));
jest.mock('@/core/serviceApi/notification', () => ({
  ensureNotificationServiceReady: jest.fn(async () => undefined),
  setCurrentRequestDeferFnSync: (...args: unknown[]) =>
    mockSetCurrentRequestDeferFn(...args),
}));
jest.mock('@/core/serviceApi/preference', () => ({}));
jest.mock('../utils/getKeyringParams', () => ({}));
jest.mock('@/utils/events', () => ({
  eventBus: { emit: jest.fn() },
  EVENTS: { SIGN_FINISHED: 'SIGN_FINISHED' },
}));
jest.mock('@/utils/walletUnlockGuard', () => ({
  withWalletUnlockIf: (_predicate: unknown, fn: unknown) => fn,
  isSensitiveKeyringType: jest.fn(() => false),
  ensureWalletUnlocked: jest.fn(),
}));

import { apisKeyring } from './keyring';
import { emitSignComponentAmounted } from '../utils/signEvent';

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('apisKeyring.signTypedDataWithUI', () => {
  it('signs once the waiting UI mounts, and retries without another mount event', async () => {
    mockSignTypedMessage.mockResolvedValue('0xsig');

    const started = apisKeyring.signTypedDataWithUI('Ledger', '0xabc', '{}', {
      brandName: 'Ledger',
      version: 'V4',
      signingOperationId: 'operation-safe',
    });
    await flush();
    expect(mockSignTypedMessage).not.toHaveBeenCalled();

    emitSignComponentAmounted('operation-safe');
    await started;
    await flush();
    expect(mockSignTypedMessage).toHaveBeenCalledTimes(1);
    expect(mockSignTypedMessage).toHaveBeenCalledWith(
      {},
      { from: '0xabc', data: '{}' },
      { brandName: 'Ledger', version: 'V4' },
    );
    const { eventBus } = jest.requireMock('@/utils/events');
    expect(eventBus.emit).toHaveBeenCalledWith('SIGN_FINISHED', {
      success: true,
      data: '0xsig',
      signingOperationId: 'operation-safe',
    });
    expect(mockSetCurrentRequestDeferFn).toHaveBeenCalledWith(
      expect.any(Function),
      'operation-safe',
    );

    const retry = mockSetCurrentRequestDeferFn.mock.calls.at(-1)[0];
    await retry();
    await flush();
    expect(mockSignTypedMessage).toHaveBeenCalledTimes(2);
  });
});
