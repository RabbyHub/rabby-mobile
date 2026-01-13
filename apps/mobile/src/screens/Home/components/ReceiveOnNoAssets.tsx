import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

import { Account } from '@/core/services/preference';
import { RNTouchableOpacity } from '@/components/customized/reexports';

import IconBgUsdCC from '../icons/bg-usd-cc.svg';
import IconNoAssetsReceive from '../icons/noassets-receive.svg';
import IconBtnCopyCC from '../icons/btn-copy-cc.svg';
import IconBgHomeImportTipCC from '../icons/bg-home-import-tip-cc.svg';

import Clipboard from '@react-native-clipboard/clipboard';
import { touchedFeedback } from '@/utils/touch';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { useTranslation } from 'react-i18next';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { useState } from 'react';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

const SIZES = {
  qrCodeSize: 163,
  qrCodeWrapperPadding: 8,
};

export function ReceiveOnNoAssets({
  account,
  isForSingle = false,
}: {
  account?: Account | null;
  isForSingle?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle });

  const { t } = useTranslation();

  const [importTipHeight, setImportTipHeight] = useState(0);

  if (!account?.address) return null;

  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 12 }}>
        <IconNoAssetsReceive width={105} height={74} />
      </View>
      <View style={styles.receiveContainer}>
        <Text style={styles.title}>
          {t('page.address.receiveAssets.title')}
        </Text>
        {!isForSingle && (
          <AddressItem account={account} fetchAccount={false}>
            {({ WalletIcon, WalletName }) => (
              <View style={styles.accountItem}>
                <WalletIcon style={styles.accountAvatar} />
                <WalletName style={styles.accountAddr} />
              </View>
            )}
          </AddressItem>
        )}

        <View style={styles.qrCodeWrapper}>
          <QRCode size={SIZES.qrCodeSize} value={account.address} />
        </View>

        <RNTouchableOpacity
          style={styles.btnCopyAddress}
          onPress={() => {
            touchedFeedback();
            Clipboard.setString(account?.address);
            toastCopyAddressSuccess(account.address);
          }}>
          <IconBtnCopyCC width={20} height={20} style={styles.btnCopyIcon} />
          <Text style={styles.btnText}>
            {t('page.address.receiveAssets.btnCopyAddress')}
          </Text>
        </RNTouchableOpacity>
      </View>

      {!isForSingle && (
        <RNTouchableOpacity
          style={styles.importTipContainer}
          onLayout={evt => {
            setImportTipHeight(evt.nativeEvent.layout.height);
          }}
          onPress={() => {
            touchedFeedback();

            // apiGlobalModal.showAddSelectMethodModal();
            naviPush(RootNames.StackAddress, {
              screen: RootNames.ImportMethods,
              params: {
                isNotNewUserProc: true,
                isFromEmptyAddress: true,
              },
            });
          }}>
          <View style={styles.importTipTexts}>
            <Text style={styles.importTipTitle}>
              {t('page.address.receiveAssets.importTip.title')}
            </Text>
            <Text style={styles.importTipDesc}>
              {t('page.address.receiveAssets.importTip.desc')}
            </Text>
          </View>
          <IconBgHomeImportTipCC
            width={26}
            height={26}
            style={[
              styles.importTipIcon,
              !!importTipHeight && { top: importTipHeight / 2 - 13 },
            ]}
          />
        </RNTouchableOpacity>
      )}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 12,
    },

    receiveContainer: {
      width: '100%',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors2024['brand-light-1'],
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // ...makeDebugBorder(),
    },

    title: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 800,
      lineHeight: 22,
    },

    accountItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    accountAvatar: {
      width: 20,
      height: 20,
    },
    accountAddr: {
      marginLeft: 4,
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: 400,
      lineHeight: 20,
      color: colors2024['neutral-body'],
    },

    qrCodeWrapper: {
      marginTop: 12,
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
    qrCode: {
      width: '100%',
      height: '100%',
    },

    btnCopyAddress: {
      marginTop: 16,
      width: '100%',
      borderRadius: 8,
      backgroundColor: colors2024['brand-light-1'],
      height: 48,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnCopyIcon: {
      width: 20,
      height: 20,
      color: colors2024['brand-default'],
      marginRight: 4,
    },
    btnText: {
      color: colors2024['brand-default'],
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 22,
    },

    importTipContainer: {
      width: '100%',
      marginTop: 12,
      position: 'relative',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-5'],
      // ...makeDebugBorder(),
    },
    importTipTexts: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    importTipIcon: {
      position: 'absolute',
      right: 16,
      top: '50%',
      zIndex: -1,
    },
    importTipTitle: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 800,
      lineHeight: 22,
    },
    importTipDesc: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: 400,
      lineHeight: 20,
    },
  };
});

ReceiveOnNoAssets.BgWrapper = function BgWrapper({
  style,
  children,
  isForSingle = false,
}: React.PropsWithChildren<
  RNViewProps & {
    isForSingle?: boolean;
  }
>) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getBgWrapper });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.card}>
        <View
          style={[
            styles.usdIconWrapper,
            isForSingle && styles.usdIconWrapperSingle,
          ]}>
          <IconBgUsdCC
            style={styles.usdIcon}
            width={styles.usdIcon.width}
            height={styles.usdIcon.height}
          />
        </View>
        {children}
      </View>
    </View>
  );
};

const getBgWrapper = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      width: '100%',
      paddingHorizontal: 16,
    },
    card: {
      borderRadius: 16,
      position: 'relative',
      backgroundColor: colors2024['neutral-bg-1'],
      // ...makeDebugBorder(),
      minHeight: 384,
      width: '100%',
    },
    usdIconWrapperSingle: {
      top: 16,
    },
    usdIconWrapper: {
      position: 'absolute',
      right: 0,
      top: 40,
      zIndex: -1,
      // ...makeDebugBorder(),
    },
    usdIcon: {
      width: 47,
      height: 87,
      color: colors2024['brand-light-1'],
    },
  };
});
