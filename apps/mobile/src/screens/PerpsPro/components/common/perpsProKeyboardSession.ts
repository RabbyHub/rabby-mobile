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
};

/** Local UI ownership only. A late blur may never clear another input's hint. */
export const createPerpsProKeyboardSession = () => {
  let enabled = false;
  let focused: FocusedInput | null = null;
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
      if (!next && focused) {
        const previous = focused;
        focused = null;
        publish();
        previous.input.blur();
      }
    },
    focus: (input: FocusedInput) => {
      if (!enabled) {
        return;
      }
      focused = input;
      publish();
    },
    blur: (id: string) => {
      if (focused?.id !== id) {
        return;
      }
      focused = null;
      publish();
    },
    updateMinimum: (id: string, minimum: string | null) => {
      if (focused?.id !== id || focused.minimum === minimum) {
        return;
      }
      focused = { ...focused, minimum };
      publish();
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
