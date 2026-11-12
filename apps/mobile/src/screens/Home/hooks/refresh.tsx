import { eventBus } from '@/utils/events';
import { useCallback } from 'react';

export const useTriggerTagAssets = () => {
  return {
    singleTokenRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleTokenNonce');
    }, []),
    singleDeFiRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleDeFiNonce');
    }, []),
    tokenRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'tokenNonce');
    }, []),
    deFiRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'deFiNonce');
    }, []),
  };
};
