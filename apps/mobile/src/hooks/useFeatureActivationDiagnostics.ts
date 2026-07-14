import { useIsFocused } from '@react-navigation/native';
import React from 'react';

import {
  ensureFeatureActivation,
  markFeatureActivation,
  type FeatureActivationName,
} from '@/core/utils/featureActivationDiagnostics';

export function useFeatureActivationDiagnostics(
  feature: FeatureActivationName,
) {
  const isFocused = useIsFocused();
  const cycleIdRef = React.useRef(0);

  React.useEffect(() => {
    const cycleId = ensureFeatureActivation(feature, 'screen_mounted_fallback');
    cycleIdRef.current = cycleId;
    markFeatureActivation(feature, 'mounted', {
      cycleId,
      reason: 'screen_mounted',
    });

    return () => {
      markFeatureActivation(feature, 'exited', {
        cycleId,
        reason: 'screen_unmounted_or_feature_changed',
      });
    };
  }, [feature]);

  React.useEffect(() => {
    if (!isFocused) {
      return;
    }

    const cycleId = ensureFeatureActivation(feature, 'screen_refocused');
    if (cycleIdRef.current !== cycleId) {
      cycleIdRef.current = cycleId;
      markFeatureActivation(feature, 'mounted', {
        cycleId,
        reason: 'retained_screen_reactivated',
      });
    }

    markFeatureActivation(feature, 'visible', {
      cycleId,
      reason: 'navigation_focused',
    });

    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        markFeatureActivation(feature, 'interactive', {
          cycleId,
          reason: 'two_frames_after_focus',
        });
      });
    });

    return () => {
      if (firstFrame !== null) {
        cancelAnimationFrame(firstFrame);
      }
      if (secondFrame !== null) {
        cancelAnimationFrame(secondFrame);
      }
      markFeatureActivation(feature, 'exited', {
        cycleId,
        reason: 'navigation_focus_ended',
      });
    };
  }, [feature, isFocused]);
}
