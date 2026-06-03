import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ContextActionData,
  Level,
  RuleConfig,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { AccountSelector } from '@/components2024/AccountSelector';
import { ChainSelector } from '@/components2024/ChainSelector';
import { toast } from '@/components2024/Toast';
import RuleResult from '@/components/Approval/components/Connect/RuleResult';
import UserListDrawer from '@/components/Approval/components/Connect/UserListDrawer';
import RuleDrawer from '@/components/Approval/components/SecurityEngine/RuleDrawer';
import { RcIconLogoBlueAutoSize } from '@/assets/icons/common';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
import { CHAINS_ENUM, type Chain } from '@/constant/chains';
import { SecurityEngineLevel } from '@/constant/security';
import { AppColors2024Variants } from '@/constant/theme';
import { apiSecurityEngine } from '@/core/apis';
import { openapi } from '@/core/request';
import { preferenceService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import i18n from '@/utils/i18n';
import type { WalletConnectProposalViewModel } from '@/core/walletconnect/types';
import type { Account } from '@/types/account';
import { createGetStyles2024 } from '@/utils/styles';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';

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
    icon: RcIconWarningCircleCC,
  },
});

function getAccountKey(
  account: Pick<Account, 'address' | 'brandName' | 'type'>,
) {
  return [
    account.type,
    account.brandName || '',
    account.address.toLowerCase(),
  ].join(':');
}

function findAccountByKey(
  accounts: Account[],
  target: Pick<Account, 'address' | 'brandName' | 'type'> | null | undefined,
) {
  if (!target) {
    return null;
  }

  const targetKey = getAccountKey(target);
  return accounts.find(account => getAccountKey(account) === targetKey) || null;
}

function getProposalOrigin(proposal: WalletConnectProposalViewModel) {
  return (
    safeGetOrigin(proposal.proposer.url || '') ||
    proposal.proposer.url ||
    'https://walletconnect.localhost'
  );
}

function formatUnsupportedCapability(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function getWalletConnectBlockText(proposal: WalletConnectProposalViewModel) {
  if (proposal.error) {
    return proposal.error;
  }

  const unsupported: string[] = [];
  if (proposal.unsupportedRequiredChains.length) {
    unsupported.push(
      formatUnsupportedCapability(
        proposal.unsupportedRequiredChains.length,
        'chain',
      ),
    );
  }
  if (proposal.unsupportedRequiredMethods.length) {
    unsupported.push(
      formatUnsupportedCapability(
        proposal.unsupportedRequiredMethods.length,
        'method',
      ),
    );
  }

  return unsupported.length
    ? `Unsupported required WalletConnect request: ${unsupported.join(
        ' and ',
      )} not supported.`
    : '';
}

export function WalletConnectPairingLoading() {
  const { styles } = useTheme2024({ getStyle });
  const ringRotationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(ringRotationValue, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [ringRotationValue]);

  const ringRotation = ringRotationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingIllustration}>
        <Animated.View
          style={[
            styles.loadingRing,
            {
              transform: [{ rotate: ringRotation }],
            },
          ]}>
          <Svg width={100} height={100} viewBox="0 0 100 100" fill="none">
            <Path
              d="M50 2C23.4903 2 2 23.4903 2 50C2 76.5097 23.4903 98 50 98"
              stroke="url(#walletconnect_pairing_ring)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Defs>
              <LinearGradient
                id="walletconnect_pairing_ring"
                x1={17.2727}
                y1={18.9091}
                x2={41.8182}
                y2={98}
                gradientUnits="userSpaceOnUse">
                <Stop stopColor="#7084FF" />
                <Stop offset={1} stopColor="#7084FF" stopOpacity={0.13} />
              </LinearGradient>
            </Defs>
          </Svg>
        </Animated.View>
        <View style={styles.loadingIconCircle}>
          <RcIconLogoBlueAutoSize width={54} height={54} />
        </View>
      </View>
      <Text style={styles.loadingTitle}>Connecting to Rabby</Text>
    </View>
  );
}

