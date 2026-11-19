import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

import { IS_IOS } from '@/core/native/utils';
import type { RootScenePagerGestureMode } from '@rabby-wallet/rn-collapsible-scene-view';

/**
 * Keep the iOS root-stack pop gesture in sync with a root scene pager.
 *
 * - `edge-handoff` (A): the native gesture is always enabled while the pager is
 *   mounted. The pager releases every rightward drag that starts on the back
 *   edge, so the system pop owns it; the explicit enable is the second half of
 *   the guarantee in case another sheet/hook left the root gesture disabled.
 * - `boundary-handoff` (B): only the pager's first page keeps the native
 *   gesture; later pages need edge drags themselves, so the root gesture is
 *   turned off while they are active.
 *
 * The parent option is restored on unmount.
 */
export function useRootScenePagerBackGesture({
  gestureMode,
  atFirstPage,
}: {
  gestureMode: RootScenePagerGestureMode;
  atFirstPage: boolean;
}) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!IS_IOS) {
      return;
    }
    // Tests and non-navigator hosts can expose a partial navigation object.
    const root = navigation?.getParent?.();
    const enabled = gestureMode === 'edge-handoff' ? true : atFirstPage;
    root?.setOptions({ gestureEnabled: enabled });
    return () => {
      root?.setOptions({ gestureEnabled: true });
    };
  }, [atFirstPage, gestureMode, navigation]);
}
