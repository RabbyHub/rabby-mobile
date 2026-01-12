import React from 'react';
import {
  GestureDetector,
  type SimultaneousGesture,
} from 'react-native-gesture-handler';

interface DraggableScrollableProps {
  scrollableGesture?: SimultaneousGesture;
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
