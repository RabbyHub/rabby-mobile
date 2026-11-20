import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { colord } from 'colord';
import { Code } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import {
  modalScannerEvents,
  ModalScannerEventType,
  useAccountSelectModalCtx,
} from '../hooks';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import RNHelpers from '@/core/native/RNHelpers';
import { touchedFeedback } from '@/utils/touch';
import { resolveGalleryQrCodePayloads } from './scanQrcodeResult';

const CAMERA_WIDTH = Dimensions.get('window').width - 70;
// Bound decode memory; QR codes in screenshots and photos stay readable.
const GALLERY_IMAGE_MAX_SIZE = 2048;

export const ScreenPanelScanner = () => {
  const { nextScanFor, fnNavTo } = useAccountSelectModalCtx();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [isPickingImage, setIsPickingImage] = useState(false);
  const isPickingImageRef = useRef(false);
  // Results of an outdated pick (panel left, sheet closed, app locked) are dropped.
  const pickRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      pickRequestIdRef.current += 1;
    };
  }, []);

  const handleCodeScanned = React.useCallback(
    (data: Code[]) => {
      if (isPickingImageRef.current) {
        return;
      }
      fnNavTo(nextScanFor || 'default', {
        inputValue: data[0]?.value,
      });
    },
    [fnNavTo, nextScanFor],
  );

  const handlePickFromGallery = useCallback(async () => {
    if (isPickingImageRef.current) {
      return;
    }
    touchedFeedback();
    const requestId = ++pickRequestIdRef.current;
    isPickingImageRef.current = true;
    setIsPickingImage(true);

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        maxWidth: GALLERY_IMAGE_MAX_SIZE,
        maxHeight: GALLERY_IMAGE_MAX_SIZE,
      });
      const imageUri = result.assets?.find(asset => !!asset.uri)?.uri;

      let payloads: string[] | null = null;
      if (imageUri) {
        try {
          // Always decode with deletion so the picked copy never stays in cache.
          payloads = await RNHelpers.decodeQRCodeFromImageFile(imageUri, true);
        } catch {
          payloads = null;
        }
      }

      if (requestId !== pickRequestIdRef.current || result.didCancel) {
        return;
      }
      if (result.errorCode || !payloads) {
        if (result.errorCode) {
          console.error(
            '[ScanQrcode] launchImageLibrary error',
            result.errorCode,
          );
        }
        toast.error(
          t('page.selectAccountSheetModal.scanQrcode.readImageFailed'),
        );
        return;
      }

      const resolved = resolveGalleryQrCodePayloads(payloads);
      switch (resolved.status) {
        case 'success':
          fnNavTo(nextScanFor || 'default', { inputValue: resolved.value });
          break;
        case 'not-found':
          toast.error(t('page.selectAccountSheetModal.scanQrcode.noQrCode'));
          break;
        case 'multiple':
          toast.error(
            t('page.selectAccountSheetModal.scanQrcode.multipleQrCodes'),
          );
          break;
        case 'invalid':
          toast.error(
            t('page.selectAccountSheetModal.scanQrcode.invalidAddress'),
          );
          break;
      }
    } catch {
      console.error('[ScanQrcode] pick image from gallery failed');
      if (requestId === pickRequestIdRef.current) {
        toast.error(
          t('page.selectAccountSheetModal.scanQrcode.readImageFailed'),
        );
      }
    } finally {
      if (requestId === pickRequestIdRef.current) {
        isPickingImageRef.current = false;
        setIsPickingImage(false);
      }
    }
  }, [fnNavTo, nextScanFor, t]);

  return (
    <View style={styles.main}>
      <View style={styles.wrapper}>
        <QRCodeScanner
          containerStyle={styles.containerStyle}
          onCodeScanned={handleCodeScanned}
          size={CAMERA_WIDTH}
          active={!isPickingImage}
          permissionTipStyle={styles.permissionTip}
        />
        <Button
          type="plain"
          height={48}
          containerStyle={styles.galleryButtonContainer}
          title={t('page.selectAccountSheetModal.scanQrcode.chooseFromGallery')}
          disabled={isPickingImage}
          onPress={handlePickFromGallery}
        />
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  main: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    // backgroundColor: ctx.colors2024['black'],
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    // ...makeDevOnlyStyle({
    //   backgroundColor: 'white',
    // })
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  containerStyle: {
    width: CAMERA_WIDTH,
    height: CAMERA_WIDTH,
    borderColor: colord(ctx.colors2024['neutral-line']).alpha(0.5).toHex(),
  },
  permissionTip: {
    color: ctx.colors2024['neutral-body'],
  },
  galleryButtonContainer: {
    width: CAMERA_WIDTH,
    marginTop: 60,
  },
}));
