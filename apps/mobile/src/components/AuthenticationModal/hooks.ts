import React, { useMemo } from 'react';

import { apisKeychain, apisLock } from '@/core/apis';
import { useBiometricsComputed } from '@/hooks/biometrics';
import { useRefState } from '@/hooks/common/useRefState';
import { usePasswordStatus } from '@/hooks/useLock';
import { ValidationBehaviorOnFinishedContext } from '@/core/apis/lock';

export const enum BioAuthStage {
  idle = 0,
  prepare = 1,
  authenticating = 2,
}

export function coerceAuthType(
  target: apisLock.UIAuthType,
  avaiables: apisLock.UIAuthType[],
): apisLock.UIAuthType {
  if (!avaiables.length) return 'password';

  return avaiables.includes(target) ? target : avaiables[0] || 'password';
}

export function filterAuthTypes(
  authTypes: apisLock.UIAuthType[],
  context: {
    isBiometricsEnabled: boolean;
    isUseCustomPwd: boolean;
  },
) {
  const { isBiometricsEnabled, isUseCustomPwd } = context;
  let types = authTypes.filter(type => {
    if (type === 'none') return true;
    if (isUseCustomPwd) {
      return (
        type === 'password' || (type === 'biometrics' && isBiometricsEnabled)
      );
    }

    return false;
  });

  if (types.length === 0) {
    console.warn('No available auth type, fallback to password');
    types = isUseCustomPwd ? ['password'] : ['none'];
  }

  if (types.length > 1 && types.some(x => x === 'none')) {
    console.warn(
      '`none` authType is not allowed with other types, trimming it.',
    );
    types = types.filter(x => x !== 'none');
  }

  return {
    availableAuthTypes: types,
    disableValidation: (['biometrics', 'password'] as const).every(
      x => !types.includes(x),
    ),
  };
}

export function useAuthenticationModal(options: {
  authTypes: apisLock.UIAuthType[];
}) {
  const { authTypes } = options;

  const { isUseCustomPwd } = usePasswordStatus();
  const bioComputed = useBiometricsComputed();

  const onFinishedReturnBase = useMemo(
    () => ({ hasSetupCustomPassword: isUseCustomPwd }),
    [isUseCustomPwd],
  );

  const { availableAuthTypes, disableValidation } = useMemo(() => {
    return filterAuthTypes(authTypes, {
      isBiometricsEnabled: bioComputed.isBiometricsEnabled,
      isUseCustomPwd,
    });
  }, [authTypes, isUseCustomPwd, bioComputed.isBiometricsEnabled]);

  const { stateRef: bioAuthRef, setRefState: setBioAuth } = useRefState({
    stage: BioAuthStage.idle,
    restCount: 0,
  });
  const [currentAuthType, setCurrentAuthType] =
    React.useState<apisLock.UIAuthType>(
      coerceAuthType(availableAuthTypes[0], availableAuthTypes),
    );

  const handleAuthWithBiometrics = React.useCallback(async () => {
    const result: ValidationBehaviorOnFinishedContext & { success: boolean } = {
      ...onFinishedReturnBase,
      authType: 'biometrics',
      success: false,
      getValidatedPassword: () => '',
    };
    if (bioAuthRef.current.stage === BioAuthStage['authenticating'])
      return result;

    setBioAuth(prev => ({ ...prev, stage: BioAuthStage['authenticating'] }));

    try {
      if (!disableValidation) {
        await apisKeychain.requestGenericPassword({
          purpose: apisKeychain.RequestGenericPurpose.DECRYPT_PWD,
          onPlainPassword: async password => {
            result.success = true;
            result.getValidatedPassword = () => password;
          },
        });
      }
    } catch (err: any) {
      console.error(err);
      setCurrentAuthType(coerceAuthType('password', availableAuthTypes));
    } finally {
      setBioAuth(prev => ({
        ...prev,
        stage: BioAuthStage['idle'],
        restCount: 0,
      }));
    }

    return result;
  }, [
    availableAuthTypes,
    bioAuthRef,
    setBioAuth,
    disableValidation,
    onFinishedReturnBase,
  ]);

  const prepareBioAuth = React.useCallback(() => {
    setBioAuth(prev => ({
      ...prev,
      stage: BioAuthStage['prepare'],
      restCount: 1,
    }));
  }, [setBioAuth]);

  const updateAuthType = React.useCallback(
    (type: apisLock.UIAuthType) => {
      setCurrentAuthType(coerceAuthType(type, availableAuthTypes));
    },
    [availableAuthTypes],
  );

  return {
    currentAuthType,
    updateAuthType,
    disableValidation,
    prepareBioAuth,
    isBiometricsActive: bioAuthRef.current.stage !== BioAuthStage['idle'],
    handleAuthWithBiometrics,
  };
}
