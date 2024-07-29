import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useThemeColors } from '@/hooks/theme';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';

export const getBottomSheetHandleStyles = (colors: AppColorsVariants) => {
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
  style?: StyleProp<ViewStyle>;
}> = ({ title, style }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getBottomSheetHandleStyles(colors), [colors]);

  return <Text style={[styles.title, style]}>{title}</Text>;
};

export const AppBottomSheetModal = forwardRef<
  BottomSheetModal,
  React.ComponentProps<typeof BottomSheetModal>
>((props, ref) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getBottomSheetHandleStyles(colors), [colors]);
  const backgroundStyle = useMemo(
    () => [
      {
        backgroundColor: colors['neutral-bg-1'],
      },
      props.backgroundStyle,
    ],
    [colors, props.backgroundStyle],
  );
  const renderBackdrop = useCallback<
    React.ComponentProps<typeof BottomSheetModal>['backdropComponent'] &
      Function
  >(
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
      enableDynamicSizing={false}
      {...props}
      backgroundStyle={backgroundStyle}
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

export const OpenedDappBottomSheetModal = forwardRef<
  BottomSheetModal,
  Omit<React.ComponentProps<typeof BottomSheetModal>, 'handleComponent'>
>((props, ref) => {
  return (
    <BottomSheetModal
      {...props}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      handleHeight={0}
      // special, allow inner BottomSheetModal's backdrop can override this
      handleComponent={null}
      ref={ref}
    />
  );
});

export type OpenedDappBottomSheetModal = BottomSheetModal;

const renderOpenedDappNavCardBackdrop = (props: BottomSheetBackdropProps) => {
  return (
    <BottomSheetBackdrop
      {...props}
      // // leave here for debug
      // style={[
      //   props.style,
      //   {
      //     borderWidth: 1,
      //     borderColor: 'red',
      //   }
      // ]}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
    />
  );
};

export const DappNavCardBottomSheetModal = forwardRef<
  AppBottomSheetModal,
  Omit<React.ComponentProps<typeof AppBottomSheetModal>, 'snapPoints'> & {
    bottomNavH: number;
    children?: React.ReactNode;
  }
>(({ children, bottomNavH, ...props }, ref) => {
  const { safeTop } = useSafeSizes();
  const colors = useThemeColors();

  const topSnapPoint = bottomNavH + safeTop;

  return (
    <AppBottomSheetModal
      {...props}
      index={0}
      backdropComponent={renderOpenedDappNavCardBackdrop}
      enableHandlePanningGesture={true}
      enableContentPanningGesture={true}
      name="webviewNavRef"
      handleHeight={28}
      snapPoints={[topSnapPoint]}
      backgroundStyle={{
        backgroundColor: colors['neutral-bg-1'],
      }}
      ref={ref}>
      <BottomSheetView className="px-[20] items-center justify-center">
        {children || null}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

export type DappNavCardBottomSheetModal = BottomSheetModal;
