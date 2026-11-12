import React from 'react';
import { act, render } from '@testing-library/react-native';
// Inspect the dependency's actual native host to drive its presentation event.
// eslint-disable-next-line no-restricted-imports
import { Modal, View } from 'react-native';
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
  expect(ref.current.isMeasuringChild).toBe(false);
  expect(ref.current.state.measurementsFinished).toBe(false);
  measureAnchor.mockResolvedValueOnce({ x: 320, y: 16, width: 24, height: 24 });
  await act(async () => view.UNSAFE_getByType(Modal).props.onShow?.());
  expect(ref.current.state.childRect).toEqual({
    x: 320,
    y: 16,
    width: 24,
    height: 24,
  });
});

it('supersedes an in-flight pre-show measurement when the modal becomes mounted', async () => {
  const ref = React.createRef<any>();
  let failFirst!: (error: Error) => void;
  const measureAnchor = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          failFirst = reject;
        }),
    )
    .mockResolvedValue({ x: 300, y: 20, width: 24, height: 24 });
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
  await act(async () => view.UNSAFE_getByType(Modal).props.onShow?.());
  await act(async () => failFirst(new Error('pre-show viewport not mounted')));
  expect(measureAnchor).toHaveBeenCalledTimes(2);
  expect(ref.current.state.childRect).toEqual({
    x: 300,
    y: 20,
    width: 24,
    height: 24,
  });
  expect(ref.current.isMeasuringChild).toBe(false);
});

it.each(['reject', 'empty', 'non-finite'])(
  'closes a presented overlay after %s measurement instead of trapping touches',
  async failure => {
    const ref = React.createRef<any>();
    const onClose = jest.fn();
    const measureAnchor =
      failure === 'reject'
        ? jest.fn().mockRejectedValue(new Error('unavailable'))
        : jest.fn().mockResolvedValue({
            x: failure === 'non-finite' ? NaN : 0,
            y: 0,
            width: failure === 'empty' ? 0 : 24,
            height: 24,
          });
    const view = render(
      <Tooltip
        ref={ref}
        isVisible
        content={<View />}
        measureAnchor={measureAnchor}
        onClose={onClose}>
        <View />
      </Tooltip>,
    );
    ref.current.childWrapper.current = {};
    ref.current.viewport.current = {};
    await act(async () => ref.current.measureChildRect());
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => view.UNSAFE_getByType(Modal).props.onShow?.());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(ref.current.isMeasuringChild).toBe(false);
  },
);

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
