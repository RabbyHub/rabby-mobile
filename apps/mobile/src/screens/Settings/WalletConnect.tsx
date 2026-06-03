import React, { useCallback, useRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Code } from 'react-native-vision-camera';

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

function getFirstScannedValue(codes: Code[]) {
  return codes.find(code => !!code.value)?.value?.trim() || '';
}

function isPotentialWalletConnectUri(value: string) {
  return value.trim().toLowerCase().startsWith('wc:');
}

export default function WalletConnectScreen() {
  const { width } = useWindowDimensions();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const navigation = useNavigation();
  const lastScannedValueRef = useRef('');

  const scannerSize = Math.min(Math.max(width - 72, 260), 330);

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
      contentContainerStyle={styles.content}
      bounces={false}>
      <View style={styles.scannerArea}>
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
          size={scannerSize}
        />
        <Text style={styles.statusText}>Waiting for WalletConnect QR code</Text>
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
  scannerArea: {
    alignItems: 'center',
  },
  scannerContainer: {
    borderColor: ctx.colors2024['neutral-line'],
    marginBottom: 20,
  },
  statusText: {
    color: '#F7FAFC',
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
}));
