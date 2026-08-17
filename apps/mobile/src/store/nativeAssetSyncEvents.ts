import { addNativeAssetSyncCompletionListener } from '@/core/native/RNHelpers';

import { dispatchNativeAssetSyncCompletion } from './nativeAssetSyncReceipt';

let nativeAssetSyncEventsStarted = false;

export const ensureNativeAssetSyncEventsStarted = () => {
  if (nativeAssetSyncEventsStarted) {
    return;
  }
  addNativeAssetSyncCompletionListener(completion => {
    dispatchNativeAssetSyncCompletion(completion).catch(error => {
      console.error('Native asset sync completion failed:', error);
    });
  });
  nativeAssetSyncEventsStarted = true;
};
