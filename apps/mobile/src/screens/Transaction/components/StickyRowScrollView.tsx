import React, { cloneElement, isValidElement, type Ref } from 'react';
import {
  ScrollView,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from 'react-native';

// What VirtualizedList puts on each cell element it hands to the scroll view.
type ListCellProps = {
  cellKey?: string;
  index?: number;
  onCellLayout?: (
    event: LayoutChangeEvent,
    cellKey: string,
    index: number,
  ) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

function reportWrapperLayout(cell: React.ReactNode) {
  if (!isValidElement<ListCellProps>(cell)) {
    return cell;
  }
  const { onCellLayout, cellKey, index } = cell.props;
  if (!onCellLayout || cellKey == null || index == null) {
    return cell;
  }
  return cloneElement(cell, {
    onCellLayout: undefined,
    onLayout: event => onCellLayout(event, cellKey, index),
  });
}

/**
 * Lets a list keep track of where its sticky rows are.
 *
 * React Native wraps each sticky row in a view of its own, and the row's list
 * cell then measures itself inside that wrapper: every sticky row reports
 * offset 0. The list places its render window and its spacers from those
 * offsets, so with many sticky rows it renders the wrong stretch and leaves
 * the visible one blank. The wrapper does pass its own layout on to an
 * `onLayout` of the row element, so give each sticky cell one that reports to
 * the list in place of the cell's own measurement.
 */
function StickyRowScrollView({
  children,
  ...props
}: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  const stickyIndices = props.stickyHeaderIndices;
  const cells =
    stickyIndices?.length && Array.isArray(children)
      ? children.map((cell: React.ReactNode, index) =>
          stickyIndices.includes(index) ? reportWrapperLayout(cell) : cell,
        )
      : children;

  return <ScrollView {...props}>{cells}</ScrollView>;
}

/** `renderScrollComponent` for a list that sets `stickyHeaderIndices`. */
export const renderStickyRowScrollView = (props: ScrollViewProps) => (
  <StickyRowScrollView {...props} />
);
