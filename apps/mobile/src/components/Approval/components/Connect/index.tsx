import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { SIGN_PERMISSION_TYPES } from '@/constant/permission';
import { SecurityEngineLevel } from '@/constant/security';
import { apiSecurityEngine } from '@/core/apis';
import { openapi } from '@/core/request';
import {
  dappService,
  notificationService,
  preferenceService,
} from '@/core/services';
import { useCurrentAccount } from '@/hooks/account';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import i18n from '@/utils/i18n';
import { Chain, CHAINS_ENUM } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ContextActionData,
  Level,
  RuleConfig,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import clsx from 'clsx';
import PQueue from 'p-queue/dist/index';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import RuleDrawer from '../SecurityEngine/RuleDrawer';
import RuleResult from './RuleResult';
import { SignTestnetPermission } from './SignTestnetPermission';
import UserListDrawer from './UserListDrawer';
import ArrowDownSVG from '@/assets/icons/approval/arrow-down-blue.svg';
import { StyleSheet } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { ChainSelector } from '@/components/ChainSelector';
import { Spin } from '@/components/Spin';
import useCommonStyle from '../../hooks/useCommonStyle';
import { findChain } from '@/utils/chain';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    connectWrapper: {
      height: '100%',
      flexDirection: 'column',
      backgroundColor: colors['neutral-bg-1'],
    },
    approvalConnect: {
      padding: 26,
    },
    approvalTitle: {
      fontWeight: '500',
      fontSize: 17,
      lineHeight: 20,
      color: colors['neutral-title-1'],
    },
    chainSelector: {},
    chainIconComp: {
      width: 16,
      height: 16,
    },
    hover: {
      backgroundColor: colors['blue-light-1'],
    },
    connectCard: {
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 8,
      padding: 26,
      alignItems: 'center',
      position: 'relative',
    },
    connectOrigin: {
      marginTop: 12,
      marginBottom: 6,
      fontWeight: '500',
      fontSize: 22,
      lineHeight: 26,
      textAlign: 'center',
      color: colors['neutral-title-1'],
    },
    ruleList: {
      flex: 1,
      paddingHorizontal: 20,
    },
    footer: {
      display: 'flex',
      flexDirection: 'column',
      padding: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors['neutral-card-2'],
      backgroundColor: colors['neutral-card-1'],
      marginBottom: 15,
    },
    securityTip: {
      width: '100%',
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 15,
      padding: 6,
      display: 'flex',
      alignItems: 'center',
      borderRadius: 4,
      position: 'relative',
      flexDirection: 'row',
      marginTop: 12,
    },
    securityTipIcon: {
      marginRight: 6,
    },
    button: {
      width: '100%',
      height: 52,
    },
    connectButton: {
      backgroundColor: colors['blue-default'],
    },
    connectButtonText: {
      color: colors['neutral-title-2'],
      fontSize: 16,
    },
    lastButton: {
      marginTop: 20,
    },
    cancelButtonTextView: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    cancelButtonText: {
      fontSize: 16,
      color: colors['blue-default'],
    },
    titleWrapper: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    dappIcon: { width: 40, height: 40, borderRadius: 4 },
  });

const RuleDesc = [
  {
    id: '1004',
    desc: i18n.t('page.connect.listedBy'),
    fixed: true,
  },
  {
    id: '1005',
    desc: i18n.t('page.connect.sitePopularity'),
    fixed: true,
  },
  {
    id: '1006',
    desc: i18n.t('page.connect.myMark'),
    fixed: false,
  },
  {
    id: '1001',
    desc: i18n.t('page.connect.flagByRabby'),
    fixed: false,
  },
  {
    id: '1002',
    desc: i18n.t('page.connect.flagByMM'),
    fixed: false,
  },
  {
    id: '1003',
    desc: i18n.t('page.connect.flagByScamSniffer'),
    fixed: false,
  },
  {
    id: '1070',
    desc: i18n.t('page.connect.verifiedByRabby'),
    fixed: false,
  },
];

