import DeviceUtils from '@/core/utils/device';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useAtom } from 'jotai';
import React from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { visibleAtom, dataAtom } from './useQrCodeModal';
import CloseSVG from '@/assets2024/icons/common/close-cc.svg';

export const QrCodeModal: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [visible, setVisible] = useAtom(visibleAtom);
  const [data] = useAtom(dataAtom);

  return (
    <Modal
      style={styles.root}
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        setVisible(false);
      }}>
      <TouchableOpacity
        onPress={() => setVisible(false)}
        style={styles.overlay}>
        <View style={styles.container}>
          <QRCode value={data} size={DeviceUtils.getDeviceWidth() - 144} />
        </View>
        <View style={styles.closeButton}>
          <CloseSVG
            color={colors2024['neutral-InvertHighlight']}
            width={24}
            height={24}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: DeviceUtils.getDeviceWidth() - 124,
    backgroundColor: 'white',
    borderRadius: 20,
    alignItems: 'center',
    padding: 10,
  },
  closeButton: {
    borderRadius: 40,
    borderColor: colors2024['neutral-InvertHighlight'],
    borderWidth: 2,
    padding: 8,
    marginTop: 15,
  },
}));
