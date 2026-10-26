jest.mock('./diagnosticEnv', () => ({
  isNonProductionDiagnosticsEnabled: true,
}));

import {
  classifyAuthReadinessState,
  clearAuthReadinessDiagnostics,
  getAuthReadinessDiagnosticsSnapshot,
  recordAuthReadinessDiagnostic,
} from './authReadinessDiagnostics';

describe('auth readiness diagnostics', () => {
  beforeEach(() => {
    clearAuthReadinessDiagnostics();
  });

  it('identifies the transient no-auth state on a sensitive modal', () => {
    expect(
      classifyAuthReadinessState({
        requestedAuthTypes: ['biometrics', 'password'],
        availableAuthTypes: ['none'],
        currentAuthType: 'none',
        pwdStatus: 'unknown',
      }),
    ).toEqual(['password-state-not-ready', 'sensitive-auth-resolved-to-none']);
  });

  it('identifies a selection that stayed none after auth became ready', () => {
    expect(
      classifyAuthReadinessState({
        requestedAuthTypes: ['biometrics', 'password'],
        availableAuthTypes: ['biometrics'],
        currentAuthType: 'none',
        pwdStatus: 'custom',
      }),
    ).toEqual([
      'sensitive-auth-resolved-to-none',
      'current-auth-type-not-available',
    ]);
  });

  it('keeps a bounded in-memory snapshot without sharing mutable data', () => {
    const authTypes = ['none'];
    recordAuthReadinessDiagnostic('auth-modal-mounted', {
      authTypes,
      anomalies: ['sensitive-auth-resolved-to-none'],
    });
    authTypes.push('password');

    const snapshot = getAuthReadinessDiagnosticsSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.anomalyCount).toBe(1);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0].data.authTypes).toEqual(['none']);
  });
});
