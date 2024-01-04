import { useThemeColors } from '@/hooks/theme';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  CameraRuntimeError,
  Code,
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { Text } from '../Text';
import { useAppState } from '@react-native-community/hooks';

interface CameraViewProps {
  onCodeScanned?: (code: Code[]) => void;
}
export const CameraView = ({ onCodeScanned }: CameraViewProps) => {
  const colors = useThemeColors();
  const [initialized, setInitialized] = useState(false);
  const cameraRef = React.useRef(null);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderWidth: 1,
          borderColor: colors['neutral-line'],
          width: 200,
          height: 200,
          borderRadius: 8,
          padding: 15,
        },
        camera: {
          width: '100%',
          height: '100%',
        },
        cameraWrap: {
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          filter: 'blur(4px)',
        },
      }),
    [colors],
  );
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      onCodeScanned?.(codes);
    },
  });
  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error);
  }, []);

  const appState = useAppState();

  const isActive = appState === 'active';

  useEffect(() => {
    setTimeout(() => {
      setInitialized(true);
    }, 500);
  }, []);

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text>No Camera Device</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrap}>
        {device != null && (
          <VisionCamera
            ref={cameraRef}
            photo={false}
            video={false}
            audio={false}
            device={device}
            isActive={initialized && isActive}
            style={styles.camera}
            onError={onError}
            codeScanner={codeScanner}
          />
        )}
      </View>
    </View>
  );
};
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
        }}>
        Camera permission is not granted. You can grant it on
        <Text onPress={Linking.openSettings}> setting</Text>
      </Text>
    );
  }
  return <CameraView {...props} />;
};