const SecurityLevelTipColor = {
  [Level.FORBIDDEN]: {
    bg: '#EFCFCF',
    text: '#AF160E',
    icon: SecurityEngineLevel[Level.FORBIDDEN].icon,
  },
  [Level.DANGER]: {
    bg: '#FCDCDC',
    text: '#EC5151',
    icon: SecurityEngineLevel[Level.DANGER].icon,
  },
  [Level.WARNING]: {
    bg: '#FFEFD2',
    text: '#FFB020',
    icon: SecurityEngineLevel[Level.WARNING].icon,
  },
};

interface ConnectProps {
  params: any;
  onChainChange?(chain: CHAINS_ENUM): void;
  defaultChain?: CHAINS_ENUM;
}

export const Connect = ({ params: { icon, origin } }: ConnectProps) => {
  const { currentAccount: account } = useCurrentAccount();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const [defaultChain, setDefaultChain] = useState(CHAINS_ENUM.ETH);
  const [isLoading, setIsLoading] = useState(true);
  const [listDrawerVisible, setListDrawerVisible] = useState(false);
  const [processedRules, setProcessedRules] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const { rules, userData, executeEngine } = useSecurityEngine(nonce);
  const [engineResults, setEngineResults] = useState<Result[]>([]);
  const [collectList, setCollectList] = useState<
    { name: string; logo_url: string }[]
  >([]);
  const [originPopularLevel, setOriginPopularLevel] = useState<string | null>(
    null,
  );
  const [ruleDrawerVisible, setRuleDrawerVisible] = useState(false);
  const [selectRule, setSelectRule] = useState<{
    ruleConfig: RuleConfig;
    value?: number | string | boolean;
    level?: Level;
    ignored: boolean;
  } | null>(null);
  const [dappIcon, setDappIcon] = useState<string>(icon);
  const [signPermission, setSignPermission] = useState<SIGN_PERMISSION_TYPES>();
  const commonStyle = useCommonStyle();

  const userListResult = useMemo(() => {
    const originBlacklist = engineResults.find(result => result.id === '1006');
    const originWhitelist = engineResults.find(result => result.id === '1007');
    return originBlacklist || originWhitelist;
  }, [engineResults]);

  const sortRules = useMemo(() => {
    const list: {
      id: string;
      desc: string;
      result: Result | null;
    }[] = [];
    for (let i = 0; i < RuleDesc.length; i++) {
      const item = RuleDesc[i];
      const result = engineResults.find(result => {
        return result.id === item.id;
      });
      if (result || item.fixed) {
        list.push({
          id: item.id,
          desc: item.desc,
          result: result || null,
        });
      }
    }
    engineResults.forEach(result => {
      if (!list.find(item => item.id === result.id)) {
        list.push({
          id: result.id,
          desc: '',
          result,
        });
      }
    });
    return list;
  }, [engineResults]);

  const resultsWithoutDisable = useMemo(() => {
    return engineResults.filter(item => item.enable);
  }, [engineResults]);

  let connectBtnStatus = useMemo(() => {
    let disabled = false;
    let text = '';
    let forbiddenCount = 0;
    let safeCount = 0;
    let warningCount = 0;
    let dangerCount = 0;
    let needProcessCount = 0;
    let cancelBtnText = t('global.Cancel');
    let level: Level = Level.SAFE;
    resultsWithoutDisable.forEach(result => {
      if (result.level === Level.SAFE) {
        safeCount++;
      } else if (
        result.level === Level.FORBIDDEN &&
        !processedRules.includes(result.id)
      ) {
        forbiddenCount++;
      } else if (
        result.level !== Level.ERROR &&
        result.enable &&
        !processedRules.includes(result.id)
      ) {
        needProcessCount++;
        if (result.level === Level.WARNING) {
          warningCount++;
        } else if (result.level === Level.DANGER) {
          dangerCount++;
        }
      }
    });

    if (forbiddenCount > 0) {
      disabled = true;
      text = t('page.connect.foundForbiddenRisk');
      cancelBtnText = t('global.closeButton');
      level = Level.FORBIDDEN;
    } else if (needProcessCount > 0) {
      if (safeCount > 0) {
        disabled = false;
        text = '';
        level = Level.SAFE;
      } else {
        disabled = true;
        text = t('page.signFooterBar.processRiskAlert');
        if (dangerCount > 0) {
          level = Level.DANGER;
        } else {
          level = Level.WARNING;
        }
      }
    }

    return {
      disabled,
      text,
      cancelBtnText,
      level,
    };
  }, [t, resultsWithoutDisable, processedRules]);

  const hasForbidden = useMemo(() => {
    return resultsWithoutDisable.some(item => item.level === Level.FORBIDDEN);
  }, [resultsWithoutDisable]);

  const hasSafe = useMemo(() => {
    return resultsWithoutDisable.some(item => item.level === Level.SAFE);
  }, [resultsWithoutDisable]);

  const isInBlacklist = useMemo(() => {
    return userData.originBlacklist.includes(origin.toLowerCase());
  }, [origin, userData]);

  const isInWhitelist = useMemo(() => {
    return userData.originWhitelist.includes(origin.toLowerCase());
  }, [origin, userData]);

  const handleIgnoreRule = (id: string) => {
    setProcessedRules([...processedRules, id]);
    if (selectRule) {
      setSelectRule({
        ...selectRule,
        ignored: true,
      });
    }
    setRuleDrawerVisible(false);
  };

  const handleUndoIgnore = (id: string) => {
    setProcessedRules(processedRules.filter(item => item !== id));
    if (selectRule) {
      setSelectRule({
        ...selectRule,
        ignored: false,
      });
    }
    setRuleDrawerVisible(false);
  };

  const handleRuleEnableStatusChange = async (id: string, value: boolean) => {
    if (processedRules.includes(id)) {
      setProcessedRules(processedRules.filter(i => i !== id));
    }
    await apiSecurityEngine.ruleEnableStatusChange(id, value);
    setNonce(nonce + 1);
  };

  const handleUserListChange = async ({
    onWhitelist,
    onBlacklist,
  }: {
    onWhitelist: boolean;
    onBlacklist: boolean;
  }) => {
    if (onWhitelist === isInWhitelist && onBlacklist === isInBlacklist) return;
    if (onWhitelist) {
      await apiSecurityEngine.addOriginWhitelist(origin);
      toast.success(t('page.connect.markAsTrustToast'));
    } else if (onBlacklist) {
      await apiSecurityEngine.addOriginBlacklist(origin);
      toast.success(t('page.connect.markAsBlockToast'));
    } else {
      await apiSecurityEngine.removeOriginBlacklist(origin);
      await apiSecurityEngine.removeOriginWhitelist(origin);
      toast.success(t('page.connect.markRemovedToast'));
    }
    setListDrawerVisible(false);
    setNonce(nonce + 1); // update security engine
    handleExecuteSecurityEngine();
  };

  const handleEditUserDataList = () => {
    setListDrawerVisible(true);
  };

  const handleExecuteSecurityEngine = async () => {
    setIsLoading(true);
    const ctx: ContextActionData = {
      origin: {
        url: origin,
        communityCount: collectList.length,
        popularLevel: originPopularLevel!,
      },
    };
    const results = await executeEngine(ctx);
    setIsLoading(false);
    setEngineResults(results);
  };

  const init = async () => {
    const site = await dappService.getDapp(origin);
    let level: 'very_low' | 'low' | 'medium' | 'high' = 'low';
    let collectList: { name: string; logo_url: string }[] = [];
    let defaultChain = CHAINS_ENUM.ETH;
    let isShowTestnet = false;
    const queue = new PQueue();
    const waitQueueFinished = (q: PQueue) => {
      return new Promise(resolve => {
        q.on('empty', () => {
          if (q.pending <= 0) resolve(null);
        });
      });
    };
    queue.add(async () => {
      try {
        const result = await openapi.getOriginPopularityLevel(origin);
        level = result.level;
      } catch (e) {
        level = 'low';
      }
    });
    queue.add(async () => {
      try {
        const { collect_list } = await openapi.getOriginThirdPartyCollectList(
          origin,
        );
        collectList = collect_list;
      } catch (e) {
        collectList = [];
      }
    });
    queue.add(async () => {
      try {
        const recommendChains = await openapi.getRecommendChains(
          account!.address,
          origin,
        );
        let targetChain: Chain | undefined;
        for (let i = 0; i < recommendChains.length; i++) {
          targetChain =
            findChain({
              serverId: recommendChains[i].id,
            }) || undefined;
          if (targetChain) break;
        }
        defaultChain = targetChain ? targetChain.enum : CHAINS_ENUM.ETH;
      } catch (e) {
        console.log(e);
      }
    });
    queue.add(async () => {
      try {
        isShowTestnet = !!preferenceService.getIsShowTestnet();
      } catch (e) {
        console.log(e);
      }
    });
    await waitQueueFinished(queue);
    setOriginPopularLevel(level);
    setCollectList(collectList);
    setDefaultChain(defaultChain);

    const ctx: ContextActionData = {
      origin: {
        url: origin,
        communityCount: collectList.length,
        popularLevel: level,
      },
    };
    const results = await executeEngine(ctx);

    setEngineResults(results);
    if (site) {
      setIsLoading(false);
      const chain = findChain({
        enum: site.chainId,
      });
      if (!isShowTestnet && chain?.isTestnet) {
        return;
      }
      if (chain) {
        setDefaultChain(site.chainId);
      }

      if (site.info.logo_url) {
        setDappIcon(site.info.logo_url);
      }
      return;
    }
    setIsLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    rejectApproval('User rejected the request.');
  };

  const handleAllow = async () => {
    resolveApproval({
      defaultChain,
      signPermission,
    });
  };

  const handleRuleDrawerClose = (update: boolean) => {
    if (update) {
      handleExecuteSecurityEngine();
    }
    setRuleDrawerVisible(false);
  };

  const handleChainChange = (val: CHAINS_ENUM) => {
    setDefaultChain(val);
  };

  const onIgnoreAllRules = () => {
    setProcessedRules(engineResults.map(item => item.id));
  };

  const handleSelectRule = (rule: {
    id: string;
    desc: string;
    result: Result | null;
  }) => {
    const target = rules.find(item => item.id === rule.id);
    if (!target) return;
    setSelectRule({
      ruleConfig: target,
      value: rule.result?.value,
      level: rule.result?.level,
      ignored: processedRules.includes(rule.id),
    });
    setRuleDrawerVisible(true);
  };

  const [displayBlockedRequestApproval, setDisplayBlockedRequestApproval] =
    React.useState<boolean>(false);
  const { activePopup, setData } = useCommonPopupView();

  React.useEffect(() => {
    const result = notificationService.checkNeedDisplayBlockedRequestApproval();
    setDisplayBlockedRequestApproval(result);
  }, []);

  const activeCancelPopup = () => {
    setData({
      onCancel: handleCancel,
      displayBlockedRequestApproval,
    });
    activePopup('CANCEL_CONNECT');
  };

  const LevelTipColor = connectBtnStatus.text
    ? SecurityLevelTipColor[connectBtnStatus.level]
    : {};
  const LevelTipColorIcon = LevelTipColor.icon;

  return (
    <Spin spinning={isLoading}>
      <View style={styles.connectWrapper}>
        <View style={styles.approvalConnect}>
          <View style={styles.titleWrapper}>
            <Text style={styles.approvalTitle}>{t('page.connect.title')}</Text>
            <ChainSelector
              style={styles.chainSelector}
              value={defaultChain}
              onChange={handleChainChange}
              connection
            />
          </View>
          <View style={styles.connectCard}>
            <DappIcon
              origin={origin}
              source={dappIcon ? { uri: dappIcon } : undefined}
              style={styles.dappIcon}
            />
            <Text style={styles.connectOrigin}>{origin}</Text>
          </View>
        </View>

        <View style={styles.ruleList}>
          {RuleDesc.map((rule, index) => {
            if (rule.id === '1006') {
              return (
                <RuleResult
                  rule={{
                    id: '1006',
                    desc: t('page.connect.markRuleText'),
                    result: userListResult || null,
                  }}
                  onSelect={handleSelectRule}
                  collectList={collectList}
                  popularLevel={originPopularLevel}
                  userListResult={userListResult}
                  ignored={processedRules.includes(rule.id)}
                  hasSafe={hasSafe}
                  hasForbidden={hasForbidden}
                  onEditUserList={handleEditUserDataList}
                  key={`${rule.id}_${index}`}
                />
              );
            } else {
              if (sortRules.find(item => item.id === rule.id) || rule.fixed) {
                return (
                  <RuleResult
                    rule={sortRules.find(item => item.id === rule.id)!}
                    key={`${rule.id}_${index}`}
                    onSelect={handleSelectRule}
                    collectList={collectList}
                    popularLevel={originPopularLevel}
                    userListResult={userListResult}
                    ignored={processedRules.includes(rule.id)}
                    hasSafe={hasSafe}
                    hasForbidden={hasForbidden}
                    onEditUserList={handleEditUserDataList}
                  />
                );
              } else {
                return null;
              }
            }
          })}
        </View>
        <View>
          <SignTestnetPermission
            value={signPermission}
            onChange={v => setSignPermission(v)}
          />
          <View style={styles.footer}>
            <Button
              buttonStyle={[styles.button, styles.connectButton]}
              titleStyle={styles.connectButtonText}
              type="primary"
              onPress={() => handleAllow()}
              disabled={isLoading || connectBtnStatus.disabled}
              disabledTitleStyle={{
                color: colors['neutral-title-2'],
              }}
              className={clsx({
                'mb-0': !connectBtnStatus.text,
              })}
              title={t('page.connect.connectBtn')}
            />
            {connectBtnStatus.text && (
              <View
                style={[
                  styles.securityTip,
                  {
                    backgroundColor: LevelTipColor.bg,
                  },
                ]}>
                <LevelTipColorIcon
                  style={[
                    styles.securityTipIcon,
                    {
                      color: LevelTipColor.bg,
                    },
                  ]}
                />
                <Text
                  className="flex-1"
                  style={{
                    color: LevelTipColor.text,
                  }}>
                  {connectBtnStatus.text}
                </Text>
                <Text
                  className="underline text-13 font-medium cursor-pointer"
                  style={{
                    color: LevelTipColor.text,
                  }}
                  onPress={onIgnoreAllRules}>
                  {t('page.connect.ignoreAll')}
                </Text>
              </View>
            )}
            <Button
              type="primary"
              ghost
              buttonStyle={[styles.button, styles.lastButton]}
              onPress={
                displayBlockedRequestApproval ? activeCancelPopup : handleCancel
              }
              title={
                <View style={styles.cancelButtonTextView}>
                  <Text style={styles.cancelButtonText}>
                    {connectBtnStatus.cancelBtnText}
                  </Text>
                  {displayBlockedRequestApproval && (
                    <ArrowDownSVG className="w-16" />
                  )}
                </View>
              }
            />
          </View>
        </View>
        <RuleDrawer
          selectRule={selectRule}
          visible={ruleDrawerVisible}
          onIgnore={handleIgnoreRule}
          onUndo={handleUndoIgnore}
          onRuleEnableStatusChange={handleRuleEnableStatusChange}
          onClose={handleRuleDrawerClose}
        />
        <UserListDrawer
          origin={origin}
          logo={icon}
          onWhitelist={isInWhitelist}
          onBlacklist={isInBlacklist}
          visible={listDrawerVisible}
          onChange={handleUserListChange}
          onClose={() => setListDrawerVisible(false)}
        />
      </View>
    </Spin>
  );
};
