import { simpleDraggedPriceRange } from './perps-simple-axis.ts';
import type { SimpleChartMessage } from './types';

type PriceRange = { from: number; to: number };
type Command = Extract<SimpleChartMessage, { action: 'priceAxis' }>;

/** Native iOS gestures share the existing Android zoom math, not DOM events. */
export function createSimpleNativePriceAxis(options: {
  isActive: () => boolean;
  getRange: () => PriceRange | null;
  getHeight: () => number;
  setRange: (range: PriceRange) => void;
  onStart: () => void;
}) {
  let session = 0;
  let lastGestureId = -1;
  let drag: {
    id: number;
    range: PriceRange;
    height: number;
    moved: boolean;
  } | null = null;
  return {
    get session() {
      return session;
    },
    get dragging() {
      return drag !== null;
    },
    cancel() {
      drag = null;
      session++;
    },
    handle(command: Command) {
      if (
        !options.isActive() ||
        command.session !== session ||
        !Number.isFinite(command.deltaY) ||
        !Number.isSafeInteger(command.gestureId)
      )
        return false;
      if (command.phase === 'start') {
        if (command.gestureId <= lastGestureId) return false;
        lastGestureId = command.gestureId;
        const range = options.getRange();
        const height = options.getHeight();
        if (!range || !simpleDraggedPriceRange(range, 0, height)) return false;
        drag = {
          id: command.gestureId,
          range: { ...range },
          height,
          moved: false,
        };
        options.onStart();
        return true;
      }
      if (!drag || drag.id !== command.gestureId) return false;
      if (command.phase === 'cancel') {
        drag = null;
        return true;
      }
      if (command.deltaY !== 0 || drag.moved) {
        const range = simpleDraggedPriceRange(
          drag.range,
          command.deltaY,
          drag.height,
        );
        if (range) {
          options.setRange(range);
          drag.moved = true;
        }
      }
      if (command.phase === 'end') drag = null;
      return true;
    },
  };
}
