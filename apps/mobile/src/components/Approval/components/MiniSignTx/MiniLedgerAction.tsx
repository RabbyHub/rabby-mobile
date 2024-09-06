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
import { ReactNode } from 'react';
import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';
import React from 'react';
import { useGetBinaryMode } from '@/hooks/theme';
import { isLedgerLockError } from '@/utils/ledger';
import { eventBus, EVENTS } from '@/utils/events';
import { useTranslation } from 'react-i18next';
import { ProcessActions } from '../FooterBar/ProcessActions';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { RcIconCheckedCC } from '@/assets/icons/common';
import clsx from 'clsx';
import { Dots } from '../Popup/Dots';
import { Text, View } from 'react-native';

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
  const { txStatus, total, currentActiveIndex: current } = task;

  const { status } = useLedgerStatus(account.address);

  const [visibleLedgerConnectModal, setVisibleLedgerConnectModal] =
    React.useState(false);

  React.useEffect(() => {
    const listener = msg => {
      if (isLedgerLockError(msg) || msg === 'DISCONNECTED') {
        setVisibleLedgerConnectModal(true);
        task.stop();

        // if (msg !== 'DISCONNECTED') {
        //   task.addRevokeTask(task.currentApprovalRef.current!, 1);
        // }
      }
    };

    eventBus.addListener(EVENTS.LEDGER.REJECTED, listener);

    return () => {
      eventBus.removeListener(EVENTS.LEDGER.REJECTED, listener);
    };
  }, [task]);

  const handleSubmit = useMemoizedFn(() => {
    if (status === 'DISCONNECTED') {
      setVisibleLedgerConnectModal(true);
      return;
    }
    onSubmit();
  });

  React.useEffect(() => {
    if (task.status === 'active' && status === 'DISCONNECTED') {
      eventBus.emit(EVENTS.LEDGER.REJECTED, 'DISCONNECTED');
    }
  }, [task.status, status]);
  const { t } = useTranslation();

  return (
    <>
      {/* <Popup
        height={320}
        visible={visibleLedgerConnectModal}
        closable
        onCancel={() => setVisibleLedgerConnectModal(false)}
        title={t('page.dashboard.hd.ledgerIsDisconnected')}
        maskStyle={{
          backgroundColor: 'transparent',
        }}>
        <Ledger isModalContent />
      </Popup> */}

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
            }>
            <View className="flex items-center gap-[8px] justify-center">
              <LedgerSVG width={22} height={22} viewBox="0 0 28 28" />
              <Text>{t('page.miniSignFooterBar.signWithLedger')}</Text>
            </View>
          </ProcessActions>

          {footer}
        </>
      ) : task.status === 'completed' ? (
        <>
          <View
            className={clsx(
              'rounded-[6px] bg-r-green-light p-[14px] text-r-green-default text-[16px] leading-[20px] font-medium',
              'flex items-center justify-center gap-[8px]',
            )}>
            <RcIconCheckedCC
              viewBox="0 0 20 20"
              className="text-r-green-default w-[16px] h-[16px]"
            />

            <Text>{t('page.miniSignFooterBar.status.txCreated')}</Text>
          </View>
        </>
      ) : current + 1 === total && txStatus === 'signed' ? (
        <View className="rounded-[6px] bg-r-neutral-card2 p-[14px] text-r-neutral-body text-[16px] leading-[20px] font-medium text-center">
          <Text>{t('page.miniSignFooterBar.status.txSigned')}</Text>
          <Dots />
        </View>
      ) : (
        <View className="rounded-[6px] bg-r-neutral-card2 p-[14px] text-r-neutral-body text-[16px] leading-[20px] font-medium text-center">
          {total > 1 ? (
            <>
              <Text>
                {t('page.miniSignFooterBar.status.txSendings', {
                  current: current + 1,
                  total: total,
                })}
              </Text>
              <Dots />
            </>
          ) : (
            <>
              <Text>{t('page.miniSignFooterBar.status.txSending')}</Text>{' '}
              <Dots />
            </>
          )}
        </View>
      )}
    </>
  );
};
