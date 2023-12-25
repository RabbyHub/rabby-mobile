import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import React from 'react';
import { View } from 'react-native';

interface Props {}

export const CameraPopup: React.FC<Props> = () => {
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);

  return (
    <AppBottomSheetModal ref={bottomSheetModalRef} snapPoints={[436]}>
      <View>Please scan the QR code with your camera</View>
      <QRCodeScanner />
    </AppBottomSheetModal>
  );
};
