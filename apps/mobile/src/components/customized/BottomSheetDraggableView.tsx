import {
  BottomSheetDraggableView,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import { BottomSheetInternalProvider } from '@gorhom/bottom-sheet/src/contexts/internal';
import type { StyleProp, ViewStyle } from 'react-native';

export function LocalPannableDraggableView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { enableContentPanningGesture, ...restValue } =
    useBottomSheetInternal();

  return (
    <BottomSheetInternalProvider
      value={{ enableContentPanningGesture: true, ...restValue }}>
      <BottomSheetDraggableView style={style}>
        {children}
      </BottomSheetDraggableView>
    </BottomSheetInternalProvider>
  );
}
