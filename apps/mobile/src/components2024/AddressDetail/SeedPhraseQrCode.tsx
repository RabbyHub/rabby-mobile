import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { WINDOW_WIDTH } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import IconWarning from '@/assets/icons/address/warning-rouned.svg';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../Button';

export interface SeedPhraseQrCodeProps {
  data: string;
  onClose: () => void;
  /** @deprecated */
  onDone?: () => void;
}

export const SeedPhraseQrCode = ({ data, onClose }: SeedPhraseQrCodeProps) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={styles.qrCodeModalContainer}>
      <Text style={styles.title}>
        {t('page.backupSeedPhrase.qrCodePopupTitle')}
      </Text>
      <View style={styles.alert}>
        <IconWarning style={styles.warnIcon} />
        <Text style={styles.alertText}>
          {t('page.backupSeedPhrase.qrCodePopupTips')}
        </Text>
      </View>
      <View style={styles.qrCodeView}>
        <View style={styles.qrCodeWrap}>
          <QRCode value={data} size={248} />
        </View>
      </View>
      <Button type="primary" title={t('global.GotIt')} onPress={onClose} />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  title: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 12,
  },
  warnIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 18,
    height: 18,
  },
  alert: {
    padding: 12,
    paddingLeft: 34,
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 8,
  },
  alertText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'justify',
  },
  qrCodeModalContainer: {
    paddingHorizontal: 20,
  },
  qrCodeWrap: {
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    padding: 10,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 56,
  },
  qrCodeView: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
