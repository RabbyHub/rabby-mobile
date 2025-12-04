import { SIGN_PERMISSION_TYPES } from '@/constant/permission';
import { SecurityEngineLevel } from '@/constant/security';
import { apiSecurityEngine } from '@/core/apis';
import { openapi } from '@/core/request';
import {
  dappService,
  notificationService,
  preferenceService,
} from '@/core/services';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
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
import PQueue from 'p-queue';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import RuleDrawer from '../SecurityEngine/RuleDrawer';
import RuleResult from './RuleResult';
import { SignTestnetPermission } from './SignTestnetPermission';
import UserListDrawer from './UserListDrawer';
import ArrowDownSVG from '@/assets/icons/approval/arrow-down-blue.svg';
import { StyleSheet } from 'react-native';
import { AppColors2024Variants, AppColorsVariants } from '@/constant/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { Spin } from '@/components/Spin';
import useCommonStyle from '../../hooks/useCommonStyle';
import { findChain } from '@/utils/chain';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { AccountSwitcherAopProps } from '@/components/AccountSwitcher/hooks';
import { ChainSelector } from '@/components2024/ChainSelector';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
import { AccountSelector } from '@/components2024/AccountSelector';
import { Account } from '@/core/services/preference';
import { ConnectSkeleton } from './ConnectSkeleton';
import { useAccounts, useMyAccounts } from '@/hooks/account';
import { matomoRequestEvent } from '@/utils/analytics';
import { getDappAccount } from '@/hooks/useDapps';

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

const createSecurityLevelTipColor = (colors: AppColors2024Variants) => ({
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
    bg: colors['orange-light-1'],
    text: colors['orange-default'],
    // icon: SecurityEngineLevel[Level.WARNING].icon,
    icon: RcIconWarningCircleCC,
  },
});

type ConnectProps = AccountSwitcherAopProps<{
  params: any;
  onChainChange?(chain: CHAINS_ENUM): void;
  defaultChain?: CHAINS_ENUM;
}>;

export const Connect = ({
  params: { icon, origin },
}: /**
 * @description in fact, it's always '@ActiveDappWebViewModal' now, just leave here to
 * notice that it's a prop that can be passed in the future
 */
// forScene = '@ActiveDappWebViewModal'
ConnectProps) => {
  const { accounts } = useAccounts();
  const [selectedAccount, setSelectedAccount] = useState<
    Account | undefined | null
  >(accounts?.[0] || preferenceService.getFallbackAccount());
  const { colors, styles, colors2024 } = useTheme2024({ getStyle });
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
  const SecurityLevelTipColor = useMemo(
    () => createSecurityLevelTipColor(colors2024),
    [colors2024],
  );

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
    const _selectedAccount = getDappAccount({ dappInfo: site, accounts });
    setSelectedAccount(_selectedAccount);
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
          _selectedAccount!.address,
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

      setDappIcon(site?.icon || site?.info?.logo_url || icon);
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

  const handleAllow = useCallback(async () => {
    resolveApproval({
      defaultChain,
      defaultAccount: selectedAccount,
    });
    matomoRequestEvent({
      category: 'Websites Usage',
      action: 'Website_Connected',
      label: origin,
    });
  }, [defaultChain, origin, resolveApproval, selectedAccount]);

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

  if (isLoading) {
    return <ConnectSkeleton />;
  }

  return (
    <View style={styles.connectWrapper}>
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View style={styles.approvalConnect}>
          <View style={styles.titleWrapper}>
            <Text style={styles.approvalTitle}>{t('page.connect.title')}</Text>
            <ChainSelector
              account={selectedAccount}
              style={styles.chainSelector}
              value={defaultChain}
              onChange={handleChainChange}
            />
          </View>
        </View>

        <View style={styles.connectContent}>
          <View style={styles.connectCard}>
            <DappIcon
              origin={origin}
              source={dappIcon ? { uri: dappIcon } : undefined}
              style={styles.dappIcon}
            />
            <Text style={styles.connectOrigin}>{origin}</Text>
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
        </View>
      </BottomSheetScrollView>

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
                color: LevelTipColor.text,
              },
            ]}
          />
          <Text
            style={[
              styles.securityTipText,
              {
                color: LevelTipColor.text,
              },
            ]}>
            {connectBtnStatus.text}
          </Text>
          <Text
            style={[
              styles.securityTipBtn,
              // {
              //   color: LevelTipColor.text,
              // },
            ]}
            onPress={onIgnoreAllRules}>
            {t('page.connect.ignoreAll')}
          </Text>
        </View>
      )}
      <View style={styles.footerContainer}>
        <View style={styles.connectWalletRow}>
          <Text style={styles.connectWalletText}>
            {t('page.connect.connectWallet')}
          </Text>
          <View style={styles.connectWalletValue}>
            <AccountSelector
              value={selectedAccount}
              onChange={account => {
                setSelectedAccount(account);
              }}
            />
          </View>
        </View>
        <View style={styles.footer}>
          <Button
            type="ghost"
            containerStyle={[styles.button]}
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
          <Button
            containerStyle={[styles.button]}
            type="primary"
            onPress={() => handleAllow()}
            disabled={isLoading || connectBtnStatus.disabled}
            disabledTitleStyle={{
              color: colors['neutral-title-2'],
            }}
            title={t('page.connect.connectBtn')}
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
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  connectWrapper: {
    height: '100%',
    flexDirection: 'column',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    display: 'flex',
  },
  approvalConnect: {
    marginHorizontal: 16,
    paddingLeft: 8,
    marginBottom: 16,
    marginTop: 12,
  },
  approvalTitle: {
    fontWeight: '900',
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  chainSelector: {},
  chainIconComp: {
    width: 16,
    height: 16,
  },
  hover: {
    backgroundColor: colors2024['blue-light-4'],
  },
  connectContent: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginHorizontal: 16,
  },
  connectCard: {
    padding: 23,
    alignItems: 'center',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
  },
  connectOrigin: {
    marginTop: 8,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  ruleList: {
    flex: 1,
  },
  footerContainer: {
    paddingTop: 16,
    paddingBottom: 56,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  connectWalletRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 24,
  },
  connectWalletValue: {
    flexShrink: 1,
  },
  connectWalletText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  securityTip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 6,
    position: 'relative',
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  securityTipText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
  },
  securityTipBtn: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
  securityTipIcon: {
    marginRight: 4,
  },
  button: {
    width: '50%',
    height: 52,
    flex: 1,
  },

  cancelButtonTextView: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cancelButtonText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  titleWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dappIcon: { width: 44, height: 44, borderRadius: 4 },
}));