export function WalletConnectConnectSheet({
  proposal,
  onApprove,
  onReject,
}: {
  proposal: WalletConnectProposalViewModel;
  onApprove: (account: Account) => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const { accounts } = useMyAccounts();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(() => {
    return preferenceService.getFallbackAccount();
  });
  const [defaultChain, setDefaultChain] = useState(CHAINS_ENUM.ETH);
  const [busy, setBusy] = useState(false);
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

  const origin = useMemo(() => getProposalOrigin(proposal), [proposal]);
  const selectedAccountAddress = selectedAccount?.address || '';
  const dappIcon = proposal.proposer.icons?.[0] || '';
  const walletConnectBlockText = getWalletConnectBlockText(proposal);
  const SecurityLevelTipColor = useMemo(
    () => createSecurityLevelTipColor(colors2024),
    [colors2024],
  );

  useEffect(() => {
    if (findAccountByKey(accounts, selectedAccount)) {
      return;
    }

    const fallbackAccount = preferenceService.getFallbackAccount();
    const matchedFallback = findAccountByKey(accounts, fallbackAccount);
    setSelectedAccount(matchedFallback || accounts[0] || null);
  }, [accounts, selectedAccount]);

  useEffect(() => {
    if (!selectedAccountAddress) {
      setDefaultChain(CHAINS_ENUM.ETH);
      return;
    }

    let cancelled = false;
    setDefaultChain(CHAINS_ENUM.ETH);

    openapi
      .getRecommendChains(selectedAccountAddress, origin)
      .then(recommendChains => {
        if (cancelled) {
          return;
        }

        let targetChain: Chain | undefined;
        for (let i = 0; i < recommendChains.length; i++) {
          targetChain =
            findChain({
              serverId: recommendChains?.[i]?.id,
            }) || undefined;
          if (targetChain) {
            break;
          }
        }

        setDefaultChain(targetChain ? targetChain.enum : CHAINS_ENUM.ETH);
      })
      .catch(error => {
        console.log(error);
      });

    return () => {
      cancelled = true;
    };
  }, [origin, selectedAccountAddress]);

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
      const result = engineResults.find(_result => {
        return _result.id === item?.id;
      });
      if (result || item?.fixed) {
        list.push({
          id: item?.id,
          desc: item?.desc,
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

  const sortRuleById = useMemo(() => {
    return new Map(sortRules.map(rule => [rule.id, rule]));
  }, [sortRules]);

  const resultsWithoutDisable = useMemo(() => {
    return engineResults.filter(item => item.enable);
  }, [engineResults]);

  const connectBtnStatus = useMemo(() => {
    let disabled = false;
    let text = '';
    let forbiddenCount = 0;
    let safeCount = 0;
    let warningCount = 0;
    let dangerCount = 0;
    let needProcessCount = 0;
    let cancelBtnText = t('global.Cancel') || 'Cancel';
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
      text = t('page.connect.foundForbiddenRisk') || '';
      cancelBtnText = t('global.closeButton') || 'Close';
      level = Level.FORBIDDEN;
    } else if (needProcessCount > 0) {
      if (safeCount > 0) {
        disabled = false;
        text = '';
        level = Level.SAFE;
      } else {
        disabled = true;
        text = t('page.signFooterBar.processRiskAlert') || '';
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

  const handleExecuteSecurityEngine = async () => {
    setIsLoading(true);
    const ctx: ContextActionData = {
      origin: {
        url: origin,
        communityCount: collectList.length,
        popularLevel: originPopularLevel || 'low',
      },
    };
    const results = await executeEngine(ctx);
    setIsLoading(false);
    setEngineResults(results);
  };

  const init = async () => {
    setIsLoading(true);
    let level: 'very_low' | 'low' | 'medium' | 'high' = 'low';
    let nextCollectList: { name: string; logo_url: string }[] = [];

    await Promise.all([
      openapi
        .getOriginPopularityLevel(origin)
        .then(result => {
          level = result.level;
        })
        .catch(() => {
          level = 'low';
        }),
      openapi
        .getOriginThirdPartyCollectList(origin)
        .then(({ collect_list }) => {
          nextCollectList = collect_list;
        })
        .catch(() => {
          nextCollectList = [];
        }),
    ]);

    setOriginPopularLevel(level);
    setCollectList(nextCollectList);

    const ctx: ContextActionData = {
      origin: {
        url: origin,
        communityCount: nextCollectList.length,
        popularLevel: level,
      },
    };
    const results = await executeEngine(ctx);
    setEngineResults(results);
    setIsLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

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
    if (onWhitelist === isInWhitelist && onBlacklist === isInBlacklist) {
      return;
    }

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
    setNonce(nonce + 1);
    handleExecuteSecurityEngine();
  };

  const handleEditUserDataList = () => {
    setListDrawerVisible(true);
  };

  const handleRuleDrawerClose = (update: boolean) => {
    if (update) {
      handleExecuteSecurityEngine();
    }
    setRuleDrawerVisible(false);
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
    if (!target) {
      return;
    }
    setSelectRule({
      ruleConfig: target,
      value: rule.result?.value,
      level: rule.result?.level,
      ignored: processedRules.includes(rule.id),
    });
    setRuleDrawerVisible(true);
  };

  const renderSecurityRule = (
    rule: (typeof RuleDesc)[number],
    index: number,
  ) => {
    const sortedRule = sortRuleById.get(rule.id);
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
    }

    if (!sortedRule && !rule.fixed) {
      return null;
    }

    return (
      <RuleResult
        rule={sortedRule || { id: rule.id, desc: rule.desc, result: null }}
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
  };

  const handleApprove = async () => {
    if (
      !selectedAccount ||
      busy ||
      isLoading ||
      walletConnectBlockText ||
      connectBtnStatus.disabled
    ) {
      return;
    }

    setBusy(true);
    try {
      await onApprove(selectedAccount);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    try {
      await onReject();
    } finally {
      setBusy(false);
    }
  };

  const displayTipText = walletConnectBlockText || connectBtnStatus.text;
  const LevelTipColor = walletConnectBlockText
    ? SecurityLevelTipColor[Level.FORBIDDEN]
    : connectBtnStatus.text
    ? SecurityLevelTipColor[connectBtnStatus.level]
    : null;
  const LevelTipColorIcon = LevelTipColor?.icon || RcIconWarningCircleCC;
  const connectDisabled =
    busy ||
    isLoading ||
    !selectedAccount ||
    !!walletConnectBlockText ||
    connectBtnStatus.disabled;

  return (
    <View style={styles.connectWrapper}>
      <BottomSheetScrollView style={styles.scroll}>
        <View style={styles.approvalConnect}>
          <View style={styles.titleWrapper}>
            <Text style={styles.approvalTitle}>{t('page.connect.title')}</Text>
            <ChainSelector
              account={selectedAccount}
              style={styles.chainSelector}
              value={defaultChain}
              onChange={setDefaultChain}
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
            {RuleDesc.map(renderSecurityRule)}
          </View>
        </View>
      </BottomSheetScrollView>

      {displayTipText && LevelTipColor ? (
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
            {displayTipText}
          </Text>
          {!walletConnectBlockText && connectBtnStatus.text ? (
            <Text style={styles.securityTipBtn} onPress={onIgnoreAllRules}>
              {t('page.connect.ignoreAll')}
            </Text>
          ) : null}
        </View>
      ) : null}

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
            containerStyle={styles.button}
            onPress={handleReject}
            disabled={busy}
            title={connectBtnStatus.cancelBtnText}
          />
          <Button
            containerStyle={styles.button}
            type="primary"
            onPress={handleApprove}
            disabled={connectDisabled}
            loading={busy}
            disabledTitleStyle={{
              color: colors['neutral-title-2'],
            }}
            title={t('page.connect.connectBtn') || 'Connect'}
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
        logo={dappIcon}
        onWhitelist={isInWhitelist}
        onBlacklist={isInBlacklist}
        visible={listDrawerVisible}
        onChange={handleUserListChange}
        onClose={() => setListDrawerVisible(false)}
      />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 50,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  loadingIllustration: {
    width: 105,
    height: 109,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingRing: {
    position: 'absolute',
    left: 2.5,
    top: 4.5,
    width: 100,
    height: 100,
  },
  loadingIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-card-2'],
  },
  loadingTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  connectWrapper: {
    height: '100%',
    flexDirection: 'column',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    display: 'flex',
  },
  scroll: {
    flex: 1,
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
  titleWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dappIcon: {
    width: 44,
    height: 44,
    borderRadius: 4,
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
  button: {
    width: '50%',
    height: 52,
    flex: 1,
  },
}));
