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
