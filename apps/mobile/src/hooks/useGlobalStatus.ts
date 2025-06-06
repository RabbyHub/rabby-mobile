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
        console.log(
          '--- 捕获到成功响应 ---',
          response.config.url,
          response.status,
        );
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
        console.error(
          '--- 捕获到错误响应 ---',
          error.config.url,
          error.message,
        );
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
    setNetWorkStatus(false);
    setServiceStatus({});
  }, [setNetWorkStatus, setServiceStatus]);

  return {
    netWorkStatus,
    serviceStatus,
    setNetWorkStatus,
    setServiceStatus,
    initRequestHooks,
    clearStatus,
  };
};
