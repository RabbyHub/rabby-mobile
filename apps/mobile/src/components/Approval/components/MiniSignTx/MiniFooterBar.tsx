import { Chain } from '@/constant/chains';
import { RootNames } from '@/constant/layout';
import { SecurityEngineLevel } from '@/constant/security';
import { AppColorsVariants } from '@/constant/theme';
import { dappService } from '@/core/services';
import { DappInfo } from '@/core/services/dappService';
import { Account } from '@/core/services/preference';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { MiniApprovalTaskType } from '@/hooks/useMiniApprovalTask';
import { navigateDeprecated } from '@/utils/navigation';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { Props as ActionGroupProps } from '../FooterBar/ActionGroup';
import { GasLessConfig } from '../FooterBar/GasLessComponents';
import { GasAccountTips } from '../FooterBar/GasLessComponents/GasAccountTips';
import { GasLessActivityToSign } from '../FooterBar/GasLessComponents/GasLessActivityToSign';
import { GasLessNotEnough } from '../FooterBar/GasLessComponents/GasLessNotEnough';
import { MiniActionGroup } from './MiniActionGroup';
import { MiniActionStatus } from './MiniActionStatus';
import {
  EVENT_PAY_GAS_BY_GAS_ACCOUNT_AND_NOT_CAN_PAY,
  eventBus,
} from '@/utils/events';
import { GAS_ACCOUNT_INSUFFICIENT_TIP } from '@/screens/GasAccount/hooks/checkTsx';
import { MiniTypedDataApprovalTaskType } from '@/hooks/useMiniSignTypedDataApprovalTask';
import RcCheckSecurity from '@/assets2024/icons/common/check-security.svg';
import RcCheckSecurityDark from '@/assets2024/icons/common/check-security-dark.svg';

