// import { Account } from '@/background/service/preference';
// import { ReactComponent as RcIconCheckedCC } from '@/ui/assets/icon-checked-cc.svg';
// import { useThemeMode } from '@/ui/hooks/usePreference';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import clsx from 'clsx';
// import { KEYRING_CLASS } from 'consts';
import React, { ReactNode, useMemo } from 'react';
// import { ReactComponent as LedgerSVG } from 'ui/assets/walletlogo/ledger.svg';
import {
  ActionGroup,
  Props as ActionGroupProps,
} from '../FooterBar/ActionGroup';
import { GasLessConfig } from '../FooterBar/GasLessComponents';
import { ProcessActions } from '../FooterBar/ProcessActions';
import { Dots } from '../Popup/Dots';
import { BatchSignTxTaskType } from './useBatchSignTxTask';
import { useTranslation } from 'react-i18next';
import { Account } from '@/core/services/preference';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { RcIconCheckedCC } from '@/assets/icons/common';
import { StyleSheet, Text, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';

interface Props extends ActionGroupProps {
  chain?: Chain;
  gnosisAccount?: Account;
  securityLevel?: Level;
  origin?: string;
  originLogo?: string;
  hasUnProcessSecurityResult?: boolean;
  hasShadow?: boolean;
  isTestnet?: boolean;
  engineResults?: Result[];
  useGasLess?: boolean;
  showGasLess?: boolean;
  enableGasLess?: () => void;
  canUseGasLess?: boolean;
  Header?: React.ReactNode;
  Main?: React.ReactNode;
  gasLessFailedReason?: string;
  isWatchAddr?: boolean;
  gasLessConfig?: GasLessConfig;
  isGasNotEnough?: boolean;
  task: BatchSignTxTaskType;
  footer?: ReactNode;
}

export const MiniCommonAction: React.FC<Props> = ({
  origin,
  originLogo,
  gnosisAccount,
  securityLevel,
  engineResults = [],
  hasUnProcessSecurityResult,
  hasShadow = false,
  showGasLess = false,
  useGasLess = false,
  canUseGasLess = false,
  enableGasLess,
  Header,
  Main,
  gasLessFailedReason,
  isWatchAddr,
  gasLessConfig,
  task,
  account,
  footer,
  ...props
}) => {
  const binaryTheme = useGetBinaryMode();
  const isDarkTheme = binaryTheme === 'dark';
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { t } = useTranslation();
  return (
    <>
      {task.status === 'idle' ? (
        <>
          <ActionGroup account={account} gasLess={useGasLess} {...props} />
          {footer}
        </>
      ) : task.status === 'completed' ? (
        <>
          <View style={[styles.statusContainer, styles.statusContainerSuccess]}>
            <RcIconCheckedCC
              color={colors['green-default']}
              width={16}
              height={16}
            />
            <Text style={[styles.statusText, styles.statusTextSuccess]}>
              {t('page.miniSignFooterBar.status.txCreated')}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {t('page.miniSignFooterBar.status.txSigned')}
          </Text>
          <Dots />
        </View>
      )}
    </>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
      gap: 8,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 6,

      marginTop: 10,
    },
    statusContainerSuccess: {
      backgroundColor: colors['green-light'],
    },
    statusText: {
      fontSize: 16,
      lineHeight: 19,
      fontWeight: '500',
      color: colors['neutral-body'],
    },
    statusTextSuccess: {
      color: colors['green-default'],
    },
  });
