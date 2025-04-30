import { Alert, Text, TouchableOpacity } from 'react-native';
import PhotoSVG from '@/assets/icons/common/photo.svg';
import { useTranslation } from 'react-i18next';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { BarcodeFormat, detectBarcodes } from 'react-native-barcodes-detector';
import { launchImageLibrary } from 'react-native-image-picker';
import { ThemeColors2024 } from '@/constant/theme';

export const QRCodePicker: React.FC<{
  onCodeScanned: (val: string | null) => void;
}> = ({ onCodeScanned }) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const handlePicker = React.useCallback(async () => {
    try {
      // Select an image through `react-native-image-picker`.
      const selectedImage = await launchImageLibrary({ mediaType: 'photo' });

      // Get the image url to process.
      const nextImageUri = selectedImage?.assets?.[0].uri || null;

      // Narrow down the list of barcodes to detect.
      // This will improve the performance of the process.
      const formats = [BarcodeFormat.QR_CODE];

      if (nextImageUri !== null) {
        // Execute the detection process.
        const result = await detectBarcodes(nextImageUri, formats);

        // Log the array of barcodes obtained.
        const value = result[0]?.rawValue;
        if (value) {
          onCodeScanned(value);
        } else {
          Alert.alert(t('page.scan.noQRCodeFound'));
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('page.scan.noQRCodeFound'));
    }
  }, [onCodeScanned, t]);

  return (
    <TouchableOpacity onPress={handlePicker} style={styles.root}>
      <PhotoSVG />
      <Text style={styles.text}>{t('page.scan.selectFromAlbum')}</Text>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({}) => ({
  root: {
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
    bottom: 60,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    color: ThemeColors2024.dark['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
}));
