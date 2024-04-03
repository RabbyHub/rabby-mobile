import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { QRCodeScanner } from '../QRCodeScanner/QRCodeScanner';
import { Code } from 'react-native-vision-camera';
import { URDecoder } from '@ngraveio/bc-ur';
import { apiKeystone } from '@/core/apis';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    main: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 48,
    },
    text: {
      fontSize: 16,
      color: colors['neutral-body'],
      lineHeight: 20,
      textAlign: 'center',
    },
    imageWrapper: {
      marginTop: 55,
      position: 'relative',
    },
    progress: {
      position: 'absolute',
      top: -15,
      left: -15,
    },
    scanner: {
      width: 240,
      height: 240,
    },
  });

export const ScanDeviceScreen: React.FC<{ onScanFinish: () => void }> = ({
  onScanFinish,
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const decoder = React.useRef(new URDecoder());
  const [progress, setProgress] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState('');
  const scannedRef = React.useRef(false);

  const handleCodeScanned = async (codes: Code[]) => {
    try {
      const data = codes[0].value!;

      decoder.current.receivePart(data);
      setProgress(Math.floor(decoder.current.estimatedPercentComplete() * 100));
      if (decoder.current.isComplete()) {
        if (scannedRef.current) {
          return;
        }
        scannedRef.current = true;
        const result = decoder.current.resultUR();
        if (result.type === 'crypto-hdkey') {
          await apiKeystone.submitQRHardwareCryptoHDKey(
            result.cbor.toString('hex'),
          );
        } else if (result.type === 'crypto-account') {
          await apiKeystone.submitQRHardwareCryptoAccount(
            result.cbor.toString('hex'),
          );
        } else {
          setErrorMessage(
            t(
              'Invalid QR code. Please scan the sync QR code of the hardware wallet.',
            ),
          );
          return;
        }

        onScanFinish();
      }
    } catch (e) {
      console.error(e);
      scannedRef.current = false;
      setErrorMessage(
        t(
          'Invalid QR code. Please scan the sync QR code of the hardware wallet.',
        ),
      );
    }
  };

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.keystone.scan.title')}
      />
      <View style={styles.main}>
        <Text style={styles.text}>
          {t('page.newAddress.keystone.scan.description')}
        </Text>
        <View style={styles.imageWrapper}>
          <QRCodeScanner
            onCodeScanned={handleCodeScanned}
            containerStyle={styles.scanner}
          />
        </View>
      </View>
    </View>
  );
};
