import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

export const CameraView = () => {
  const colors = useThemeColors();
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
      console.log(codes);
    },
  });

  if (device == null) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrap}>
        <VisionCamera
          style={styles.camera}
          device={device}
          isActive={true}
          codeScanner={codeScanner}
        />
      </View>
    </View>
  );
};

export const QRCodeScanner = () => {
  const { hasPermission, requestPermission } = useCameraPermission();

  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return null;
  }

  return <CameraView />;
};
