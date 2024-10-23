import { Tip } from '@/components/Tip';
import { INTERNAL_REQUEST_ORIGIN, INTERNAL_REQUEST_SESSION } from '@/constant';
import { SecurityEngineLevel } from '@/constant/security';
import { AppColorsVariants } from '@/constant/theme';
import { dappService, preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { DappInfo } from '@/core/services/dappService';
import clsx from 'clsx';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import {
  GasLessConfig,
  GasLessNotEnough,
  GasLessActivityToSign,
  GasAccountTips,
} from '../FooterBar/GasLessComponents';
import {
  ActionGroup,
  Props as ActionGroupProps,
} from '../FooterBar/ActionGroup';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { MiniLedgerAction } from './MiniLedgerAction';
import { MiniCommonAction } from './MiniCommonAction';
import { BatchSignTxTaskType } from './useBatchSignTxTask';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';

interface Props extends Omit<ActionGroupProps, 'account'> {
  chain?: Chain;
  gnosisAccount?: Account;
  securityLevel?: Level;
  origin?: string;
  originLogo?: string;
  hasUnProcessSecurityResult?: boolean;
  hasShadow?: boolean;
  isTestnet?: boolean;
  engineResults?: Result[];
  onIgnoreAllRules(): void;
  useGasLess?: boolean;
  showGasLess?: boolean;
  enableGasLess?: () => void;
  canUseGasLess?: boolean;
  gasLessFailedReason?: string;
  isWatchAddr?: boolean;
  Header?: React.ReactNode;
  gasLessConfig?: GasLessConfig;
  isGasNotEnough?: boolean;
  task: BatchSignTxTaskType;
  gasMethod?: 'native' | 'gasAccount';
  gasAccountCost?: GasAccountCheckResult;
  onChangeGasAccount?: () => void;
  isGasAccountLogin?: boolean;
  isWalletConnect?: boolean;
  gasAccountCanPay?: boolean;
  noCustomRPC?: boolean;
  canGotoUseGasAccount?: boolean;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 40,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      backgroundColor: colors['neutral-bg-1'],
      position: 'relative',
      // shadow
      // shadowColor: colors['neutral-line'],
      // shadowOffset: {
      //   width: 0,
      //   height: 6,
      // },
      // shadowOpacity: 0.5,
      // shadowRadius: 16,

      // elevation: 12,
    },
    dappIconWrapper: {
      position: 'relative',
      marginRight: 8,
    },
    dappIcon: {
      width: 24,
      height: 24,
      borderRadius: 4,
    },
    chainLogo: {
      width: 14,
      height: 14,
      borderRadius: 100,
      position: 'absolute',
      bottom: -5,
      right: -5,
    },
    requestOrigin: {
      height: 30,
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 15,
      color: colors['neutral-foot'],
      paddingBottom: 12,
      position: 'relative',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
    },
    requestOriginBorder: {
      position: 'absolute',
      bottom: 0,
      left: -20,
      right: -20,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
    },
    origin: {
      color: colors['neutral-title-1'],
      flex: 1,
      overflow: 'hidden',
      // textOverflow: 'ellipsis',
      // whiteSpace: 'nowrap',
      fontSize: 15,
      lineHeight: 18,
    },
    right: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
    securityLevelTip: {
      marginTop: 10,
      borderRadius: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
      display: 'flex',
      position: 'relative',
      flexDirection: 'row',
    },
    securityLevelTipText: {
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 15,
    },
    iconLevel: {
      width: 14,
      height: 14,
      marginRight: 6,
    },
    securityLevelTag: {
      marginTop: -15,
    },
    container: {
      position: 'relative',
    },
    actions: {
      // backgroundColor: 'red',
    },
  });

const getSecurityLevelTipColor = (colors: AppColorsVariants) => ({
  [Level.FORBIDDEN]: {
    bg: colors['red-light-2'],
    text: colors['red-dark'],
    icon: SecurityEngineLevel[Level.FORBIDDEN].icon,
  },
  [Level.DANGER]: {
    bg: colors['red-light'],
    text: colors['red-default'],
    icon: SecurityEngineLevel[Level.DANGER].icon,
  },
  [Level.WARNING]: {
    bg: colors['orange-light'],
    text: colors['orange-default'],
    icon: SecurityEngineLevel[Level.WARNING].icon,
  },
});

