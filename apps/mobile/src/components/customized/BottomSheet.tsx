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
import { StyleSheet, Text } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';

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

export const AppBottomSheetHandle = (
  props: React.ComponentProps<typeof BottomSheetHandle>,
) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <BottomSheetHandle
      {...props}
      style={[
        props.style,
        styles.handleStyles,
        {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center',
          // leave here for debug
          // borderWidth: 1,
          // borderColor: colors['neutral-line'],
        },
      ]}
      indicatorStyle={[
        props.indicatorStyle,
        styles.handleIndicatorStyle,
        {
          top: -6,
        },
      ]}
    />
  );
};

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
      ref={ref}>
      <BottomSheetView className="px-[20] items-center justify-center">
        {children || null}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

export type DappNavCardBottomSheetModal = BottomSheetModal;
