import type { SimpleChartMessage } from '@/components2024/TradingViewCandleChart/type';

export type SimplePriceAxisCommand = Omit<
  Extract<SimpleChartMessage, { action: 'priceAxis' }>,
  'type' | 'identity' | 'sequence' | 'session'
>;

let nextGesture = 0;

/** Keep touch-frequency updates local and send only the latest offset per frame. */
export function createSimplePriceAxisDrag(
  send: (command: SimplePriceAxisCommand) => void,
) {
  let drag: { id: number; startY: number; deltaY: number } | null = null;
  let frame: number | null = null;
  const clearFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const publish = (phase: SimplePriceAxisCommand['phase']) => {
    if (drag)
      send({
        action: 'priceAxis',
        phase,
        gestureId: drag.id,
        deltaY: drag.deltaY,
      });
  };
  const cancel = () => {
    clearFrame();
    publish('cancel');
    drag = null;
  };
  return {
    start(y: number) {
      cancel();
      if (!Number.isFinite(y)) return;
      drag = { id: ++nextGesture, startY: y, deltaY: 0 };
      publish('start');
    },
    move(y: number) {
      if (!drag || !Number.isFinite(y)) return;
      drag.deltaY = y - drag.startY;
      if (frame === null)
        frame = requestAnimationFrame(() => {
          frame = null;
          publish('move');
        });
    },
    end(y: number) {
      if (!drag) return;
      clearFrame();
      if (Number.isFinite(y)) drag.deltaY = y - drag.startY;
      publish('end');
      drag = null;
    },
    cancel,
  };
}
