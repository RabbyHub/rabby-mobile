import React, { useRef, useState, useMemo } from 'react';
import { ETHSignature } from '@keystonehq/bc-ur-registry-eth';
import * as uuid from 'uuid';
import { useTranslation } from 'react-i18next';
import { URDecoder } from '@ngraveio/bc-ur';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { RcArrowRightCC } from '@/assets/icons/common';
import { Code } from 'react-native-vision-camera';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    description: {
      fontSize: 13,
      lineHeight: 18,
      color: colors['neutral-title-1'],
      fontWeight: '400',
      textAlign: 'center',
    },
    root: {
      position: 'relative',
    },
    qrCode: {
      marginTop: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanner: {
      width: 200,
      height: 200,
    },
    footer: {
      height: 50,
    },
    arrow: {
      width: 48,
      height: 48,
      transform: [{ rotate: '180deg' }],
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: -50,
    },
  });

const Reader = ({ requestId, setErrorMessage, brandName, onScan, onBack }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const decoder = useRef(new URDecoder());
  const [progress, setProgress] = useState(0);

  const handleSuccess = async (codes: Code[]) => {
    const data = codes[0].value!;
    decoder.current.receivePart(data);
    setProgress(Math.floor(decoder.current.estimatedPercentComplete() * 100));
    if (decoder.current.isComplete()) {
      const ur = decoder.current.resultUR();
      if (ur.type === 'eth-signature') {
        const ethSignature = ETHSignature.fromCBOR(ur.cbor);
        const buffer = ethSignature.getRequestId();
        const signId = uuid.stringify(buffer as any);
        if (signId === requestId) {
          onScan(ur.cbor.toString('hex'));
          return;
        }
        setErrorMessage(t('page.signFooterBar.qrcode.misMatchSignId'));
      } else {
        setErrorMessage(t('page.signFooterBar.qrcode.unknownQRCode'));
      }
    }
  };

  return (
    <View style={styles.root}>
      <TouchableOpacity onPress={onBack} style={styles.arrow}>
        <RcArrowRightCC color={colors['neutral-title-1']} />
      </TouchableOpacity>
      <Text style={styles.description}>
        {t('page.signFooterBar.qrcode.afterSignDesc', { brand: brandName })}
      </Text>
      <View style={styles.qrCode}>
        <QRCodeScanner
          onCodeScanned={handleSuccess}
          containerStyle={styles.scanner}
        />
      </View>
      <View style={styles.footer} />
    </View>
  );
};

export default Reader;