import { Text } from 'react-native';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

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
  task: MiniApprovalTaskType | MiniTypedDataApprovalTaskType;
  gasMethod?: 'native' | 'gasAccount';
  gasAccountCost?: GasAccountCheckResult;
  onChangeGasAccount?: () => void;
  isGasAccountLogin?: boolean;
  isWalletConnect?: boolean;
  gasAccountCanPay?: boolean;
  noCustomRPC?: boolean;
  canGotoUseGasAccount?: boolean;
  rejectApproval?(): void;
  onDeposit?(): void;
  gasAccountAddress?: string;
  canDepositUseGasAccount?: boolean;
  isFirstGasCostLoading?: boolean;
  isFirstGasLessLoading?: boolean;
  directSubmit?: boolean;
  account: Account;
  miniType?: 'tx' | 'typedData';
  showCheckSecurityBtn?: boolean;
  showCheckSecurityBtnDisabled?: boolean;
  showCheckSecurity?: boolean;
  onToggleCheckSecurity?: () => void;
  disableSignBtn?: boolean;
}

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    // borderTopLeftRadius: 16,
    // borderTopRightRadius: 16,
    // backgroundColor: colors['neutral-bg-1'],
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
    backgroundColor: colors2024['neutral-bg-1'],
  },
  actions: {
    // backgroundColor: 'red',
  },
}));

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
  canDepositUseGasAccount,
  task,
  rejectApproval,
  onDeposit,
  gasAccountAddress,
  isFirstGasCostLoading,
  isFirstGasLessLoading,
  isGasNotEnough,
  directSubmit,
  account,
  miniType: miniSignType = 'tx',
  showCheckSecurityBtnDisabled,
  showCheckSecurityBtn,
  showCheckSecurity,
  onToggleCheckSecurity: onChangeCheckSecurity,
  disableSignBtn,
  ...props
}) => {
  const { t } = useTranslation();
  const { colors2024, isLight } = useTheme2024();

  const [connectedSite, setConnectedSite] = React.useState<DappInfo | null>(
    null,
  );
  const { styles, colors } = useTheme2024({ getStyle: getStyles });

  const { rules, ...apiApprovalSecurityEngine } = useApprovalSecurityEngine();

  const payGasByGasAccount = gasMethod === 'gasAccount';

  const init = async () => {
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

  const isSetGasMethodRef = useRef(false);
  const [isInited, setIsInited] = useState(false);
  useEffect(() => {
    if (isSetGasMethodRef.current) {
      return;
    }
    if (!isFirstGasCostLoading && !isFirstGasLessLoading) {
      isSetGasMethodRef.current = true;

      if (showGasLess && !canUseGasLess && canGotoUseGasAccount) {
        onChangeGasAccount?.();
      }

      const isSimpleOrHdKeyring = [
        KEYRING_TYPE.SimpleKeyring,
        KEYRING_TYPE.HdKeyring,
      ].includes(account?.type);

      const otherGasAccountError =
        !!gasAccountCost?.err_msg &&
        gasAccountCost?.err_msg?.toLowerCase() !==
          GAS_ACCOUNT_INSUFFICIENT_TIP?.toLowerCase();

      if (
        showGasLess &&
        directSubmit &&
        (canGotoUseGasAccount || (isSimpleOrHdKeyring && otherGasAccountError))
      ) {
        onChangeGasAccount?.();
      }

      setIsInited(true);
    }
  }, [
    account?.type,
    gasAccountCost,
    directSubmit,
    canGotoUseGasAccount,
    canUseGasLess,
    isFirstGasCostLoading,
    isFirstGasLessLoading,
    onChangeGasAccount,
    showGasLess,
  ]);

  const isMiniSignTx = miniSignType === 'tx';

  useEffect(() => {
    if (!gasAccountCanPay) {
      eventBus.emit(
        EVENT_PAY_GAS_BY_GAS_ACCOUNT_AND_NOT_CAN_PAY,
        payGasByGasAccount,
      );
    }
  }, [gasAccountCanPay, payGasByGasAccount]);

  if (!account) {
    return null;
  }

  const overWriteDisabledProcess = disableSignBtn
    ? true
    : payGasByGasAccount
    ? !gasAccountCanPay
    : useGasLess
    ? false
    : props.disabledProcess;

  return (
    <View style={styles.container}>
      <View
        style={styles.wrapper}
        className={clsx({
          // 'has-shadow': !isDarkTheme && hasShadow,
        })}>
        {Header}
        <View>
          {!isInited ? null : (
            <>
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
                ) : isWatchAddr ||
                  account.type === KEYRING_TYPE.GnosisKeyring ? null : (
                  <GasLessNotEnough
                    canGotoUseGasAccount={canGotoUseGasAccount}
                    canDepositUseGasAccount={canDepositUseGasAccount}
                    onChangeGasAccount={onChangeGasAccount}
                    gasAccountAddress={gasAccountAddress!}
                    gasAccountCost={gasAccountCost}
                    onDeposit={() => {
                      onDeposit?.();
                      onChangeGasAccount?.();
                    }}
                    onGotoGasAccount={() => {
                      rejectApproval?.();
                      navigateDeprecated(RootNames.StackTransaction, {
                        screen: RootNames.GasAccount,
                        params: {},
                      });
                    }}
                  />
                )
              ) : null}

              {payGasByGasAccount && !gasAccountCanPay ? (
                isWatchAddr ||
                account.type === KEYRING_TYPE.GnosisKeyring ? null : (
                  <GasAccountTips
                    gasAccountAddress={gasAccountAddress!}
                    gasAccountCost={gasAccountCost}
                    isGasAccountLogin={isGasAccountLogin}
                    isWalletConnect={isWalletConnect}
                    noCustomRPC={noCustomRPC}
                    onDeposit={onDeposit}
                    onGotoGasAccount={() => {
                      rejectApproval?.();
                      navigateDeprecated(RootNames.StackTransaction, {
                        screen: RootNames.GasAccount,
                        params: {},
                      });
                    }}
                  />
                )
              ) : null}
            </>
          )}

          <View
            style={[
              styles.actions,
              {
                flexDirection: 'row',
                gap: 8,
              },
            ]}>
            <View style={{ flex: 1 }}>
              {task.status === 'idle' ? (
                <MiniActionGroup
                  miniSignType={miniSignType}
                  directSubmit
                  isMiniSignTx={isMiniSignTx}
                  account={account}
                  gasLess={useGasLess && !payGasByGasAccount}
                  {...props}
                  disabledProcess={overWriteDisabledProcess}
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
                />
              ) : (
                <MiniActionStatus account={account} task={task} />
              )}
            </View>

            {showCheckSecurityBtn ? (
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: showCheckSecurityBtnDisabled ? 0.5 : 1,
                }}
                disabled={showCheckSecurityBtnDisabled}
                onPress={() => {
                  onChangeCheckSecurity?.();
                }}>
                {isLight ? (
                  <RcCheckSecurity width={28} height={28} />
                ) : (
                  <RcCheckSecurityDark width={28} height={28} />
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text
                    style={{
                      color: colors2024['neutral-secondary'],
                      fontFamily: 'SF Pro Rounded',
                      fontSize: 14,
                      fontStyle: 'normal',
                      fontWeight: '500',
                      lineHeight: 18,
                    }}>
                    {t('global.check')}
                  </Text>
                  <ArrowRightSVG
                    width={14}
                    height={14}
                    style={[
                      {
                        transform: [{ rotate: '-90deg' }],
                      },
                      showCheckSecurity && {
                        transform: [{ rotate: '90deg' }],
                      },
                    ]}
                    color={colors2024['neutral-secondary']}
                  />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};
