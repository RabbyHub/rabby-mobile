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

export const ConfirmBottomSheetModal = forwardRef<
  BottomSheetModal,
  React.PropsWithChildren<{
    height: number;
    onConfirm?: () => void;
    onCancel?: () => void;
    centerGap?: number;
    cancelButtonProps?: React.ComponentProps<typeof Button>;
    confirmButtonProps?: React.ComponentProps<typeof Button>;
  }>
>((props, ref) => {
  const {
    height = 0,
    children,
    onConfirm,
    onCancel,
    centerGap = 13,
    cancelButtonProps,
    confirmButtonProps,
  } = props;
  const sheetModalRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const cancel = () => {
    onCancel?.();
    sheetModalRef.current?.dismiss();
  };
  const confirm = () => {
    onConfirm?.();
    sheetModalRef.current?.dismiss();
  };

  useImperativeHandle(
    ref,
    () => sheetModalRef?.current || ({} as BottomSheetModalMethods),
  );
  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      index={0}
      ref={sheetModalRef}
      enableDismissOnClose
      snapPoints={[height + insets.bottom]}
      bottomInset={1}
      footerComponent={() => {
        return (
          <View style={styles.footerWrapper}>
            <View style={[styles.btnGroup]}>
              <Button
                onPress={cancel}
                title={'Cancel'}
                type="clear"
                {...cancelButtonProps}
                buttonStyle={[
                  styles.buttonStyle,
                  cancelButtonProps?.buttonStyle,
                ]}
                titleStyle={[
                  styles.btnCancelTitle,
                  cancelButtonProps?.titleStyle,
                ]}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnCancelContainer,
                  cancelButtonProps?.containerStyle,
                ]}>
                Cancel
              </Button>
              <View style={{ width: centerGap, flexShrink: 1 }} />
              <Button
                onPress={confirm}
                title={'Confirm'}
                type="danger"
                {...confirmButtonProps}
                buttonStyle={[styles.buttonStyle, confirmButtonProps?.style]}
                titleStyle={[
                  styles.btnConfirmTitle,
                  confirmButtonProps?.titleStyle,
                ]}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnConfirmContainer,
                  confirmButtonProps?.containerStyle,
                ]}>
                Confirm
              </Button>
            </View>
          </View>
        );
      }}>
      <BottomSheetView style={[styles.container]}>{children}</BottomSheetView>
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
