import React from 'react';
import { CommonAccount } from './CommonAccount';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    disconnectText: {
      color: colors['red-default'],
      fontSize: 13,
      lineHeight: 20,
    },
    connectButtonText: {
      color: colors['blue-default'],
      fontSize: 13,
    },
    connectText: {
      color: colors['neutral-foot'],
      fontSize: 13,
      lineHeight: 20,
    },
    disconnect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },
  });

const TipContent = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <Text style={styles.connectText}>
      {t('page.signFooterBar.importedByLedger')}
    </Text>
  );
};

export const LedgerAccount: React.FC<{}> = () => {
  return <CommonAccount icon={LedgerSVG} tip={<TipContent />} />;
};
