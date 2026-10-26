import { assertPublicSessionScenarioReady } from './publicSessionPrecondition';

// Unit coverage for the scenario's access policy, not a native unlock test.
const mockIsUnlocked = jest.fn(() => false);
const mockIsUnlockSessionValid = jest.fn(() => true);
const mockIsKeyringRuntimeReady = jest.fn(() => false);
const mockHasPublicSnapshot = jest.fn(() => true);
const mockPublicAccounts = jest.fn(() => [{ address: '0xpublic' }]);
const mockUnlockWallet = jest.fn();
const mockEnsureRuntimeReady = jest.fn();

jest.mock('@/core/apis/lock', () => ({
  isUnlocked: () => mockIsUnlocked(),
  isUnlockSessionValid: () => mockIsUnlockSessionValid(),
  isKeyringRuntimeReady: () => mockIsKeyringRuntimeReady(),
  unlockWalletWithUpdateUnlockTime: () => mockUnlockWallet(),
  ensureKeyringRuntimeReady: () => mockEnsureRuntimeReady(),
}));
jest.mock('@/core/serviceApi/keyring', () => ({
  hasKeyringPublicAccountSnapshot: () => mockHasPublicSnapshot(),
  getPublicAccountSnapshotAccounts: () => mockPublicAccounts(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockIsUnlocked.mockReturnValue(false);
  mockIsUnlockSessionValid.mockReturnValue(true);
  mockIsKeyringRuntimeReady.mockReturnValue(false);
  mockHasPublicSnapshot.mockReturnValue(true);
  mockPublicAccounts.mockReturnValue([{ address: '0xpublic' }]);
});

afterEach(() => {
  expect(mockUnlockWallet).not.toHaveBeenCalled();
  expect(mockEnsureRuntimeReady).not.toHaveBeenCalled();
});

it.each(['home-assets', 'token-detail'] as const)(
  'accepts a valid public session for %s without claiming keyring unlock',
  scenario => {
    expect(assertPublicSessionScenarioReady(scenario)).toEqual({
      walletUnlocked: false,
      unlockSessionValid: true,
      keyringRuntimeReady: false,
      publicAccountCount: 1,
    });
  },
);

it('accepts a genuinely unlocked wallet when session reuse is disabled', () => {
  mockIsUnlocked.mockReturnValue(true);
  mockIsUnlockSessionValid.mockReturnValue(false);
  expect(assertPublicSessionScenarioReady('home-assets')).toMatchObject({
    walletUnlocked: true,
    unlockSessionValid: false,
    keyringRuntimeReady: false,
  });
});

it('reports a ready keyring without forcing restoration', () => {
  mockIsUnlocked.mockReturnValue(true);
  mockIsKeyringRuntimeReady.mockReturnValue(true);
  expect(assertPublicSessionScenarioReady('token-detail')).toMatchObject({
    walletUnlocked: true,
    keyringRuntimeReady: true,
  });
});

it('rejects an expired or locked session even when public accounts exist', () => {
  mockIsUnlockSessionValid.mockReturnValue(false);
  expect(() => assertPublicSessionScenarioReady('home-assets')).toThrow(
    'authenticated wallet session',
  );
});

it('rejects missing public account snapshot readiness', () => {
  mockHasPublicSnapshot.mockReturnValue(false);
  expect(() => assertPublicSessionScenarioReady('token-detail')).toThrow(
    'ready public account snapshot',
  );
});

it('rejects an empty public account snapshot', () => {
  mockPublicAccounts.mockReturnValue([]);
  expect(() => assertPublicSessionScenarioReady('token-detail')).toThrow(
    'ready public account snapshot',
  );
});

it('rechecks authentication when async account preparation has finished', () => {
  assertPublicSessionScenarioReady('token-detail');
  mockIsUnlockSessionValid.mockReturnValue(false);
  expect(() => assertPublicSessionScenarioReady('token-detail')).toThrow(
    'authenticated wallet session',
  );
});

it('does not authorize another scenario through this public-session gate', () => {
  expect(() =>
    // @ts-expect-error The public-session allowlist is deliberately narrow.
    assertPublicSessionScenarioReady('send-receive'),
  ).toThrow('does not support public-session navigation');
});
