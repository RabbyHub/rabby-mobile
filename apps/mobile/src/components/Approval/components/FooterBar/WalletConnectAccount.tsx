import { Button } from '@/components';
import { SessionSignal } from '@/components/WalletConnect/SessionSignal';
import { KEYRINGS_LOGOS } from '@/constant/icon';
import { AppColorsVariants } from '@/constant/theme';
import { apisWalletConnect } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { useThemeColors } from '@/hooks/theme';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { useSessionStatus } from '@/hooks/useSessionStatus';
import { useConnectWallet } from '@/hooks/walletconnect/useConnectWallet';
import { useDisplayBrandName } from '@/hooks/walletconnect/useDisplayBrandName';
import { useSessionChainId } from '@/hooks/walletconnect/useSessionChainId';
import { useWalletConnectIcon } from '@/hooks/walletconnect/useWalletConnectIcon';
import { WALLET_INFO } from '@/utils/walletInfo';
import { Chain } from '@/constant/chains';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CommonAccount } from './CommonAccount';
import { WALLET_NAME } from '@rabby-wallet/keyring-utils';

export interface Props {
  account: Account;
  chain?: Chain;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    text: {
      color: colors['blue-default'],
      lineHeight: 20,
      fontSize: 13,
      position: 'absolute',
      right: 0,
      top: -1,
    },
    button: {
      backgroundColor: colors['blue-default'],
      height: 40,
      marginTop: 12,
      width: '100%',
    },
    buttonText: {
      color: colors['neutral-title-2'],
      fontSize: 16,
    },
    accountErrorText: {
      marginTop: 6,
      color: colors['orange-default'],
      fontSize: 13,
      lineHeight: 15,
    },
    accountErrorText2: {
      marginTop: 8,
      flexWrap: 'wrap',
    },
    disconnectText: {
      color: colors['red-default'],
      fontSize: 13,
      lineHeight: 20,
    },
    connectText: {
      color: colors['neutral-foot'],
      fontSize: 13,
      lineHeight: 20,
    },
    tipConnect: {
      flex: 1,
      paddingHorizontal: 5,
    },
  });

