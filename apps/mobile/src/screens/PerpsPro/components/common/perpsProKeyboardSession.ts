export const PERPS_PRO_KEYBOARD_ACCESSORY_ID = 'perps-pro-keyboard-accessory';
// Figma 83992:157364 is a keyboard accessory, not a screen footer button.
export const PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT = 48;

export type PerpsProKeyboardInput = {
  blur: () => void;
  isFocused: () => boolean;
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

type FocusedInput = {
  id: string;
  input: PerpsProKeyboardInput;
  minimum: string | null;
  scrollTrade: boolean;
  sheetId?: string;
};

/** Local UI ownership only. A late blur may never clear another input's hint. */
export const createPerpsProKeyboardSession = () => {
  let enabled = false;
  let focused: FocusedInput | null = null;
  let pendingFocus: FocusedInput | null = null;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => focused,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled: (next: boolean) => {
      enabled = next;
      if (!next) {
        const previous = focused ?? pendingFocus;
        pendingFocus = null;
        if (focused) {
          focused = null;
          publish();
        }
        previous?.input.blur();
        return;
      }
      const candidate = pendingFocus;
      pendingFocus = null;
      // Native focus can precede the accessory's activation. Adopt only an
      // input which is still focused; never replay a stale focus event.
      if (candidate?.input.isFocused()) {
        focused = candidate;
        publish();
      }
    },
    focus: (input: FocusedInput) => {
      if (!enabled) {
        pendingFocus = input;
        return;
      }
      pendingFocus = null;
      focused = input;
      publish();
    },
    blur: (id: string) => {
      if (pendingFocus?.id === id) {
        pendingFocus = null;
      }
      if (focused?.id !== id) {
        return;
      }
      focused = null;
      publish();
    },
    updateMinimum: (
      id: string,
      minimum: string | null | (() => string | null),
    ) => {
      const current =
        focused?.id === id
          ? focused
          : pendingFocus?.id === id
          ? pendingFocus
          : null;
      if (!current) {
        return;
      }
      // Evaluate an Amount hint only for the current input, not every mounted
      // field or every market update while the keyboard is closed.
      const nextMinimum = typeof minimum === 'function' ? minimum() : minimum;
      if (current.minimum === nextMinimum) {
        return;
      }
      if (current === focused) {
        focused = { ...current, minimum: nextMinimum };
        publish();
      } else {
        pendingFocus = { ...current, minimum: nextMinimum };
      }
    },
  };
};

export const perpsProKeyboardSession = createPerpsProKeyboardSession();

// The main trade inputs are outside the native info list. Reuse that list's
// existing scroll owner only when the keyboard accessory overlaps an input.
let scrollTradeBy: ((distance: number) => void) | null = null;
export const registerPerpsProKeyboardTradeScroll = (
  handler: (distance: number) => void,
) => {
  scrollTradeBy = handler;
  return () => {
    if (scrollTradeBy === handler) {
      scrollTradeBy = null;
    }
  };
};
export const scrollPerpsProTradeAboveKeyboard = (distance: number) => {
  if (distance > 0) {
    scrollTradeBy?.(distance);
  }
};

export const getPerpsProKeyboardAccessoryTop = (
  keyboardScreenY: number,
  hostScreenY: number,
) =>
  Math.max(
    0,
    keyboardScreenY - hostScreenY - PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
  );
