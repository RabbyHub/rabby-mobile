import { useCallback, useMemo } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { atom, useAtom } from 'jotai';

export const enum ServiceErrorType {
  'Curve' = 'Curve',
  'Balance' = 'Balance',
  'Tokens' = 'Tokens',
  'Defi' = 'Defi',
  'NFT' = 'NFT',
}
export const PageMainServices = {
  MultiHome: [ServiceErrorType.Balance, ServiceErrorType.Curve],
  MultiAssets: [
    ServiceErrorType.Balance,
    ServiceErrorType.Curve,
    ServiceErrorType.Tokens,
    ServiceErrorType.Defi,
  ],
  SingleHome: [
    ServiceErrorType.Balance,
    ServiceErrorType.Curve,
    ServiceErrorType.Tokens,
    ServiceErrorType.Defi,
    ServiceErrorType.NFT,
  ],
};
export type ErrorType = 'network' | 'service' | undefined;

export const serviceErrorMapAtom = atom<
  Partial<Record<ServiceErrorType, boolean>>
>({});

export const useGlobalStatus = (serviceKeys: ServiceErrorType[] = []) => {
  const { isInternetReachable, isConnected } = useNetInfo();
  const [serviceErrorMap, setServiceErrorMap] = useAtom(serviceErrorMapAtom);

  const errorType: ErrorType = useMemo(() => {
    if (isInternetReachable === false || isConnected === false) {
      return 'network';
    }
    if (serviceKeys?.some(key => serviceErrorMap[key])) {
      return 'service';
    }
    return undefined;
  }, [isConnected, isInternetReachable, serviceErrorMap, serviceKeys]);

  const setTargetServicesError = useCallback(
    (keys: ServiceErrorType[], target: boolean) => {
      setServiceErrorMap(pre => {
        const tmp = {
          ...pre,
        };
        keys.forEach(key => {
          tmp[key] = target;
        });
        return tmp;
      });
    },
    [setServiceErrorMap],
  );

  const clearServicesError = useCallback(() => {
    setTargetServicesError(serviceKeys, false);
  }, [serviceKeys, setTargetServicesError]);

  const setServicesError = useCallback(() => {
    setTargetServicesError(serviceKeys, true);
  }, [serviceKeys, setTargetServicesError]);

  return {
    errorType,
    setTargetServicesError,
    clearServicesError,
    setServicesError,
  };
};