const TipContent = ({
  tipStatus,
  chain,
  displayBrandName,
}: {
  tipStatus: string;
  chain?: Props['chain'];
  displayBrandName: string;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  switch (tipStatus) {
    case 'ACCOUNT_ERROR':
      return (
        <View style={styles.tipConnect}>
          <Text style={styles.accountErrorText}>
            {t('page.signFooterBar.walletConnect.connectedButCantSign')}
          </Text>
          <Text
            style={StyleSheet.flatten([
              styles.accountErrorText,
              styles.accountErrorText2,
            ])}>
            {t('page.signFooterBar.walletConnect.switchToCorrectAddress')}
          </Text>
        </View>
      );
    // case 'CHAIN_ERROR':
    //   return (
    //     <View style={styles.tipConnect}>
    //       <Text style={styles.accountErrorText}>
    //         {t('page.signFooterBar.walletConnect.connectedButCantSign')}
    //       </Text>
    //       <Text
    //         style={StyleSheet.flatten([
    //           styles.accountErrorText,
    //           styles.accountErrorText2,
    //         ])}>
    //         {t('page.signFooterBar.walletConnect.switchChainAlert', {
    //           chain: chain?.name,
    //         })}
    //       </Text>
    //     </View>
    //   );
    case 'DISCONNECTED':
      return (
        <Text style={styles.disconnectText}>
          {t('page.signFooterBar.walletConnect.notConnectToMobile', {
            brand: displayBrandName,
          })}
        </Text>
      );

    default:
      return (
        <Text style={styles.connectText}>
          {t('page.signFooterBar.walletConnect.connected')}
        </Text>
      );
  }
};

export const WalletConnectAccount: React.FC<Props> = ({ account, chain }) => {
  const { activePopup, setAccount, setVisible } = useCommonPopupView();
  const { t } = useTranslation();
  const { address, brandName, type } = account;
  const brandIcon = useWalletConnectIcon({
    address,
    brandName,
    type,
  });
  const addressTypeIcon = React.useMemo(
    () => brandIcon || WALLET_INFO?.[brandName]?.icon || KEYRINGS_LOGOS[type],
    [type, brandName, brandIcon],
  );
  const [displayBrandName, realBrandName] = useDisplayBrandName(
    brandName,
    address,
  );
  const { status } = useSessionStatus(
    {
      address,
      brandName,
    },
    true,
  );
  const sessionChainId = useSessionChainId({
    address,
    brandName,
  });

  const tipStatus = React.useMemo(() => {
    // if (chain && chain.id !== sessionChainId && status === 'CONNECTED') {
    //   return 'CHAIN_ERROR';
    // }
    switch (status) {
      case 'ACCOUNT_ERROR':
        return 'ACCOUNT_ERROR';
      case undefined:
      case 'DISCONNECTED':
      case 'RECEIVED':
      case 'REJECTED':
      case 'BRAND_NAME_ERROR':
        return 'DISCONNECTED';

      default:
        return 'CONNECTED';
    }
  }, [status]);

  React.useEffect(() => {
    if (
      brandName === WALLET_NAME.MetaMask &&
      chain &&
      sessionChainId &&
      chain.id !== sessionChainId
    ) {
      apisWalletConnect.walletConnectSwitchChain(account, chain.id);
    }
  }, [sessionChainId, chain, account, brandName]);

  const connectWallet = useConnectWallet();
  // const toastHiddenRef = React.useRef<ReturnType<(typeof toast)['info']>>();

  const handleButton = () => {
    setAccount({
      address,
      brandName,
      realBrandName,
      chainId: chain?.id,
    });
    if (tipStatus === 'DISCONNECTED') {
      connectWallet({ address, brandName });
      // if (toastHiddenRef.current) {
      //   toastHiddenRef.current();
      // }
      // toastHiddenRef.current = toastWithIcon(() => (
      //   <ActivityIndicator
      //     style={{
      //       marginRight: 6,
      //     }}
      //   />
      // ))('Connecting', {
      //   duration: 100000,
      //   position: toast.positions.CENTER,
      //   hideOnPress: false,
      // });
    } else if (tipStatus === 'ACCOUNT_ERROR') {
      activePopup('SWITCH_ADDRESS');
    }
    // else if (tipStatus === 'CHAIN_ERROR') {
    //   activePopup('SWITCH_CHAIN');
    // }
  };

  React.useEffect(() => {
    if (
      tipStatus === 'ACCOUNT_ERROR'
      // || tipStatus === 'CHAIN_ERROR'
    ) {
      setVisible(false);
    } else if (tipStatus === 'CONNECTED') {
      // toastHiddenRef.current?.();
    }
  }, [tipStatus, setVisible]);

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  React.useEffect(() => {
    return () => {
      // toastHiddenRef.current?.();
    };
  }, []);

  return (
    <CommonAccount
      customSignal={
        <SessionSignal
          chainId={chain?.id}
          pendingConnect={true}
          isBadge
          address={address}
          brandName={brandName}
        />
      }
      tip={
        <TipContent
          tipStatus={tipStatus}
          chain={chain}
          displayBrandName={displayBrandName}
        />
      }
      icon={addressTypeIcon}
      footer={
        tipStatus === 'DISCONNECTED' && (
          <Button
            onPress={handleButton}
            buttonStyle={styles.button}
            titleStyle={styles.buttonText}
            type="primary"
            title={t('page.signFooterBar.connectButton')}
          />
        )
      }>
      <TouchableOpacity onPress={handleButton}>
        <Text style={styles.text}>
          {tipStatus === 'ACCOUNT_ERROR' &&
            t('page.signFooterBar.walletConnect.howToSwitch')}
          {/* {tipStatus === 'CHAIN_ERROR' &&
            t('page.signFooterBar.walletConnect.howToSwitch')} */}
        </Text>
      </TouchableOpacity>
    </CommonAccount>
  );
};
