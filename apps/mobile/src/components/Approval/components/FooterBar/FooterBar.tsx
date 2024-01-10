import { Tip } from '@/components/Tip';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { CHAINS } from '@/constant/chains';
import { SecurityEngineLevel } from '@/constant/security';
import { AppColorsVariants } from '@/constant/theme';
import { dappService, preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { useThemeColors } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { DappInfo } from '@rabby-wallet/service-dapp';
import clsx from 'clsx';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { AccountInfo } from './AccountInfo';
import { ActionGroup, Props as ActionGroupProps } from './ActionGroup';

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
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 40,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      backgroundColor: colors['neutral-bg-1'],
      position: 'relative',
    },
    dappIcon: {
      width: 24,
      height: 24,
    },
    chainLogo: {
      width: 14,
      height: 14,
      borderRadius: 100,
      position: 'absolute',
      top: -4,
      right: -4,
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

export const FooterBar: React.FC<Props> = ({
  origin,
  originLogo,
  gnosisAccount,
  securityLevel,
  engineResults = [],
  hasUnProcessSecurityResult,
  hasShadow = false,
  onIgnoreAllRules,
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

  const currentChain = useMemo(() => {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      return props.chain || CHAINS.ETH;
    } else {
      if (!connectedSite) {
        return CHAINS.ETH;
      }
      return CHAINS[connectedSite.chainId];
    }
  }, [props.chain, origin, connectedSite]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

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

  useEffect(() => {
    if (origin) {
      const site = dappService.getDapp(origin);
      site && setConnectedSite(site);
    }
  }, [origin]);

  React.useEffect(() => {
    init();
  }, []);

  if (!account) {
    return null;
  }

  const Icon = securityLevel
    ? SecurityLevelTipColor[securityLevel].icon
    : undefined;
  return (
    <View style={styles.container}>
      {/* {!isDarkTheme && hasShadow && <Shadow />} */}
      <View
        style={styles.wrapper}
        className={clsx({
          // 'has-shadow': !isDarkTheme && hasShadow,
        })}>
        {origin && (
          <View style={styles.requestOrigin}>
            {originLogo && (
              <View className="relative mr-8">
                <DappIcon
                  source={{ uri: originLogo }}
                  origin={origin}
                  style={styles.dappIcon}
                />
                <Tip content={currentChain.name}>
                  <Image
                    source={{ uri: currentChain.logo }}
                    style={styles.chainLogo}
                  />
                </Tip>
              </View>
            )}
            <Text style={styles.origin}>{displayOrigin}</Text>
            <Text style={styles.right}>
              {t('page.signFooterBar.requestFrom')}
            </Text>
            {engineResultMap['1088'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1088'].enable}
                level={
                  processedRules.includes('1088')
                    ? 'proceed'
                    : engineResultMap['1088'].level
                }
                onClick={() => handleClickRule('1088')}
                right={0}
                style={styles.securityLevelTag}
              />
            )}
            {engineResultMap['1089'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1089'].enable}
                level={
                  processedRules.includes('1089')
                    ? 'proceed'
                    : engineResultMap['1089'].level
                }
                onClick={() => handleClickRule('1089')}
                style={styles.securityLevelTag}
              />
            )}
          </View>
        )}
        <AccountInfo
          chain={props.chain}
          account={account}
          isTestnet={props.isTestnet}
        />
        <ActionGroup account={account} {...props} />
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
      </View>
    </View>
  );
};