export const MiniFooterBar: React.FC<Props> = ({
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
  onIgnoreAllRules,
  enableGasLess,
  Header,
  gasLessFailedReason,
  isWatchAddr,
  gasLessConfig,
  gasAccountCost,
  gasMethod,
  onChangeGasAccount,
  isGasAccountLogin,
  isWalletConnect,
  gasAccountCanPay,
  noCustomRPC,
  canGotoUseGasAccount,
  task,
  ...props
}) => {
  const [account, setAccount] = React.useState<Account>();
  const [connectedSite, setConnectedSite] = React.useState<DappInfo | null>(
    null,
  );
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const SecurityLevelTipColor = getSecurityLevelTipColor(colors);

  const displayOrigin = useMemo(() => {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      return 'Rabby Wallet';
    }
    return origin;
  }, [origin]);

  const {
    rules,
    currentTx: { processedRules },
    ...apiApprovalSecurityEngine
  } = useApprovalSecurityEngine();

  // const currentChain = useMemo(() => {
  //   if (origin === INTERNAL_REQUEST_ORIGIN) {
  //     return props.chain || CHAINS.ETH;
  //   } else {
  //     if (!connectedSite) {
  //       return CHAINS.ETH;
  //     }
  //     return CHAINS[connectedSite.chainId];
  //   }
  // }, [props.chain, origin, connectedSite]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const payGasByGasAccount = gasMethod === 'gasAccount';

  const handleClickRule = (id: string) => {
    const rule = rules.find(item => item.id === id);
    if (!rule) {
      return;
    }
    const result = engineResultMap[id];
    apiApprovalSecurityEngine.openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: processedRules.includes(id),
    });
  };

  const init = async () => {
    const currentAccount =
      gnosisAccount || (await preferenceService.getCurrentAccount());
    if (currentAccount) {
      setAccount(currentAccount);
    }
    apiApprovalSecurityEngine.init();
  };
  const binaryTheme = useGetBinaryMode();
  const isDarkTheme = binaryTheme === 'dark';

  useEffect(() => {
    if (origin) {
      const site = dappService.getDapp(origin);
      site && setConnectedSite(site);
    }
  }, [origin]);

  React.useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!account) {
    return null;
  }
  const Icon = securityLevel
    ? SecurityLevelTipColor[securityLevel].icon
    : undefined;

  const isInternalRequest = origin === INTERNAL_REQUEST_SESSION.origin;

  const footer = (
    <>
      {securityLevel && hasUnProcessSecurityResult && (
        <View
          className="security-level-tip"
          style={StyleSheet.flatten([
            styles.securityLevelTip,
            {
              backgroundColor: SecurityLevelTipColor[securityLevel].bg,
            },
          ])}>
          <Icon style={styles.iconLevel} />
          <Text
            className="flex-1"
            style={StyleSheet.flatten([
              styles.securityLevelTipText,
              {
                color: SecurityLevelTipColor[securityLevel].text,
              },
            ])}>
            {t('page.signFooterBar.processRiskAlert')}
          </Text>
          <TouchableOpacity onPress={onIgnoreAllRules}>
            <Text
              className="underline text-13 font-medium"
              style={StyleSheet.flatten([
                styles.securityLevelTipText,
                {
                  color: SecurityLevelTipColor[securityLevel].text,
                },
              ])}>
              {t('page.signFooterBar.ignoreAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showGasLess &&
      !payGasByGasAccount &&
      (!securityLevel || !hasUnProcessSecurityResult) ? (
        canUseGasLess ? (
          <GasLessActivityToSign
            gasLessEnable={useGasLess}
            handleFreeGas={() => {
              enableGasLess?.();
            }}
            gasLessConfig={gasLessConfig}
          />
        ) : isWatchAddr ? null : (
          <GasLessNotEnough
            gasLessFailedReason={gasLessFailedReason}
            canGotoUseGasAccount={canGotoUseGasAccount}
            onChangeGasAccount={onChangeGasAccount}
          />
        )
      ) : null}

      {payGasByGasAccount && !gasAccountCanPay ? (
        <GasAccountTips
          gasAccountCost={gasAccountCost}
          isGasAccountLogin={isGasAccountLogin}
          isWalletConnect={isWalletConnect}
          noCustomRPC={noCustomRPC}
        />
      ) : null}
    </>
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.wrapper}
        className={clsx({
          // 'has-shadow': !isDarkTheme && hasShadow,
        })}>
        {Header}
        <View style={styles.actions}>
          {account.type === KEYRING_CLASS.HARDWARE.LEDGER ? (
            <MiniLedgerAction
              task={task}
              account={account}
              gasLess={useGasLess && !payGasByGasAccount}
              {...props}
              disabledProcess={
                payGasByGasAccount
                  ? !gasAccountCanPay
                  : useGasLess
                  ? false
                  : props.disabledProcess
              }
              enableTooltip={
                payGasByGasAccount
                  ? false
                  : useGasLess
                  ? false
                  : props.enableTooltip
              }
              gasLessThemeColor={
                isDarkTheme
                  ? gasLessConfig?.dark_color
                  : gasLessConfig?.theme_color
              }
              footer={footer}
            />
          ) : (
            <MiniCommonAction
              task={task}
              account={account}
              gasLess={useGasLess && !payGasByGasAccount}
              {...props}
              disabledProcess={
                payGasByGasAccount
                  ? !gasAccountCanPay
                  : useGasLess
                  ? false
                  : props.disabledProcess
              }
              enableTooltip={
                payGasByGasAccount
                  ? false
                  : useGasLess
                  ? false
                  : props.enableTooltip
              }
              gasLessThemeColor={
                isDarkTheme
                  ? gasLessConfig?.dark_color
                  : gasLessConfig?.theme_color
              }
              footer={footer}
            />
          )}
        </View>
      </View>
    </View>
  );
};
