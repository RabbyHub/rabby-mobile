// import { Account } from '@/background/service/preference';
// import { ReactComponent as RcIconCheckedCC } from '@/ui/assets/icon-checked-cc.svg';
// import { useThemeMode } from '@/ui/hooks/usePreference';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import clsx from 'clsx';
// import { KEYRING_CLASS } from 'consts';
import React, { ReactNode } from 'react';
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
import { useGetBinaryMode } from '@/hooks/theme';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { RcIconCheckedCC } from '@/assets/icons/common';
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

  const { t } = useTranslation();
  return (
    <>
      {task.status === 'idle' ? (
        <>
          <ActionGroup
            account={account}
            gasLess={useGasLess}
            {...props}
            disabledProcess={useGasLess ? false : props.disabledProcess}
            enableTooltip={useGasLess ? false : props.enableTooltip}
            gasLessThemeColor={
              isDarkTheme
                ? gasLessConfig?.dark_color
                : gasLessConfig?.theme_color
            }
          />
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
      ) : (
        <View className="rounded-[6px] bg-r-neutral-card2 p-[14px] text-r-neutral-body text-[16px] leading-[20px] font-medium text-center">
          <Text>{t('page.miniSignFooterBar.status.txSigned')}</Text>
          <Dots />
        </View>
      )}
    </>
  );
};
