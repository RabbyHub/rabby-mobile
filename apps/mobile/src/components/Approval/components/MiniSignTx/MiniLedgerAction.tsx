// import { Account } from '@/background/service/preference';
// import { ReactComponent as RcIconCheckedCC } from '@/ui/assets/icon-checked-cc.svg';
// import { useThemeMode } from '@/ui/hooks/usePreference';
// import { Chain } from '@debank/common';
// import { Result } from '@rabby-wallet/rabby-security-engine';
// import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
// import clsx from 'clsx';
// import { EVENTS, KEYRING_CLASS } from 'consts';
// import React, { ReactNode } from 'react';
// import { ReactComponent as LedgerSVG } from 'ui/assets/walletlogo/ledger.svg';
import {
  ActionGroup,
  Props as ActionGroupProps,
} from '../FooterBar/ActionGroup';
// import { GasLessConfig } from '../FooterBar/GasLessComponents';
// import { ProcessActions } from '../FooterBar/ProcessActions';
// import { Dots } from '../Popup/Dots';
// import { BatchSignTxTaskType } from './useBatchSignTxTask';
// import { useLedgerStatus } from '@/ui/component/ConnectStatus/useLedgerStatus';
// import { isLedgerLockError } from '@/ui/utils/ledger';
// import eventBus from '@/eventBus';
// import { Popup } from '@/ui/component';
// import { useTranslation } from 'react-i18next';
// import { Ledger } from '../../../CommonPopup/Ledger';
import { Chain } from '@/constant/chains';
import { Account } from '@/core/services/preference';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { useMemoizedFn } from 'ahooks';
import { GasLessConfig } from '../FooterBar/GasLessComponents';
import { BatchSignTxTaskType } from './useBatchSignTxTask';
import { ReactNode, useMemo } from 'react';
import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';
import React from 'react';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { isLedgerLockError } from '@/utils/ledger';
import { eventBus, EVENTS } from '@/utils/events';
import { useTranslation } from 'react-i18next';
import { ProcessActions } from '../FooterBar/ProcessActions';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { RcIconCheckedCC } from '@/assets/icons/common';
import clsx from 'clsx';
import { Dots } from '../Popup/Dots';
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

export const MiniLedgerAction: React.FC<Props> = ({
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
  onSubmit,
  ...props
}) => {
  const binaryTheme = useGetBinaryMode();
  const isDarkTheme = binaryTheme === 'dark';
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { txStatus, total, currentActiveIndex: current } = task;
  const { status, onClickConnect } = useLedgerStatus(account.address);
  const { t } = useTranslation();

  const handleSubmit = useMemoizedFn(() => {
    if (status !== 'CONNECTED') {
      onClickConnect(() => {
        onSubmit?.();
      });
      return;
    }
    onSubmit?.();
  });

  return (
    <>
      {task.status === 'idle' ? (
        <>
          <ProcessActions
            account={account}
            gasLess={useGasLess}
            {...props}
            onSubmit={handleSubmit}
            disabledProcess={useGasLess ? false : props.disabledProcess}
            enableTooltip={useGasLess ? false : props.enableTooltip}
            gasLessThemeColor={
              isDarkTheme
                ? gasLessConfig?.dark_color
                : gasLessConfig?.theme_color
            }
            buttonIcon={
              <LedgerSVG width={22} height={22} viewBox="0 0 28 28" />
            }
            submitText={t('page.miniSignFooterBar.signWithLedger')}
          />
          {footer}
        </>
      ) : task.status === 'completed' ? (
        <>
          <View style={[styles.statusContainer, styles.statusContainerSuccess]}>
            <RcIconCheckedCC
              width={16}
              height={16}
              color={colors['green-default']}
            />

            <Text style={[styles.statusText, styles.statusTextSuccess]}>
              {t('page.miniSignFooterBar.status.txCreated')}
            </Text>
          </View>
        </>
      ) : current + 1 === total && txStatus === 'signed' ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {t('page.miniSignFooterBar.status.txSigned')}
          </Text>
          <Dots />
        </View>
      ) : (
        <View style={styles.statusContainer}>
          {total > 1 ? (
            <>
              <Text style={styles.statusText}>
                {t('page.miniSignFooterBar.status.txSendings', {
                  current: current + 1,
                  total: total,
                })}
              </Text>
              <Dots />
            </>
          ) : (
            <>
              <Text style={styles.statusText}>
                {t('page.miniSignFooterBar.status.txSending')}
              </Text>
              <Dots />
            </>
          )}
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
