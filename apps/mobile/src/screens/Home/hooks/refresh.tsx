import { zCreate } from '@/core/utils/reexports';
import {
  AssetsRefresthState,
  eventBus,
  EventBusListeners,
} from '@/utils/events';
import { useCallback, useEffect } from 'react';

const assetsRefreshStateStore = zCreate<AssetsRefresthState>(() => ({
  singleTokenNonce: 0,
  singleDeFiNonce: 0,
  singleNFTNonce: 0,
  tokenNonce: 0,
  deFiNonce: 0,
  nftNonce: 0,
}));

// function setAssetsRefreshStateStore(
//   valOrFunc: UpdaterOrPartials<AssetsRefresthState>,
// ) {
//   assetsRefreshStateStore.setState(prev => {
//     const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc);

//     if (changed) return newVal;

//     return prev;
//   });
// }

export const useTriggerTagAssets = () => {
  return {
    singleTokenRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleTokenNonce');
    }, []),
    singleDeFiRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleDeFiNonce');
    }, []),
    singleNFTRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleNFTNonce');
    }, []),
    tokenRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'tokenNonce');
    }, []),
    deFiRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'deFiNonce');
    }, []),
    nftRefresh: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'nftNonce');
    }, []),
  };
};

export function useSingleTokenRefresh({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  useEffect(() => {
    const onRequestRefreshAssets: EventBusListeners['EVENT_REFRESH_ASSET'] =
      type => {
        if (type !== 'singleTokenNonce') return;
        onRefresh();
      };
    eventBus.on('EVENT_REFRESH_ASSET', onRequestRefreshAssets);

    return () => {
      eventBus.off('EVENT_REFRESH_ASSET', onRequestRefreshAssets);
    };
  }, [onRefresh]);

  return {
    triggerRefreshSingleToken: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleTokenNonce');
    }, []),
  };
}

export function useSingleDeFiRefresh({ onRefresh }: { onRefresh: () => void }) {
  useEffect(() => {
    const onRequestRefreshAssets: EventBusListeners['EVENT_REFRESH_ASSET'] =
      type => {
        if (type !== 'singleDeFiNonce') return;
        onRefresh();
      };
    eventBus.on('EVENT_REFRESH_ASSET', onRequestRefreshAssets);

    return () => {
      eventBus.off('EVENT_REFRESH_ASSET', onRequestRefreshAssets);
    };
  }, [onRefresh]);

  return {
    triggerRefreshSingleDeFi: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleDeFiNonce');
    }, []),
  };
}

export function useSingleNftRefresh({ onRefresh }: { onRefresh: () => void }) {
  useEffect(() => {
    const onRequestRefreshAssets: EventBusListeners['EVENT_REFRESH_ASSET'] =
      type => {
        if (type !== 'singleNFTNonce') return;
        onRefresh();
      };
    eventBus.on('EVENT_REFRESH_ASSET', onRequestRefreshAssets);

    return () => {
      eventBus.off('EVENT_REFRESH_ASSET', onRequestRefreshAssets);
    };
  }, [onRefresh]);

  return {
    triggerRefreshSingleNft: useCallback(() => {
      eventBus.emit('EVENT_REFRESH_ASSET', 'singleNFTNonce');
    }, []),
  };
}
