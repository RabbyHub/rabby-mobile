import { openapi } from '@/core/request';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';

export const netWorkErrorAtom = atom<boolean>(false);
export const serviceErrorAtom = atom<{
  [serviceKey: string]: boolean;
}>({});

export const useGlobalStatus = () => {
  const [netWorkStatus, setNetWorkStatus] = useAtom(netWorkErrorAtom);
  const [serviceStatus, setServiceStatus] = useAtom(serviceErrorAtom);

  const initRequestHooks = useCallback(() => {
    openapi.request.interceptors.response.use(
      response => {
        setNetWorkStatus(false);
        const url = response?.config?.url;
        if (typeof url === 'string') {
          setServiceStatus(pre => ({
            ...pre,
            [url]: !!response?.status && response?.status !== 200,
          }));
        }
        return response;
      },
      error => {
        if (
          typeof error?.message === 'string' &&
          error.message.includes('Network Error')
        ) {
          setNetWorkStatus(true);
        } else {
          if (typeof error?.config?.url === 'string') {
            setServiceStatus(pre => ({
              ...pre,
              [error.config.url]: true,
            }));
          }
        }
        return Promise.reject(error);
      },
    );
  }, [setNetWorkStatus, setServiceStatus]);

  const clearStatus = useCallback(() => {
    setServiceStatus({});
  }, [setServiceStatus]);

  return {
    netWorkStatus,
    serviceStatus,
    setNetWorkStatus,
    setServiceStatus,
    initRequestHooks,
    clearStatus,
  };
};
