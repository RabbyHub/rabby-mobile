type AutoUnlockPresentationPolicyOptions = {
  isIOS: boolean;
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
  setPresentationReady,
}: AutoUnlockPresentationPolicyOptions) {
  return {
    onRouteChange(isUnlockRoute: boolean) {
      if (!isUnlockRoute) {
        setPresentationReady(false);
      }
    },
    onInitialRouteReady(isUnlockRoute: boolean) {
      if (isUnlockRoute) {
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
      if (!isIOS || !isUnlockRoute || closing) {
        return;
      }

      setPresentationReady(true);
    },
  };
}
