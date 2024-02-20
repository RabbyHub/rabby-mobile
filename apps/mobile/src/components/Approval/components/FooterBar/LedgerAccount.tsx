import React from 'react';
import { CommonAccount } from './CommonAccount';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { Account } from '@/core/services/preference';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    disconnectText: {
      color: colors['red-default'],
      fontSize: 13,
      lineHeight: 20,
    },
    connectButtonText: {
      color: colors['neutral-body'],
      fontSize: 13,
      textDecorationLine: 'underline',
    },
    connectText: {
      color: colors['neutral-foot'],
      fontSize: 13,
    },
    disconnect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },
  });

const TipContent = ({
  status,
  onClickConnect,
}: {
  status: 'CONNECTED' | 'DISCONNECTED' | undefined;
  onClickConnect: () => void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  switch (status) {
    case 'CONNECTED':
      return (
        <Text style={styles.connectText}>
          {t('page.signFooterBar.ledgerConnected')}
        </Text>
      );

    case 'DISCONNECTED':
    default:
      return (
        <View style={styles.disconnect}>
          <Text style={styles.disconnectText}>
            {t('page.signFooterBar.ledgerNotConnected')}
          </Text>
          <TouchableOpacity onPress={onClickConnect}>
            <Text style={styles.connectButtonText}>
              {t('page.signFooterBar.connectButton')}
            </Text>
          </TouchableOpacity>
        </View>
      );
  }
};

export const LedgerAccount: React.FC<{
  account: Account;
}> = ({ account }) => {
  const { status, onClickConnect } = useLedgerStatus(account.address);
  const signal = React.useMemo(() => {
    switch (status) {
      case undefined:
      case 'DISCONNECTED':
        return 'DISCONNECTED';

      default:
        return 'CONNECTED';
    }
  }, [status]);

  return (
    <CommonAccount
      signal={signal}
      icon={LedgerSVG}
      tip={<TipContent status={status} onClickConnect={onClickConnect} />}
    />
  );
};
