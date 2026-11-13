import React from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { renderStickyRowScrollView } from './StickyRowScrollView';

// Unit coverage: which cells get their layout reporting rerouted. That React
// Native's sticky wrapper then calls the rerouted `onLayout` with its own
// layout is its contract, checked on a device rather than here.
type CellProps = {
  cellKey: string;
  index: number;
  onCellLayout?: (e: LayoutChangeEvent, cellKey: string, index: number) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};
const received = new Map<string, CellProps>();
const Cell = (props: CellProps) => {
  received.set(props.cellKey, props);
  return <View />;
};

const layoutEvent = {
  nativeEvent: { layout: { x: 0, y: 198, width: 300, height: 30 } },
} as LayoutChangeEvent;

beforeEach(() => {
  received.clear();
});

it('has a sticky cell report the layout its wrapper passes on', () => {
  const onCellLayout = jest.fn();
  render(
    renderStickyRowScrollView({
      stickyHeaderIndices: [1],
      children: [
        <Cell key="a" cellKey="a" index={0} onCellLayout={onCellLayout} />,
        <Cell key="b" cellKey="b" index={1} onCellLayout={onCellLayout} />,
      ],
    }),
  );

  // the cell no longer measures itself inside the wrapper
  expect(received.get('b')!.onCellLayout).toBeUndefined();
  received.get('b')!.onLayout!(layoutEvent);
  expect(onCellLayout).toHaveBeenCalledWith(layoutEvent, 'b', 1);
});

it('leaves the other cells measuring themselves', () => {
  const onCellLayout = jest.fn();
  render(
    renderStickyRowScrollView({
      stickyHeaderIndices: [1],
      children: [
        <Cell key="a" cellKey="a" index={0} onCellLayout={onCellLayout} />,
        <Cell key="b" cellKey="b" index={1} onCellLayout={onCellLayout} />,
      ],
    }),
  );

  expect(received.get('a')!.onCellLayout).toBe(onCellLayout);
  expect(received.get('a')!.onLayout).toBeUndefined();
});

it('leaves a sticky child alone when it is not a list cell', () => {
  render(
    renderStickyRowScrollView({
      stickyHeaderIndices: [0],
      children: [<View key="header" testID="header" />],
    }),
  );

  expect(screen.getByTestId('header').props.onLayout).toBeUndefined();
});
