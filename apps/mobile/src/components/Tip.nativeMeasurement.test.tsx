import React from 'react';
import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';
import Tooltip from 'react-native-walkthrough-tooltip';
import { constrainGeometryToViewport } from 'react-native-walkthrough-tooltip/src/geom';

it('uses mounted anchor-to-overlay coordinates instead of the Fabric shadow frame', async () => {
  const ref = React.createRef<any>();
  const measureAnchor = jest
    .fn()
    .mockResolvedValue({ x: 320, y: 16, width: 24, height: 24 });
  render(
    <Tooltip
      ref={ref}
      isVisible
      content={<View />}
      measureAnchor={measureAnchor}>
      <View />
    </Tooltip>,
  );
  const anchor = { measure: jest.fn(cb => cb(0, 0, 24, 24, 320, -40)) };
  const viewport = {};
  ref.current.childWrapper.current = anchor;
  ref.current.viewport.current = viewport;
  await act(async () => ref.current.measureChildRect());
  expect(measureAnchor).toHaveBeenCalledWith(anchor, viewport);
  expect(anchor.measure).not.toHaveBeenCalled();
  expect(ref.current.state.childRect).toEqual({
    x: 320,
    y: 16,
    width: 24,
    height: 24,
  });
});

it('ignores a pending native measurement after close', async () => {
  const ref = React.createRef<any>();
  let resolve!: (rect: object) => void;
  const measureAnchor = jest.fn(
    () =>
      new Promise<any>(done => {
        resolve = done;
      }),
  );
  const view = render(
    <Tooltip
      ref={ref}
      isVisible
      content={<View />}
      measureAnchor={measureAnchor}>
      <View />
    </Tooltip>,
  );
  ref.current.childWrapper.current = {};
  ref.current.viewport.current = {};
  await act(async () => ref.current.measureChildRect());
  view.rerender(
    <Tooltip
      ref={ref}
      isVisible={false}
      content={<View />}
      measureAnchor={measureAnchor}>
      <View />
    </Tooltip>,
  );
  await act(async () => resolve({ x: 320, y: 16, width: 24, height: 24 }));
  expect(ref.current.state.childRect).toEqual({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  expect(ref.current.state.measurementsFinished).toBe(false);
});

it('recovers from an unmounted native anchor without falling back to incorrect shadow coordinates', async () => {
  const ref = React.createRef<any>();
  const measureAnchor = jest.fn().mockRejectedValue(new Error('not mounted'));
  render(
    <Tooltip
      ref={ref}
      isVisible
      content={<View />}
      measureAnchor={measureAnchor}>
      <View />
    </Tooltip>,
  );
  ref.current.childWrapper.current = {};
  ref.current.viewport.current = {};
  await act(async () => ref.current.measureChildRect());
  expect(ref.current.isMeasuringChild).toBe(false);
  expect(ref.current.state.measurementsFinished).toBe(false);
  measureAnchor.mockResolvedValueOnce({ x: 320, y: 16, width: 24, height: 24 });
  await act(async () => ref.current.measureChildRect());
  expect(ref.current.state.childRect).toEqual({
    x: 320,
    y: 16,
    width: 24,
    height: 24,
  });
});

it.each(['top', 'bottom', 'left', 'right', 'center'])(
  'keeps the whole %s bubble inside the overlay for edge anchors and oversized content',
  placement => {
    for (const x of [-40, 0, 320, 420]) {
      for (const y of [-80, 0, 760, 900]) {
        for (const contentSize of [
          { width: 200, height: 100 },
          { width: 500, height: 1000 },
        ]) {
          const geometry = constrainGeometryToViewport(
            { placement, tooltipOrigin: { x, y }, anchorPoint: { x, y } },
            {
              windowDims: { width: 360, height: 780 },
              displayInsets: { top: 12, right: 12, bottom: 12, left: 12 },
              contentSize,
              arrowSize: { width: 0, height: 0 },
            },
          );
          expect(geometry.tooltipOrigin.x).toBeGreaterThanOrEqual(12);
          expect(geometry.tooltipOrigin.y).toBeGreaterThanOrEqual(12);
          expect(
            geometry.tooltipOrigin.x + geometry.adjustedContentSize.width,
          ).toBeLessThanOrEqual(348);
          expect(
            geometry.tooltipOrigin.y + geometry.adjustedContentSize.height,
          ).toBeLessThanOrEqual(768);
        }
      }
    }
  },
);

it.each(['top', 'bottom', 'left', 'right'])(
  'keeps a visible %s arrow inside the viewport and attached to the bubble',
  placement => {
    const geometry = constrainGeometryToViewport(
      {
        placement,
        tooltipOrigin: { x: -40, y: 900 },
        anchorPoint: { x: 420, y: 900 },
      },
      {
        windowDims: { width: 360, height: 780 },
        displayInsets: { top: 12, right: 12, bottom: 12, left: 12 },
        contentSize: { width: 500, height: 1000 },
        arrowSize: { width: 16, height: 8 },
      },
    );
    const { tooltipOrigin, adjustedContentSize, anchorPoint } = geometry;
    expect(anchorPoint.x).toBeGreaterThanOrEqual(12);
    expect(anchorPoint.x).toBeLessThanOrEqual(348);
    expect(anchorPoint.y).toBeGreaterThanOrEqual(12);
    expect(anchorPoint.y).toBeLessThanOrEqual(768);
    if (placement === 'left') {
      expect(anchorPoint.x).toBe(
        tooltipOrigin.x + adjustedContentSize.width + 16,
      );
    } else if (placement === 'right') {
      expect(anchorPoint.x).toBe(tooltipOrigin.x - 16);
    } else if (placement === 'top') {
      expect(anchorPoint.y).toBe(
        tooltipOrigin.y + adjustedContentSize.height + 8,
      );
    } else {
      expect(anchorPoint.y).toBe(tooltipOrigin.y - 8);
    }
  },
);
