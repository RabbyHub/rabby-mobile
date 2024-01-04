import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useThemeColors } from '@/hooks/theme';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';

export const AppBottomSheetModal = forwardRef<
  BottomSheetModal,
  React.ComponentProps<typeof BottomSheetModal>
>((props, ref) => {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        handleStyles: {
          height: 20,
          backgroundColor: colors['neutral-bg-1'],
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        },
        handleIndicatorStyle: {
          backgroundColor: colors['neutral-line'],
          height: 5,
          width: 44,
        },
      }),
    [colors],
  );
  const renderBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      {...props}
      ref={ref}
      handleStyle={StyleSheet.flatten([styles.handleStyles, props.handleStyle])}
      handleIndicatorStyle={[
        StyleSheet.flatten([
          styles.handleIndicatorStyle,
          props.handleIndicatorStyle,
        ]),
      ]}
    />
  );
});

export type AppBottomSheetModal = BottomSheetModal;
