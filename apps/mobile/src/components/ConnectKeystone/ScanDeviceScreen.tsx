import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { useTheme2024 } from '@/hooks/theme';
import { QRCodeScanner } from '../QRCodeScanner/QRCodeScanner';
import { Code } from 'react-native-vision-camera';
import { URDecoder } from '@ngraveio/bc-ur';
import { apiKeystone } from '@/core/apis';
import { createGetStyles2024 } from '@/utils/styles';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    height: '100%',
    position: 'relative',
  },
  main: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontSize: 17,
    color: colors2024['neutral-secondary'],
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  imageWrapper: {
    marginTop: 24,
    position: 'relative',
  },
  progress: {
    position: 'absolute',
    top: -15,
    left: -15,
  },
  scanner: {
    width: 250,
    height: 250,
  },
  titleText: {
    fontSize: 20,
    color: colors2024['neutral-title-1'],
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
  },
}));

export const ScanDeviceScreen: React.FC<{ onScanFinish: () => void }> = ({
  onScanFinish,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
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
        style={styles.titleText}
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
