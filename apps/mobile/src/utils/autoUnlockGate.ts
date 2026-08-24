type AutoUnlockGateOptions = {
  isAtUnlock: () => boolean;
  dispatch: () => void;
};

type AutoUnlockRequestOptions = {
  bypassPresentationReady?: boolean;
};

export function createAutoUnlockGate({
  isAtUnlock,
  dispatch,
}: AutoUnlockGateOptions) {
  let screenReady = false;
  let presentationReady = false;
  let pending = false;
  let bypassPresentationReady = false;

  const dispatchIfReady = () => {
    if (
      !screenReady ||
      (!presentationReady && !bypassPresentationReady) ||
      !pending ||
      !isAtUnlock()
    ) {
      return;
    }

    pending = false;
    bypassPresentationReady = false;
    dispatch();
  };

  return {
    request(options: AutoUnlockRequestOptions = {}) {
      if (options.bypassPresentationReady && !isAtUnlock()) {
        return;
      }

      if (!screenReady && !isAtUnlock()) {
        return;
      }

      pending = true;
      bypassPresentationReady =
        bypassPresentationReady || !!options.bypassPresentationReady;
      dispatchIfReady();
    },
    setPresentationReady(ready: boolean) {
      presentationReady = ready;
      dispatchIfReady();
    },
    setScreenReady(ready: boolean) {
      screenReady = ready;
      if (!ready) {
        this.clearPending();
        return;
      }

      dispatchIfReady();
    },
    clearPending() {
      pending = false;
      bypassPresentationReady = false;
    },
    dispatchIfReady,
  };
}
