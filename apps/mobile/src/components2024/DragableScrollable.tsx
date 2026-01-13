import React from 'react';
import {
  GestureDetector,
  NativeGesture,
  type SimultaneousGesture,
} from 'react-native-gesture-handler';

interface DraggableScrollableProps {
  scrollableGesture?: NativeGesture;
  children: React.ReactNode;
}

export function DraggableScrollable({
  scrollableGesture,
  children,
}: DraggableScrollableProps) {
  console.log('DraggableScrollable render', scrollableGesture);
  if (scrollableGesture) {
    return (
      <GestureDetector gesture={scrollableGesture}>{children}</GestureDetector>
    );
  }

  return children;
}
