import { useCallback, useEffect, useMemo } from 'react';
import { useNetInfo, configure } from '@react-native-community/netinfo';
import { atom, useAtom } from 'jotai';

configure({
  reachabilityUrl: 'https://app-api.rabby.io/ping',
  reachabilityMethod: 'GET',
  reachabilityTest: async response => response.status === 200,
  reachabilityLongTimeout: 10 * 1000, // 10s
  reachabilityShortTimeout: 2 * 1000, // 2s
  reachabilityRequestTimeout: 15 * 1000, // 15s
  reachabilityShouldRun: () => true,
  useNativeReachability: false,
});

export const enum ServiceErrorType {
  'Curve' = 'Curve',
  'SingleCurve' = 'SingleCurve',
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
    ServiceErrorType.SingleCurve,
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
  const { isInternetReachable } = useNetInfo();
  const [serviceErrorMap, setServiceErrorMap] = useAtom(serviceErrorMapAtom);

  const isDisConnnect = useMemo(() => {
    return isInternetReachable === false;
  }, [isInternetReachable]);

  const errorType: ErrorType = useMemo(() => {
    if (isDisConnnect) {
      return 'network';
    }
    if (serviceKeys?.some(key => serviceErrorMap[key])) {
      return 'service';
    }
    return undefined;
  }, [isDisConnnect, serviceErrorMap, serviceKeys]);

  useEffect(() => {
    if (errorType === 'network') {
      // ignore all "service error" when "network error"
      setServiceErrorMap({});
    }
  }, [errorType, setServiceErrorMap]);

  const setTargetServicesError = useCallback(
    (keys: ServiceErrorType[], target: boolean) => {
      if (isDisConnnect && target) {
        // 如果网络断开，忽略服务错误
        return;
      }
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
    [isDisConnnect, setServiceErrorMap],
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
