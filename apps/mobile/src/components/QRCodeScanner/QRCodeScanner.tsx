import { useThemeColors } from '@/hooks/theme';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
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
import { AppColorsVariants } from '@/constant/theme';
import ScanLineImage from '@/assets2024/images/scan.png';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface CameraViewProps {
  onCodeScanned?: (code: Code[]) => void;
  containerStyle?: StyleProp<ViewStyle>;
  size?: number;
  showScanLine?: boolean;
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
  size = Dimensions.get('window').width - 70,
  showScanLine,
}: CameraViewProps) => {
  const colors = useThemeColors();
  const [initialized, setInitialized] = useState(false);
  const cameraRef = React.useRef(null);
  const styles = React.useMemo(() => getStyles(colors), [colors]);

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

  const topValue = useSharedValue(-44);

  const scanLineStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: size - 30,
    height: 30,
    left: 0,
    top: 0,
    opacity: interpolate(
      topValue.value,
      [-44, 0, size - 44, size],
      [0, 1, 1, 0],
    ),
    transform: [
      {
        translateY: topValue.value,
      },
      {
        translateX: 0,
      },
    ],
    justifyContent: 'center',
    alignItems: 'center',
  }));

  useEffect(() => {
    if (showScanLine) {
      topValue.value = withRepeat(
        withTiming(size, {
          duration: 2000,
        }),
        -1,
        false,
      );
    }
  }, [size, topValue, showScanLine]);

  useEffect(() => {
    setTimeout(() => {
      setInitialized(true);
    }, 500);
  }, []);

  if (device == null) {
    return (
      <View style={StyleSheet.flatten([styles.container, containerStyle])}>
        <Text>No Camera Device</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.flatten([styles.container, containerStyle])}>
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
        {showScanLine ? (
          <Animated.View style={scanLineStyle}>
            <Image
              source={ScanLineImage}
              style={{
                width: '100%',
                height: 62,
              }}
            />
          </Animated.View>
        ) : null}
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
