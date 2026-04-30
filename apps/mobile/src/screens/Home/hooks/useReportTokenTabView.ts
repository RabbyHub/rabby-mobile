import { useEffect } from 'react';
import usePrevious from 'react-use/lib/usePrevious';

import { HomeTabName } from '@/hooks/navigation';
import { matomoRequestEvent } from '@/utils/analytics';

export function useReportTokenTabView(params: {
  focusedTab?: HomeTabName;
  tokenDisplayModeLabel: string;
}) {
  const { focusedTab, tokenDisplayModeLabel } = params;
  const prevFocusedTab = usePrevious(focusedTab);

  useEffect(() => {
    if (focusedTab !== HomeTabName.token) {
      return;
    }
    if (prevFocusedTab === HomeTabName.token) {
      return;
    }

    matomoRequestEvent({
      category: 'HomeTab',
      action: 'HomeTab_ViewToken',
      label: tokenDisplayModeLabel,
    });
  }, [focusedTab, prevFocusedTab, tokenDisplayModeLabel]);
}
