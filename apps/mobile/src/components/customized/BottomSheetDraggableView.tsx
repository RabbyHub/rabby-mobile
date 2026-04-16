import {
  BottomSheetDraggableView,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import { BottomSheetInternalProvider } from '@gorhom/bottom-sheet/src/contexts/internal';

export function LocalPannableDraggableView({
  children,
}: {
  children: React.ReactNode;
}) {
  const { enableContentPanningGesture, ...restValue } =
    useBottomSheetInternal();

  return (
    <BottomSheetInternalProvider
      value={{ enableContentPanningGesture: true, ...restValue }}>
      <BottomSheetDraggableView>{children}</BottomSheetDraggableView>
    </BottomSheetInternalProvider>
  );
}
