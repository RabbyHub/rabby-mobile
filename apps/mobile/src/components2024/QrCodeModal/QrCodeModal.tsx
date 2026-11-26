import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';
import { useWindowDimensions } from '@/core/dimensions';
import { useTheme2024 } from '@/hooks/theme';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { createGetStyles2024 } from '@/utils/styles';
import { useAtom } from 'jotai';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { visibleAtom, dataAtom } from './useQrCodeModal';
import CloseCircleSVG from '@/assets2024/icons/common/close-circle.svg';

/** White margin between the QR modules and the card edge, in pt. */
const QR_FRAME_INSET = 10;

export const QrCodeModal: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [visible, setVisible] = useAtom(visibleAtom);
  const [data] = useAtom(dataAtom);
  /**
   * Frame and QR come from the same reactive content width. A snapshot read in
   * the (memoized) style factory kept the pre-letterbox native width on the Duo
   * outer screen, so the card stayed 342pt wide while the QR was drawn at
   * 238pt and the side margins grew to 52pt.
   */
  const { width } = useWindowDimensions();
  const columnInset = useSystemColumnInset();
  const qrSize = Math.max(0, Math.round(width - 144));
  const frameSize = qrSize + QR_FRAME_INSET * 2;

  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.qrCode}
      style={styles.root}
      // Without data there is nothing to draw or tap: never present an empty
      // transparent Modal.
      visible={visible && !!data}
      transparent
      animationType="none"
      onRequestClose={() => {
        setVisible(false);
      }}>
      {/* Keep the content mounted while the native modal dismisses; gating
          on `visible` leaves an empty frame and causes the close flicker. */}
      {data ? (
        <TouchableOpacity
          // Default TouchableOpacity opacity feedback fades the QR itself
          // before the modal closes, which QA sees as a flicker.
          activeOpacity={1}
          onPress={() => setVisible(false)}
          style={[
            styles.overlay,
            // Centre on the content column, not the full window: the foldable
            // system column is not part of the app's layout.
            columnInset.right > 0 && { paddingRight: columnInset.right },
          ]}>
          {/* Explicit width and height keep the card square; padding alone
              would follow whatever the QR component decides to draw. */}
          <View
            style={[styles.container, { width: frameSize, height: frameSize }]}>
            <QRCode value={data} size={qrSize} />
          </View>
          <View style={styles.closeButton}>
            <CloseCircleSVG color={colors2024['neutral-InvertHighlight']} />
          </View>
        </TouchableOpacity>
      ) : null}
    </TrackedModal>
  );
};

const getStyle = createGetStyles2024(() => ({
  root: {},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    marginTop: 15,
  },
}));
