import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import { UR, UREncoder } from '@ngraveio/bc-ur';
import { useTranslation, Trans } from 'react-i18next';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { StyleSheet, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Text } from '@/components/Typography';

interface IProps {
  type: string;
  cbor: string;
  onSign: () => void;
  brandName?: string;
  playerSize?: number;
  layoutStyle?: 'compact' | 'normal';
}

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
    qrCodeContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrCode: {
      backgroundColor: 'white',
      padding: 5,
    },
  });

const AnimatedQRCode = ({
  urEncoder,
  size,
}: {
  urEncoder: UREncoder;
  size: number;
}) => {
  const [currentQRCode, setCurrentQRCode] = useState(() =>
    urEncoder.nextPart(),
  );

  useEffect(() => {
    if (urEncoder.fragmentsLength <= 1) {
      return;
    }
    // Wait for each React commit before scheduling more QR work.
    const id = setTimeout(() => {
      setCurrentQRCode(urEncoder.nextPart());
    }, 100);
    return () => {
      clearTimeout(id);
    };
  }, [currentQRCode, urEncoder]);

  return <QRCode value={currentQRCode.toUpperCase()} size={size} />;
};

const Player = ({
  type,
  cbor,
  onSign,
  brandName,
  playerSize,
  layoutStyle = 'compact',
}: IProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const urEncoder = useMemo(
    // For NGRAVE ZERO support please keep to a maximum fragment size of 200
    () => new UREncoder(new UR(Buffer.from(cbor, 'hex'), type), 200),
    [cbor, type],
  );
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <Text style={styles.description}>
        <Trans
          i18nKey="page.signFooterBar.qrcode.qrcodeDesc"
          values={{
            brand: brandName,
          }}
        />
      </Text>
      <View style={styles.qrCodeContainer}>
        <View style={styles.qrCode}>
          <AnimatedQRCode
            key={`${type}:${cbor}`}
            urEncoder={urEncoder}
            size={playerSize ?? 165}
          />
        </View>
      </View>

      <FooterButton
        title={t('page.signFooterBar.qrcode.getSig')}
        type="primary"
        onPress={onSign}
      />
    </View>
  );
};

export default Player;
