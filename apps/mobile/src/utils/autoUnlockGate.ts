type AutoUnlockGateOptions = {
  isAtUnlock: () => boolean;
  dispatch: () => void;
};

export function createAutoUnlockGate({
  isAtUnlock,
  dispatch,
}: AutoUnlockGateOptions) {
  let screenReady = false;
  let pending = false;

  const dispatchIfReady = () => {
    if (!screenReady || !pending || !isAtUnlock()) {
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
