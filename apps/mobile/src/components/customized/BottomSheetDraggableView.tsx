import { useBottomSheetInternal } from '@gorhom/bottom-sheet';
import { BottomSheetInternalProvider } from '@gorhom/bottom-sheet/src/contexts';
import BottomSheetDraggableView from '@gorhom/bottom-sheet/src/components/bottomSheetDraggableView/index';

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
