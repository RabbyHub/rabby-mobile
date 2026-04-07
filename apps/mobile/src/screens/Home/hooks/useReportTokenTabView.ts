import { useEffect } from 'react';
import usePrevious from 'react-use/lib/usePrevious';

import { TabName } from '@/screens/Address/components/MultiAssets/TabsMultiAssets';
import { matomoRequestEvent } from '@/utils/analytics';

export function useReportTokenTabView(params: {
  focusedTab?: TabName;
  tokenDisplayModeLabel: string;
}) {
  const { focusedTab, tokenDisplayModeLabel } = params;
  const prevFocusedTab = usePrevious(focusedTab);

  useEffect(() => {
    if (focusedTab !== TabName.token) {
      return;
    }
    if (prevFocusedTab === TabName.token) {
      return;
    }

    matomoRequestEvent({
      category: 'HomeTab',
      action: 'HomeTab_ViewToken',
      label: tokenDisplayModeLabel,
    });
  }, [focusedTab, prevFocusedTab, tokenDisplayModeLabel]);
}
