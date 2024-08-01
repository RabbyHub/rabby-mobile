import { useCallback } from 'react';
import { AppBottomSheetModal, Button } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { forwardRef, useRef, useMemo, useImperativeHandle } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AutoLockView from '../AutoLockView';

export const BottomSheetModalConfirmContainer = forwardRef<
  BottomSheetModal,
  React.PropsWithChildren<{
    height: number;
    bodyStyle?: React.ComponentProps<typeof BottomSheetView>['style'];
    /**
     * @description strict `false` value means not confirmed
     * @returns
     */
    onConfirm?: () => Promise<boolean | void> | boolean | void;
    onCancel?: () => void;
    centerGap?: number;
    noCancelButton?: boolean;
    cancelText?: string;
    cancelButtonProps?: React.ComponentProps<typeof Button>;
    confirmText?: string;
    confirmButtonProps?: React.ComponentProps<typeof Button>;
    bottomSheetModalProps?: Partial<
      React.ComponentProps<typeof BottomSheetModal>
    >;
  }>
>((props, ref) => {
  const {
    height = 0,
    children,
    bodyStyle,
    onConfirm,
    onCancel,
    centerGap = 13,
    noCancelButton = false,
    cancelText = 'Cancel',
    cancelButtonProps,
    confirmText = 'Confirm',
    confirmButtonProps,
    bottomSheetModalProps,
  } = props;
  const sheetModalRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const cancel = useCallback(() => {
    onCancel?.();
    sheetModalRef.current?.dismiss();
  }, [onCancel]);
  const confirm = useCallback(async () => {
    const confirmeResult = await onConfirm?.();
    if (confirmeResult !== false) {
      sheetModalRef.current?.dismiss();
    }
  }, [onConfirm]);

  useImperativeHandle(
    ref,
    () => sheetModalRef?.current || ({} as BottomSheetModalMethods),
  );

  const cancelNode = useMemo(() => {
    if (noCancelButton) return null;

    return (
      <Button
        onPress={cancel}
        title={cancelText}
        type="clear"
        {...cancelButtonProps}
        buttonStyle={[styles.buttonStyle, cancelButtonProps?.buttonStyle]}
        titleStyle={[styles.btnCancelTitle, cancelButtonProps?.titleStyle]}
        containerStyle={[
          styles.btnContainer,
          styles.btnCancelContainer,
          cancelButtonProps?.containerStyle,
        ]}>
        {cancelText}
      </Button>
    );
  }, [styles, cancelText, noCancelButton, cancel, cancelButtonProps]);

  const confirmNode = useMemo(() => {
    return (
      <Button
        onPress={confirm}
        title={confirmText}
        type="danger"
        {...confirmButtonProps}
        buttonStyle={[styles.buttonStyle, confirmButtonProps?.style]}
        titleStyle={[styles.btnConfirmTitle, confirmButtonProps?.titleStyle]}
        containerStyle={[
          styles.btnContainer,
          styles.btnConfirmContainer,
          confirmButtonProps?.containerStyle,
        ]}>
        {confirmText}
      </Button>
    );
  }, [styles, confirmText, confirm, confirmButtonProps]);

  const btnNodesCount = [cancelNode, confirmNode].filter(Boolean).length;

  return (
    <AppBottomSheetModal
      {...bottomSheetModalProps}
      backgroundStyle={[bottomSheetModalProps?.backgroundStyle, styles.sheet]}
      index={0}
      onChange={idx => {
        if (idx < 0) {
          onCancel?.();
        }
      }}
      ref={sheetModalRef}
      enableDismissOnClose
      onDismiss={() => {
        onCancel?.();
        bottomSheetModalProps?.onDismiss?.();
      }}
      snapPoints={[height + insets.bottom]}
      bottomInset={1}
      footerComponent={() => {
        return (
          <View style={styles.footerWrapper}>
            <View style={[styles.btnGroup]}>
              {cancelNode}
              {btnNodesCount > 1 && (
                <View style={{ width: centerGap, flexShrink: 1 }} />
              )}
              {confirmNode}
            </View>
          </View>
        );
      }}>
      <AutoLockView as="BottomSheetView" style={[styles.container, bodyStyle]}>
        {children}
      </AutoLockView>
    </AppBottomSheetModal>
  );
});

const getStyles = createGetStyles(colors => ({
  sheet: {
    backgroundColor: colors['neutral-bg-1'],
  },
  container: {
    flex: 1,
    paddingVertical: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footerWrapper: { paddingBottom: 26 },

  btnGroup: {
    paddingTop: 20,
    paddingHorizontal: 20,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 'auto',
    position: 'relative',
  },

  border: {
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-bg1'],
    position: 'absolute',
    top: 0,
    left: 0,
  },

  btnContainer: {
    flexShrink: 1,
    display: 'flex',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    maxWidth: '100%',
  },

  buttonStyle: {
    width: '100%',
    height: '100%',
  },
  btnCancelContainer: {
    borderColor: colors['blue-default'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnCancelTitle: {
    color: colors['blue-default'],
    flex: 1,
  },
  btnConfirmContainer: {},
  btnConfirmTitle: {
    color: colors['neutral-title-2'],
    flex: 1,
  },
}));
