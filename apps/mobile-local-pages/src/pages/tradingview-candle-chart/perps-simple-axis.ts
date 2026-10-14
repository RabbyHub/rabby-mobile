type PriceRange = { from: number; to: number };

/** Scale around the original midpoint; use the gesture origin to avoid drift. */
export function simpleDraggedPriceRange(
  range: PriceRange,
  deltaY: number,
  height: number,
) {
  if (
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isFinite(deltaY) ||
    !Number.isFinite(range.from) ||
    !Number.isFinite(range.to) ||
    range.to <= range.from
  )
    return null;
  const span =
    (range.to - range.from) *
    Math.exp(Math.max(-6, Math.min(6, (deltaY / height) * 2)));
  const middle = range.from / 2 + range.to / 2;
  const next = { from: middle - span / 2, to: middle + span / 2 };
  return Number.isFinite(next.from) &&
    Number.isFinite(next.to) &&
    next.to > next.from
    ? next
    : null;
}

/** Only the axis captures vertical touch. The plot retains pan-y page scrolling. */
export function attachSimplePriceAxis(
  host: HTMLElement,
  options: {
    isActive: () => boolean;
    getRange: () => PriceRange | null;
    setRange: (range: PriceRange) => void;
    onStart: () => void;
  },
) {
  const axis = document.createElement('div');
  axis.dataset.simplePriceAxis = '';
  Object.assign(axis.style, {
    position: 'absolute',
    top: '0',
    right: '0',
    zIndex: '4',
    touchAction: 'none',
    cursor: 'ns-resize',
  });
  host.appendChild(axis);
  let height = 0;
  let drag: {
    pointerId: number;
    y: number;
    range: PriceRange;
    height: number;
  } | null = null;
  let pending: PriceRange | null = null;
  let frame: number | null = null;
  function flush() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (pending && options.isActive()) options.setRange(pending);
    pending = null;
  }
  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pending = null;
    const previous = drag;
    drag = null;
    if (previous && axis.hasPointerCapture(previous.pointerId))
      axis.releasePointerCapture(previous.pointerId);
  }
  const cancelOnSecondContact = (event: PointerEvent) => {
    if (drag && event.pointerId !== drag.pointerId) cancel();
  };
  window.addEventListener('pointerdown', cancelOnSecondContact, true);
  window.addEventListener('blur', cancel);
  axis.addEventListener('pointerdown', event => {
    event.stopPropagation();
    if (drag) {
      cancel();
      return;
    }
    if (
      !options.isActive() ||
      !event.isPrimary ||
      event.button !== 0 ||
      height <= 0
    )
      return;
    const range = options.getRange();
    if (!range) return;
    event.preventDefault();
    options.onStart();
    drag = { pointerId: event.pointerId, y: event.clientY, range, height };
    axis.setPointerCapture(event.pointerId);
  });
  axis.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    pending = simpleDraggedPriceRange(
      drag.range,
      event.clientY - drag.y,
      drag.height,
    );
    if (frame === null) frame = requestAnimationFrame(flush);
  });
  axis.addEventListener('pointerup', event => {
    if (drag?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    flush();
    cancel();
  });
  axis.addEventListener('pointercancel', cancel);
  axis.addEventListener('lostpointercapture', cancel);
  // Do not let compatibility events start a plot selection/drag on the host.
  for (const name of [
    'touchstart',
    'touchmove',
    'touchend',
    'touchcancel',
    'mousedown',
    'mousemove',
  ])
    axis.addEventListener(name, event => event.stopPropagation(), {
      passive: true,
    });
  return {
    layout(paneWidth: number, paneHeight: number) {
      height = paneHeight;
      axis.style.left = `${paneWidth}px`;
      axis.style.height = `${paneHeight}px`;
    },
    cancel,
    destroy() {
      cancel();
      window.removeEventListener('pointerdown', cancelOnSecondContact, true);
      window.removeEventListener('blur', cancel);
      axis.remove();
    },
  };
}
