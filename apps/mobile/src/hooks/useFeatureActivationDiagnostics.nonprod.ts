import { useNavigation } from '@react-navigation/native';
import React from 'react';

import {
  ensureFeatureActivation,
  markFeatureActivation,
  type FeatureActivationName,
} from '@/core/utils/featureActivationDiagnostics';

type FeatureActivationNavigation = {
  isFocused: () => boolean;
  addListener: (event: 'focus' | 'blur', listener: () => void) => () => void;
};

type FeatureActivationFrameScheduler = {
  requestFrame: typeof requestAnimationFrame;
  cancelFrame: typeof cancelAnimationFrame;
};

export function observeFeatureActivationNavigation({
  feature,
  navigation,
  frameScheduler = {
    requestFrame: requestAnimationFrame,
    cancelFrame: cancelAnimationFrame,
  },
}: {
  feature: FeatureActivationName;
  navigation: FeatureActivationNavigation;
  frameScheduler?: FeatureActivationFrameScheduler;
}) {
  let cycleId = ensureFeatureActivation(feature, 'screen_mounted_fallback');
  let isVisible = false;
  let firstFrame: number | null = null;
  let secondFrame: number | null = null;

  const cancelInteractiveFrames = () => {
    if (firstFrame !== null) {
      frameScheduler.cancelFrame(firstFrame);
      firstFrame = null;
    }
    if (secondFrame !== null) {
      frameScheduler.cancelFrame(secondFrame);
      secondFrame = null;
    }
  };

  const markMounted = (reason: string) => {
    markFeatureActivation(feature, 'mounted', {
      cycleId,
      reason,
    });
  };

  const handleFocus = () => {
    if (isVisible) {
      return;
    }

    const nextCycleId = ensureFeatureActivation(feature, 'screen_refocused');
    if (cycleId !== nextCycleId) {
      cycleId = nextCycleId;
      markMounted('retained_screen_reactivated');
    }

    isVisible = true;
    markFeatureActivation(feature, 'visible', {
      cycleId,
      reason: 'navigation_focused',
    });

    firstFrame = frameScheduler.requestFrame(() => {
      firstFrame = null;
      secondFrame = frameScheduler.requestFrame(() => {
        secondFrame = null;
        markFeatureActivation(feature, 'interactive', {
          cycleId,
          reason: 'two_frames_after_focus',
        });
      });
    });
  };

  const handleBlur = () => {
    if (!isVisible) {
      return;
    }

    isVisible = false;
    cancelInteractiveFrames();
    markFeatureActivation(feature, 'exited', {
      cycleId,
      reason: 'navigation_focus_ended',
    });
  };

  markMounted('screen_mounted');
  const unsubscribeFocus = navigation.addListener('focus', handleFocus);
  const unsubscribeBlur = navigation.addListener('blur', handleBlur);
  if (navigation.isFocused()) {
    handleFocus();
  }

  return () => {
    unsubscribeFocus();
    unsubscribeBlur();
    cancelInteractiveFrames();
    if (isVisible) {
      markFeatureActivation(feature, 'exited', {
        cycleId,
        reason: 'screen_unmounted_or_feature_changed',
      });
    }
  };
}

export function useFeatureActivationDiagnostics(
  feature: FeatureActivationName,
) {
  const navigation = useNavigation<FeatureActivationNavigation>();

  React.useEffect(
    () =>
      observeFeatureActivationNavigation({
        feature,
        navigation,
      }),
    [feature, navigation],
  );
}
