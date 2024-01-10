import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useThemeColors } from '@/hooks/theme';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
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
    title: {
      fontSize: 20,
      lineHeight: 23,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginBottom: 16,
      paddingTop: 24,
      textAlign: 'center',
    },
  });
};

export const AppBottomSheetModalTitle: React.FC<{
  title: string;
}> = ({ title }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return <Text style={styles.title}>{title}</Text>;
};

export const AppBottomSheetModal = forwardRef<
  BottomSheetModal,
  React.ComponentProps<typeof BottomSheetModal>
>((props, ref) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
