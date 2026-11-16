// Kept independent of browser stores and Perps modules: the root navigator
// only delivers a native appearance event; the entry owns the close action.
export const createBrowserPerpsNavigation = () => {
  let nextId = 0;
  let pending: { id: number; onReady: () => void } | undefined;

  return {
    begin(onReady: () => void) {
      if (pending) {
        return undefined;
      }
      const id = ++nextId;
      pending = { id, onReady };
      return {
        id,
        isPending: () => pending?.id === id,
        cancel: () => {
          if (pending?.id === id) {
            pending = undefined;
          }
        },
      };
    },
    onTransitionEnd({
      requestId,
      closing,
      isFocused,
    }: {
      requestId?: number;
      closing: boolean;
      isFocused: boolean;
    }) {
      if (!pending || pending.id !== requestId || closing || !isFocused) {
        return;
      }
      const { onReady } = pending;
      pending = undefined;
      onReady();
    },
  };
};

export const browserPerpsNavigation = createBrowserPerpsNavigation();
