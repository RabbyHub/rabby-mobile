import { evaluateMaintenanceGate } from './maintenanceCommandGate';

describe('maintenanceCommandGate', () => {
  const now = 1_700_000_000_000;

  it('rejects a mutating command when the Screen E2E session is disabled', () => {
    expect(
      evaluateMaintenanceGate('debug-inject-approval', {
        sessionArmed: false,
        walletUnlocked: true,
        now,
      }),
    ).toEqual({ allowed: false, reason: 'session-disabled' });
  });

  it('keeps debug-dapp-eval behind the armed session and the wallet lock', () => {
    expect(
      evaluateMaintenanceGate('debug-dapp-eval', {
        sessionArmed: false,
        walletUnlocked: true,
        now,
      }),
    ).toEqual({ allowed: false, reason: 'session-disabled' });
    expect(
      evaluateMaintenanceGate('debug-dapp-eval', {
        sessionArmed: true,
        walletUnlocked: false,
        now,
      }),
    ).toEqual({ allowed: false, reason: 'wallet-locked' });
    expect(
      evaluateMaintenanceGate('debug-dapp-eval', {
        sessionArmed: true,
        walletUnlocked: true,
        now,
      }),
    ).toEqual({ allowed: true });
  });

  it('rejects a mutating command while the wallet is locked', () => {
    expect(
      evaluateMaintenanceGate('debug-set-current-account', {
        sessionArmed: true,
        walletUnlocked: false,
        now,
      }),
    ).toEqual({ allowed: false, reason: 'wallet-locked' });
  });

  it('rejects an expired command even inside an armed session', () => {
    expect(
      evaluateMaintenanceGate('debug-biometrics', {
        sessionArmed: true,
        walletUnlocked: true,
        expiresAt: now - 1,
        now,
      }),
    ).toEqual({ allowed: false, reason: 'expired-command' });
  });

  it('allows a gated command in an armed, unlocked session before expiry', () => {
    expect(
      evaluateMaintenanceGate('debug-biometrics', {
        sessionArmed: true,
        walletUnlocked: true,
        expiresAt: now + 60_000,
        now,
      }),
    ).toEqual({ allowed: true });
  });

  it('leaves non-mutating commands alone', () => {
    expect(
      evaluateMaintenanceGate('debug-open-target', {
        sessionArmed: false,
        walletUnlocked: false,
        now,
      }),
    ).toEqual({ allowed: true });
  });
});

test('gates the history-detail seed on an armed session and an unlocked wallet', () => {
  expect(
    evaluateMaintenanceGate('debug-open-history-local-detail', {
      sessionArmed: false,
      walletUnlocked: true,
    }),
  ).toEqual({ allowed: false, reason: 'session-disabled' });

  expect(
    evaluateMaintenanceGate('debug-open-history-local-detail', {
      sessionArmed: true,
      walletUnlocked: false,
    }),
  ).toEqual({ allowed: false, reason: 'wallet-locked' });

  expect(
    evaluateMaintenanceGate('debug-open-history-local-detail', {
      sessionArmed: true,
      walletUnlocked: true,
    }),
  ).toEqual({ allowed: true });
});
