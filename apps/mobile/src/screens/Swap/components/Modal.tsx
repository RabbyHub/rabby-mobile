import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { TrackedModal } from '@/components/Modal/TrackedModal';

export const SwapModal = ({
  visible,
  onCancel,
  // onConfirm,
  modalStyle,
  overlayStyle,
  children,
  overlayClose,
}: React.PropsWithChildren<{
  visible: boolean;
  onCancel: () => void;
  // onConfirm: () => void;
  modalStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  overlayClose?: boolean;
}>) => {
  const { styles } = useThemeStyles(getStyles);
  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.swapModal}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      visible={visible}
      style={[styles.modal, modalStyle]}>
      <Pressable
        style={[styles.overlay, overlayStyle]}
        onPress={() => (overlayClose ? onCancel() : undefined)}>
        {children}
        {/* <Inner onCancel={onCancel} onConfirm={onConfirm} /> */}
      </Pressable>
    </TrackedModal>
  );
};

const getStyles = createGetStyles(colors => ({
  modal: { maxWidth: 353, width: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 40,
  },

  btnC: {
    flex: 1,
    height: 50,
  },

  cancelStyle: {
    backgroundColor: colors['neutral-card-1'],
    borderColor: colors['blue-default'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 8,
    height: 48,
    width: '100%',
  },
  cancelTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['blue-default'],
    flex: 1,
  },
  btnGap: {
    width: 13,
  },
  confirmStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 8,
    width: '100%',
  },
  confirmTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title2'],
    flex: 1,
  },
}));
