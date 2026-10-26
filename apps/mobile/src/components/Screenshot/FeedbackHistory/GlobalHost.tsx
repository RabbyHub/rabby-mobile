import React from 'react';

import { registerAppScreen } from '@/perfs/apis';

const LazyFeedbackHistoryBottomSheet = registerAppScreen<
  typeof import('./BottomSheet').FeedbackHistoryBottomSheet
>({
  loader: () =>
    import('./BottomSheet').then(m => ({
      default: m.FeedbackHistoryBottomSheet,
    })),
});

export function FeedbackHistoryHost() {
  return <LazyFeedbackHistoryBottomSheet />;
}
