import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useThemeColors } from '@/hooks/theme';
import { forwardRef } from 'react';

export const AppBottomSheetModal = forwardRef<
  BottomSheetModal,
  React.ComponentProps<typeof BottomSheetModal>
>((props, ref) => {
  const colors = useThemeColors();

  return (
    <BottomSheetModal
      {...props}
      ref={ref}
      handleStyle={[{ height: 20 }, props.handleStyle]}
      handleIndicatorStyle={[
        { backgroundColor: colors['neutral-line'], height: 5, width: 44 },
        props.handleIndicatorStyle,
      ]}
    />
  );
});

export type AppBottomSheetModal = BottomSheetModal;
