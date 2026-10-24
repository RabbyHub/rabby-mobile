/** Native cancellation may report momentum end between pages. Never round it
 * into a business selection, or let an old animator end a new finger drag.
 */
export function getLinkedScrollSettlement(
  progress: number,
  pageCount: number,
  dragging: boolean,
): number | null {
  'worklet';
  if (dragging || !Number.isFinite(progress) || pageCount < 1) {
    return null;
  }
  const index = Math.round(progress);
  return index >= 0 && index < pageCount && Math.abs(progress - index) < 0.001
    ? index
    : null;
}
