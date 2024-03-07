import { AppBottomSheetModal, Button } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { forwardRef, useRef, useMemo, useImperativeHandle } from 'react';
import { Text, View, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ConfirmBottomSheetModal = forwardRef<
  BottomSheetModal,
  {
    height: number;
    title: React.ReactNode;
    desc: React.ReactNode;
    descStyle?: StyleProp<TextStyle>;
    onConfirm?: () => void;
    onCancel?: () => void;
  }
>((props, ref) => {
  const { height = 0, title, desc, onConfirm, onCancel, descStyle } = props;
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
      snapPoints={[height + insets.bottom]}>
      <BottomSheetScrollView
        scrollEnabled={false}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 20 + insets.bottom },
        ]}>
        <Text style={styles.title}>{title}</Text>
        <BottomSheetScrollView>
          <Text style={[styles.desc, descStyle]}>{desc}</Text>
        </BottomSheetScrollView>
        <View style={styles.btnGroup}>
          <View style={styles.border} />
          <Button
            onPress={cancel}
            title={'Cancel'}
            type="clear"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnCancelTitle}
            containerStyle={[styles.btnContainer, styles.btnCancelContainer]}>
            Cancel
          </Button>
          <View style={styles.btnGap} />
          <Button
            onPress={confirm}
            title={'Confirm'}
            type="primary"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnConfirmTitle}
            containerStyle={[styles.btnContainer, styles.btnConfirmContainer]}>
            Confirm
          </Button>
        </View>
      </BottomSheetScrollView>
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
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    textAlign: 'center',
  },

  desc: {
    color: colors['neutral-body'],
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },

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
    maxWidth: 170,
  },
  btnGap: {
    width: 18,
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
