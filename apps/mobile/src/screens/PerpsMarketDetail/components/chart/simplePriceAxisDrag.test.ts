import { createSimplePriceAxisDrag } from './simplePriceAxisDrag';

describe('Simple native price-axis bridge batching (unit)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('coalesces moves and flushes the final position before releasing', () => {
    const send = jest.fn();
    const drag = createSimplePriceAxisDrag(send);
    drag.start(100);
    drag.move(110);
    drag.move(125);
    expect(send).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(20);
    expect(send.mock.calls[1][0]).toMatchObject({ phase: 'move', deltaY: 25 });
    drag.move(140);
    drag.end(150);
    jest.runAllTimers();
    expect(send.mock.calls.map(([command]) => command.phase)).toEqual([
      'start',
      'move',
      'end',
    ]);
    expect(send.mock.calls[2][0]).toMatchObject({
      deltaY: 50,
      gestureId: send.mock.calls[0][0].gestureId,
    });
    drag.move(180);
    drag.end(180);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('cancels pending movement and assigns a fresh ID to a new gesture', () => {
    const send = jest.fn();
    const drag = createSimplePriceAxisDrag(send);
    drag.start(100);
    const firstId = send.mock.calls[0][0].gestureId;
    drag.move(120);
    drag.cancel();
    drag.cancel();
    jest.runAllTimers();
    expect(send.mock.calls.map(([command]) => command.phase)).toEqual([
      'start',
      'cancel',
    ]);
    drag.start(200);
    drag.move(190);
    jest.advanceTimersByTime(20);
    expect(send.mock.calls[3][0]).toMatchObject({ phase: 'move', deltaY: -10 });
    expect(send.mock.calls[3][0].gestureId).toBeGreaterThan(firstId);
    drag.cancel();
  });
});
