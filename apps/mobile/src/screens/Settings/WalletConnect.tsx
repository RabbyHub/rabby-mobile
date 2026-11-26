import React, { useCallback, useRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Code } from 'react-native-vision-camera';

import RcIconWalletConnect from '@/assets2024/icons/common/walletconnect-white.svg';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import {
  pairWalletConnectUri,
  parseWalletConnectUri,
} from '@/core/walletconnect';
import { getWalletConnectErrorMessage } from '@/core/walletconnect/error';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';

function getFirstScannedValue(codes: Code[]) {
  return codes.find(code => !!code.value)?.value?.trim() || '';
}

/** Gap between the corner brackets and the camera preview. */
const FRAME_INSET = 10;

function isPotentialWalletConnectUri(value: string) {
  return value.trim().toLowerCase().startsWith('wc:');
}

export default function WalletConnectScreen() {
  const { width } = useWindowDimensions();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const navigation = useNavigation();
  const lastScannedValueRef = useRef('');
  // `useWindowDimensions()` already reports the 382pt foldable content column,
  // but this ScrollView still spans the full 466pt window and centres its
  // content there. Keep the QR frame on the content column like the scanner.
  const columnInset = useSystemColumnInset();

  const frameSize = Math.min(Math.max(width - 68, 260), 330);
  const scannerSize = frameSize - FRAME_INSET * 2;

  const handleCodeScanned = useCallback(
    (codes: Code[]) => {
      const rawValue = getFirstScannedValue(codes);
      if (!rawValue || lastScannedValueRef.current === rawValue) {
        return;
      }

      lastScannedValueRef.current = rawValue;

      if (!isPotentialWalletConnectUri(rawValue)) {
        return;
      }

      let parsed: ReturnType<typeof parseWalletConnectUri>;
      try {
        parsed = parseWalletConnectUri(rawValue);
      } catch (error: unknown) {
        toast.error(getWalletConnectErrorMessage(error), {
          duration: 3000,
          hideOnPress: true,
        });
        return;
      }

      navigation.goBack();
      pairWalletConnectUri({
        uri: parsed.uri,
        source: 'qr',
      }).catch(() => {
        // WalletConnectModalHost observes pairing.error and owns user feedback.
      });
    },
    [navigation],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingLeft: 20 + columnInset.left,
          paddingRight: 20 + columnInset.right,
        },
      ]}
      bounces={false}>
      <View style={[styles.frame, { width: frameSize, height: frameSize }]}>
        <QRCodeScanner
          showScanLine
          onCodeScanned={handleCodeScanned}
          containerStyle={[
            styles.scannerContainer,
            {
              width: scannerSize,
              height: scannerSize,
            },
          ]}
          cameraWrapStyle={styles.cameraWrap}
          permissionTipStyle={styles.permissionTip}
          size={scannerSize}
        />
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
      </View>
      <View style={styles.target}>
        <RcIconWalletConnect width={20} height={20} />
        <Text style={styles.targetText}>WalletConnect</Text>
      </View>
    </ScrollView>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    flex: 1,
    backgroundColor: ctx.colors2024['neutral-black'],
  },
  content: {
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerContainer: {
    borderWidth: 0,
    padding: 0,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cameraWrap: {
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  permissionTip: {
    textAlign: 'center',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: ctx.colors2024['brand-default'],
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 24,
    borderCurve: 'continuous',
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 24,
    borderCurve: 'continuous',
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 24,
    borderCurve: 'continuous',
  },
  target: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetText: {
    color: '#F7FAFC',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
}));
