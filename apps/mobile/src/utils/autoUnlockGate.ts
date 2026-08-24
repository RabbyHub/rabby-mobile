type AutoUnlockGateOptions = {
  isAtUnlock: () => boolean;
  dispatch: () => void;
};

export function createAutoUnlockGate({
  isAtUnlock,
  dispatch,
}: AutoUnlockGateOptions) {
  let screenReady = false;
  let presentationReady = false;
  let pending = false;

  const dispatchIfReady = () => {
    if (!screenReady || !presentationReady || !pending || !isAtUnlock()) {
      return;
    }

    pending = false;
    dispatch();
  };

  return {
    request() {
      if (!screenReady && !isAtUnlock()) {
        return;
      }

      pending = true;
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
    },
    dispatchIfReady,
  };
}
