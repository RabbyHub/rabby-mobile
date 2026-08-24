type AutoUnlockPresentationPolicyOptions = {
  isIOS: boolean;
  bootSplashExited: boolean;
  setPresentationReady: (ready: boolean) => void;
};

type TransitionContext = {
  isUnlockRoute: boolean;
  closing: boolean;
};

/**
 * Keeps platform-specific system-prompt timing at the navigation boundary.
 * The Unlock screen only owns its authentication subscription and action.
 */
export function createAutoUnlockPresentationPolicy({
  isIOS,
  bootSplashExited: initialBootSplashExited,
  setPresentationReady,
}: AutoUnlockPresentationPolicyOptions) {
  let bootSplashExited = initialBootSplashExited;

  return {
    onRouteChange(isUnlockRoute: boolean) {
      if (!isUnlockRoute) {
        setPresentationReady(false);
      }
    },
    onInitialRouteReady(isUnlockRoute: boolean) {
      if (isUnlockRoute && (!isIOS || bootSplashExited)) {
        setPresentationReady(true);
      } else if (isUnlockRoute) {
        setPresentationReady(false);
      }
    },
    onBootSplashExited(isUnlockRoute: boolean) {
      bootSplashExited = true;

      if (isIOS && isUnlockRoute) {
        setPresentationReady(true);
      }
    },
    onTransitionStart({ isUnlockRoute, closing }: TransitionContext) {
      if (!isUnlockRoute) {
        return;
      }

      if (closing) {
        setPresentationReady(false);
        return;
      }

      setPresentationReady(!isIOS);
    },
    onTransitionEnd({ isUnlockRoute, closing }: TransitionContext) {
      if (!isIOS || !isUnlockRoute || closing || !bootSplashExited) {
        return;
      }

      setPresentationReady(true);
    },
  };
}
