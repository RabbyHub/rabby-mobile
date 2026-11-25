import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { usePerpsFundingHistoryJournal } from '@/hooks/perps/funding/usePerpsFundingHistoryJournal';
import { usePerpsRuntimeStatus } from '@/hooks/perps/runtime/usePerpsRuntimeStatus';

/** One route owner: retaining Simple and Pro must not duplicate reconciliation. */
export function PerpsFundingHistoryOwner() {
  const focused = useIsFocused();
  const runtime = usePerpsRuntimeStatus();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  usePerpsFundingHistoryJournal({
    enabled: runtime.status === 'ready' && focused && appState === 'active',
  });
  return null;
}
