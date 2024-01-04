import { RcIconScannerDownArrowCC } from '@/assets/icons/address';
import { Text } from '@/components';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import {
  QRCodeScanner,
  QRCodeScannerProps,
} from '@/components/QRCodeScanner/QRCodeScanner';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { forwardRef } from 'react';
import { View } from 'react-native';

export const CameraPopup = forwardRef<BottomSheetModal, QRCodeScannerProps>(
  (props, ref) => {
    const colors = useThemeColors();
    const styles = React.useMemo(() => getStyle(colors), []);
    return (
      <AppBottomSheetModal ref={ref} snapPoints={[436]}>
        <BottomSheetView style={styles.container}>
          <View>
            <Text style={styles.title}>
              Please scan the QR code with your camera
            </Text>
          </View>
          <RcIconScannerDownArrowCC
            color={colors['neutral-line']}
            style={styles.icon}
          />
          <QRCodeScanner {...props} />
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

const getStyle = createGetStyles(colors => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '500',
  },
  icon: {
    marginTop: 20,
    marginBottom: 16,
    width: 28,
    height: 28,
  },
}));
