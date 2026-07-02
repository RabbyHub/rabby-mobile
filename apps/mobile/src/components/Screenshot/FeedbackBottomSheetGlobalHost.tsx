import React from 'react';

import { registerAppScreen } from '@/perfs/apis';

const LazyFeedbackHistoryBottomSheet = registerAppScreen<
  typeof import('./FeedbackHistory/FeedbackBottomSheet').FeedbackBottomSheet
>({
  loader: () =>
    import('./FeedbackHistory/FeedbackBottomSheet').then(m => ({
      default: m.FeedbackBottomSheet,
    })),
});

export function FeedbackBottomSheetGlobalHost() {
  return <LazyFeedbackHistoryBottomSheet />;
}
