import {
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useSafeAndroidBottomSizes, useSafeSizes } from '@/hooks/useAppLayout';
import { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import { apisAutoLock, apisLock } from '@/core/apis';
import AutoLockView from '../AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '../patches/refreshAutoLockUI';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { IS_IOS } from '@/core/native/utils';
import AppBottomSheetBackdrop from '../patches/BottomSheetBackdrop';

export const getBottomSheetHandleStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    handleStyles: {
      height: 20,
      backgroundColor: colors['neutral-bg-1'],
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
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
  style?: TextStyle;
}> = ({ title, style }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getBottomSheetHandleStyles(colors), [colors]);

  return <Text style={[styles.title, style]}>{title}</Text>;
};

type onChangeArgsType = Parameters<BottomSheetModalProps['onChange'] & object>;
export function useAutoLockBottomSheetModalOnChange(
  onChange: BottomSheetModalProps['onChange'],
) {
  const preOnChangeArgsRef = React.useRef<onChangeArgsType | null>(null);
  const handleChange = useCallback<BottomSheetModalProps['onChange'] & object>(
    (idx, pos, type) => {
      onChange?.(idx, pos, type);

      try {
        const prevVal = preOnChangeArgsRef.current;
        const curVal = [idx, pos, type] as onChangeArgsType;
        preOnChangeArgsRef.current = curVal;

        if (
          !prevVal ||
          prevVal[0] !== curVal[0] ||
          prevVal[1] !== curVal[1] ||
          prevVal[2] !== curVal[2]
        ) {
          apisAutoLock.uiRefreshTimeout();
        }
      } catch (err) {
        console.error(err);
      }
    },
    [onChange],
  );

  return { handleChange };
}

export const AppBottomSheetModal = forwardRef<
  BottomSheetModal,
  React.ComponentProps<typeof BottomSheetModal> & {
    backdropProps?: Partial<BottomSheetDefaultBackdropProps>;
  }
>(({ onChange, ...props }, ref) => {
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
    _props => (
      <AppBottomSheetBackdrop
        {..._props}
        {...props.backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [props.backdropProps],
  );

  const { handleChange } = useAutoLockBottomSheetModalOnChange(onChange);

  return (
    <BottomSheetModal
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      enableDynamicSizing={false}
      {...props}
      onChange={handleChange}
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
  Omit<BottomSheetModalProps, 'handleComponent'>
>((props, ref) => {
  return (
    <BottomSheetModal
      {...props}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      // special, allow inner BottomSheetModal's backdrop can override this
      handleComponent={null}
      ref={ref}
    />
  );
});

export type OpenedDappBottomSheetModal = BottomSheetModal;

const renderOpenedDappNavCardBackdrop = (props: BottomSheetBackdropProps) => {
  return (
    <RefreshAutoLockBottomSheetBackdrop
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

const SYS_BOTTOM_OFFSET = IS_IOS ? 12 : 8;
export const DappNavCardBottomSheetModal = forwardRef<
  AppBottomSheetModal,
  Omit<React.ComponentProps<typeof AppBottomSheetModal>, 'snapPoints'> & {
    bottomNavH: number;
    children?: React.ReactNode;
    /**
     * @default false
     */
    keepAliveOnAppLocked?: boolean;
  }
>(({ children, bottomNavH, keepAliveOnAppLocked = false, ...props }, ref) => {
  const { safeTop } = useSafeSizes();
  const { styles } = useThemeStyles(getDappNavCardBottomSheetStyles);

  const topSnapPoint = bottomNavH + safeTop;
  const { safeSizes } = useSafeAndroidBottomSizes({
    topSnapPoint: topSnapPoint + SYS_BOTTOM_OFFSET,
    sheetViewPb: SYS_BOTTOM_OFFSET,
  });

  React.useEffect(() => {
    if (keepAliveOnAppLocked) return;

    const dispose = apisLock.subscribeAppLock(() => {
      if (keepAliveOnAppLocked) return;
      const refI = ref as Exclude<typeof ref, Function>;
      refI?.current?.dismiss();
    });

    return dispose;
  }, [ref, keepAliveOnAppLocked]);

  return (
    <AppBottomSheetModal
      {...props}
      index={0}
      backdropComponent={renderOpenedDappNavCardBackdrop}
      enableHandlePanningGesture={true}
      enableContentPanningGesture={true}
      name="webviewNavRef"
      // handleHeight={28}
      snapPoints={[safeSizes.topSnapPoint]}
      backgroundStyle={styles.sheetModal}
      ref={ref}>
      <AutoLockView
        as="BottomSheetView"
        style={[
          styles.sheetView,
          {
            paddingBottom: safeSizes.sheetViewPb,
          },
        ]}>
        {children || null}
      </AutoLockView>
    </AppBottomSheetModal>
  );
});

const getDappNavCardBottomSheetStyles = createGetStyles(colors => {
  return {
    sheetModal: { backgroundColor: colors['neutral-bg-1'] },
    sheetView: {
      height: '100%',
      width: '100%',
      // paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      // ...makeDebugBorder(),
    },
  };
});

export type DappNavCardBottomSheetModal = BottomSheetModal;
