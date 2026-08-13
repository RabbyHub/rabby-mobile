import { act, renderHook } from '@testing-library/react-native';

import { PasswordStatus } from '@/core/apis/lock';
import { getBiometricsInfoSnapshot, setBiometrics } from '@/hooks/biometrics';
import { getAppLockStateSnapshot, storeApiLock } from '@/hooks/appLockState';
import { useAuthenticationModal } from './hooks';

describe('authentication modal readiness integration', () => {
  const originalAppLockState = getAppLockStateSnapshot();
  const originalBiometricsState = getBiometricsInfoSnapshot();

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    storeApiLock.setAppLock({
      ...originalAppLockState,
      pwdStatus: -1 as PasswordStatus,
    });
    setBiometrics({
      authEnabled: false,
      supportedBiometryType: null,
      devicePasscodeAvailable: false,
    });
  });

  afterEach(() => {
    act(() => {
      storeApiLock.setAppLock(originalAppLockState);
      setBiometrics(originalBiometricsState);
    });
    jest.restoreAllMocks();
  });

  it('reconciles a transient no-auth selection when wallet auth becomes ready', () => {
    const { result } = renderHook(() =>
      useAuthenticationModal({
        authTypes: ['biometrics', 'password'],
      }),
    );

    expect(result.current.currentAuthType).toBe('none');
    expect(result.current.disableValidation).toBe(true);

    act(() => {
      storeApiLock.setAppLock(current => ({
        ...current,
        pwdStatus: PasswordStatus.Custom,
      }));
      setBiometrics({
        authEnabled: true,
        supportedBiometryType: 'Fingerprint',
        devicePasscodeAvailable: true,
      });
    });

    expect(result.current.disableValidation).toBe(false);
    expect(result.current.currentAuthType).toBe('biometrics');
  });
});
