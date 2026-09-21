import { useCallback, useRef } from 'react';
import { IS_LOCAL_STORAGE_EXPORT_ENABLED } from '@/constant/env';
import { promptLocalStorageArchiveShare } from '@/utils/promptLocalStorageArchive';

const TAP_INTERVAL_MS = 500;

/** Hidden diagnostic entry only. The shared prompt still requires confirmation. */
export function useLocalStorageArchiveGesture(tapCount: number) {
  const rapidTapRef = useRef({ count: 0, lastTappedAt: 0 });

  return useCallback(() => {
    if (!IS_LOCAL_STORAGE_EXPORT_ENABLED) {
      return;
    }

    const now = Date.now();
    const count =
      now - rapidTapRef.current.lastTappedAt <= TAP_INTERVAL_MS
        ? rapidTapRef.current.count + 1
        : 1;
    rapidTapRef.current = { count, lastTappedAt: now };

    if (count >= tapCount) {
      rapidTapRef.current = { count: 0, lastTappedAt: 0 };
      promptLocalStorageArchiveShare();
    }
  }, [tapCount]);
}
