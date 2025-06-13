import { useMemo } from 'react';
import { useNetInfo, configure } from '@react-native-community/netinfo';

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

export const useGlobalStatus = () => {
  const { isInternetReachable } = useNetInfo();

  const isDisConnnect = useMemo(() => {
    return isInternetReachable === false;
  }, [isInternetReachable]);

  return {
    isDisConnnect,
  };
};
