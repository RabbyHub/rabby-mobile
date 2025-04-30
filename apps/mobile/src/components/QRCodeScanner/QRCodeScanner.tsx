import React from 'react';
import { Linking } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import { Text } from '../Text';
import { useAppState } from '@react-native-community/hooks';
import { CameraView, CameraViewProps } from './CameraView';

export interface QRCodeScannerProps extends CameraViewProps {}

export const QRCodeScanner = (props: QRCodeScannerProps) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const appState = useAppState();

  React.useEffect(() => {
    if (!hasPermission && appState === 'active') {
      requestPermission();
    }
  }, [hasPermission, requestPermission, appState]);

  if (!hasPermission) {
    return (
      <Text
        style={{
          maxWidth: 300,
          color: 'white',
        }}>
        Camera permission is not granted. You can grant it on
        <Text onPress={Linking.openSettings}> setting</Text>
      </Text>
    );
  }
  return <CameraView {...props} />;
};
