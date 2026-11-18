import React from 'react';

type SetBackdropColor = (color: string | null) => void;

/**
 * Lets the screen that is currently visible declare the colour of the strip the
 * foldable system column is drawn over.
 *
 * The default is the page background token, so ordinary screens blend in without
 * doing anything. A screen whose background differs (gradient header, coloured
 * sheet, image backdrop) can opt in and keep the strip seamless.
 *
 * `null` means "no override"; it is also what unmounting restores.
 */
export const SafeWindowBackdropContext =
  React.createContext<SetBackdropColor | null>(null);

/**
 * Declare the backdrop colour for the reserved system-column strip.
 *
 * No-op on every device that does not mount the frame (non-foldables export
 * `React.Fragment`), so ordinary phones never pay for this.
 */
export function useSafeWindowBackdrop(color?: string | null) {
  const setBackdropColor = React.useContext(SafeWindowBackdropContext);

  React.useEffect(() => {
    if (!setBackdropColor) {
      return;
    }
    setBackdropColor(color ?? null);
    return () => setBackdropColor(null);
  }, [color, setBackdropColor]);
}
