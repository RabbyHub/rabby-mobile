/**
 * Dismiss a covering sheet/modal only after a navigation has started.
 *
 * Closing first unmounts the sheet while the stack still shows the screen
 * underneath, which then paints for a few hundred milliseconds — the "flash
 * back to the wallet home" reported when opening an address detail from the
 * wallets sheet.
 *
 * Two animation frames are enough for the pushed screen to commit and for the
 * native stack to lay it out, so the sheet disappears once there is already a
 * destination behind it.
 */
export function navigateThenDismiss(
  navigateFn: () => void,
  dismiss?: () => void,
) {
  navigateFn();
  if (!dismiss) {
    return;
  }
  const raf: (cb: (time: number) => void) => unknown =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 16);
  raf(() => raf(() => dismiss()));
}
