import { useThemeColors } from '@/hooks/theme';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
// import {
//   CameraRuntimeError,
//   Code,
//   Camera as VisionCamera,
//   useCameraDevice,
//   useCameraPermission,
//   useCodeScanner,
// } from 'react-native-vision-camera';
import { Text } from '../Text';
import { useAppState } from '@react-native-community/hooks';
import { AppColorsVariants } from '@/constant/theme';

interface CameraViewProps {
  onCodeScanned?: (code: any[]) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

const getStyles = (colors: AppColorsVariants) =>
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
  });

export const CameraView = ({
  onCodeScanned,
  containerStyle,
}: CameraViewProps) => {
  const colors = useThemeColors();
  const [initialized, setInitialized] = useState(false);
  const cameraRef = React.useRef(null);
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return null;
};
export interface QRCodeScannerProps extends CameraViewProps {}

export const QRCodeScanner = (props: QRCodeScannerProps) => {
  return null;
  // const { hasPermission, requestPermission } = useCameraPermission();
  // const appState = useAppState();

  // React.useEffect(() => {
  //   if (!hasPermission && appState === 'active') {
  //     requestPermission();
  //   }
  // }, [hasPermission, requestPermission, appState]);

  // if (!hasPermission) {
  //   return (
  //     <Text
  //       style={{
  //         maxWidth: 300,
  //       }}>
  //       Camera permission is not granted. You can grant it on
  //       <Text onPress={Linking.openSettings}> setting</Text>
  //     </Text>
  //   );
  // }
  // return <CameraView {...props} />;
};
