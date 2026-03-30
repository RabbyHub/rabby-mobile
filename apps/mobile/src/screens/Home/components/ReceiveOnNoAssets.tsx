import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { Account } from '@/core/services/preference';
import { RNTouchableOpacity } from '@/components/customized/reexports';

import IconBtnCopyCC from '../icons/btn-copy-cc.svg';

import Clipboard from '@react-native-clipboard/clipboard';
import { touchedFeedback } from '@/utils/touch';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';

const SIZES = {
  qrCodeSize: 163,
  qrCodeWrapperPadding: 8,
};

export function ReceiveOnNoAssets({ account }: { account?: Account | null }) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  if (!account?.address) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {t('page.address.receiveAssets.title')}
        </Text>

        <View style={styles.qrCodeWrapper}>
          <QRCode size={SIZES.qrCodeSize} value={account.address} />
        </View>

        <RNTouchableOpacity
          style={styles.btnCopyAddress}
          onPress={() => {
            touchedFeedback();
            Clipboard.setString(account.address);
            toastCopyAddressSuccess(account.address);
          }}>
          <IconBtnCopyCC width={20} height={20} style={styles.btnCopyIcon} />
          <Text style={styles.btnText}>
            {t('page.address.receiveAssets.btnCopyAddress')}
          </Text>
        </RNTouchableOpacity>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      flex: 1,
      width: '100%',
      paddingHorizontal: 16,
    },
    card: {
      width: '100%',
      padding: 16,
      paddingVertical: 24,
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-1'],
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    title: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 800,
      lineHeight: 22,
      textAlign: 'center',
    },
    qrCodeWrapper: {
      padding: SIZES.qrCodeWrapperPadding,
      justifyContent: 'center',
      alignItems: 'center',
      width: SIZES.qrCodeSize + SIZES.qrCodeWrapperPadding * 2,
      height: SIZES.qrCodeSize + SIZES.qrCodeWrapperPadding * 2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      backgroundColor: colors2024['neutral-bg-1'],
      overflow: 'hidden',
    },
    btnCopyAddress: {
      width: 185,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      paddingVertical: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
    },
    btnCopyIcon: {
      width: 23,
      height: 23,
      color: colors2024['neutral-title-1'],
      marginRight: 4,
    },
    btnText: {
      color: colors2024['neutral-title-1'],
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 22,
    },
  };
});
