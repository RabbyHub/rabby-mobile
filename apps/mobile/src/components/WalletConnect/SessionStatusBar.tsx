import { killWalletConnectConnector } from '@/core/apis/walletconnect';
import { useSessionStatus } from '@/hooks/useSessionStatus';
import React, { useMemo } from 'react';
import { SessionSignal } from './SessionSignal';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDisplayBrandName } from '@/hooks/walletconnect/useDisplayBrandName';
import { useThemeColors } from '@/hooks/theme';
import { apisWalletConnect } from '@/core/apis';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet } from '@/hooks/walletconnect/util';

interface Props {
  address: string;
  brandName: string;
  bgColor?: string;
  textColor?: string;
}

export const SessionStatusBar: React.FC<Props> = ({
  address,
  brandName,
  bgColor,
  textColor,
}) => {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: 4,
          padding: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: bgColor || 'rgba(0,0,0,0.1)',
        },
        leftBox: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        text: {
          fontSize: 12,
          fontWeight: '400',

          color: textColor || colors['neutral-title-2'],
        },
        underline: {
          textDecorationLine: 'underline',
        },
      }),
    [bgColor, colors, textColor],
  );

  const { findWalletServiceByBrandName } = useValidWalletServices();

  const { status } = useSessionStatus(
    {
      address,
      brandName,
    },
    true,
  );
  const [displayBrandName] = useDisplayBrandName(brandName, address);

  const tipStatus = React.useMemo(() => {
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

  const handleButton = async () => {
    if (tipStatus === 'CONNECTED') {
      killWalletConnectConnector(address, brandName, true);
    } else if (tipStatus === 'DISCONNECTED') {
      killWalletConnectConnector(address, brandName, true);
      const service = findWalletServiceByBrandName(brandName);
      if (service) {
        const uri = await apisWalletConnect.getUri(service?.walletInfo.brand);
        if (uri) {
          openWallet(service, uri);
        }
      }
    } else if (tipStatus === 'ACCOUNT_ERROR') {
    }
  };

  const content = useMemo(() => {
    switch (tipStatus) {
      case 'DISCONNECTED':
        return `Not connected to ${displayBrandName}`;

      default:
        return `${displayBrandName} is connected`;
    }
  }, [displayBrandName, tipStatus]);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.leftBox}>
          <SessionSignal address={address} brandName={brandName} size="small" />
          <Text style={styles.text}>{content}</Text>
        </View>
        <TouchableOpacity onPress={handleButton}>
          <Text style={[styles.text, styles.underline]}>
            {tipStatus === 'CONNECTED' ? 'Disconnect' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};
