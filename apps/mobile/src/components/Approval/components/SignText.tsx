import { Account } from '@/core/services/preference';
import { useApproval } from '@/hooks/useApproval';
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { WaitingSignMessageComponent } from './map';
import { FooterBar } from './FooterBar/FooterBar';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { isTestnetChainId } from '@/utils/chain';
import { CHAINS } from '@/constant/chains';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { ParseTextResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { useTranslation } from 'react-i18next';
import { dappService, preferenceService } from '@/core/services';
import { useApprovalSecurityEngine } from '../hooks/useApprovalSecurityEngine';
import {
  formatSecurityEngineCtx,
  parseAction,
  TextActionData,
} from './TextActions/utils';
import { hex2Text } from '@/constant/tx';
import { openapi, testOpenapi } from '@/core/request';
import { apiSecurityEngine } from '@/core/apis';
import useAsync from 'react-use/lib/useAsync';
import { Skeleton } from '@rneui/themed';
import RuleDrawer from './SecurityEngine/RuleDrawer';
import Actions from './TextActions';
import { useThemeColors } from '@/hooks/theme';
import { getStyles } from './SignTx/style';
import { getKRCategoryByType } from '@/utils/transaction';
import { matomoRequestEvent } from '@/utils/analytics';
import { stats } from '@/utils/stats';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';

interface SignTextProps {
  data: string[];
  session: {
    origin: string;
    icon: string;
    name: string;
  };
  isGnosis?: boolean;
  account?: Account;
  method?: string;
}

export const SignText = ({ params }: { params: SignTextProps }) => {
  const [, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const { data, session, isGnosis = false } = params;
  const [hexData, from] = data;
  const signText = useMemo(() => hex2Text(hexData), [hexData]);
  const [isWatch, setIsWatch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cantProcessReason, setCantProcessReason] =
    useState<ReactNode | null>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [footerShowShadow, setFooterShowShadow] = useState(false);
  const [engineResults, setEngineResults] = useState<Result[]>([]);
  const [parsedActionData, setParsedActionData] =
    useState<TextActionData | null>(null);
  const { executeEngine } = useSecurityEngine();
  const { userData, rules, currentTx, ...apiApprovalSecurityEngine } =
    useApprovalSecurityEngine();
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const securityLevel = useMemo(() => {
    const enableResults = engineResults.filter(result => {
      return result.enable && !currentTx.processedRules.includes(result.id);
    });
    if (enableResults.some(result => result.level === Level.FORBIDDEN))
      return Level.FORBIDDEN;
    if (enableResults.some(result => result.level === Level.DANGER))
      return Level.DANGER;
    if (enableResults.some(result => result.level === Level.WARNING))
      return Level.WARNING;
    return undefined;
  }, [engineResults, currentTx]);

  const hasUnProcessSecurityResult = useMemo(() => {
    const { processedRules } = currentTx;
    const enableResults = engineResults.filter(item => item.enable);
    const hasForbidden = enableResults.find(
      result => result.level === Level.FORBIDDEN,
    );
    const hasSafe = !!enableResults.find(result => result.level === Level.SAFE);
    const needProcess = enableResults.filter(
      result =>
        (result.level === Level.DANGER || result.level === Level.WARNING) &&
        !processedRules.includes(result.id),
    );
    if (hasForbidden) return true;
    if (needProcess.length > 0) {
      return !hasSafe;
    } else {
      return false;
    }
  }, [engineResults, currentTx]);

  const {
    value: textActionData,
    loading,
    error,
  } = useAsync(async () => {
    const currentAccount = isGnosis
      ? params.account
      : await preferenceService.getCurrentAccount();
    let chainId = 1; // ETH as default
    if (params.session.origin !== INTERNAL_REQUEST_ORIGIN) {
      const site = await dappService.getDapp(params.session.origin);
      if (site) {
        chainId = CHAINS[site.chainId].id;
      }
    }
    setChainId(chainId);

    const apiProvider = isTestnetChainId(chainId) ? testOpenapi : openapi;

    return await apiProvider.parseText({
      text: signText,
      address: currentAccount!.address,
      origin: session.origin,
    });
  }, [signText, session]);

  // useSignPermissionCheck({
  //   origin: params.session.origin,
  //   chainId,
  //   onOk: () => {
  //     handleCancel();
  //   },
  //   onDisconnect: () => {
  //     handleCancel();
  //   },
  // });

  // useTestnetCheck({
  //   chainId,
  //   onOk: () => {
  //     handleCancel();
  //   },
  // });

  const report = async (
    action:
      | 'createSignText'
      | 'startSignText'
      | 'cancelSignText'
      | 'completeSignText',
    extra?: Record<string, any>,
  ) => {
    const currentAccount = isGnosis
      ? params.account
      : preferenceService.getCurrentAccount();
    if (!currentAccount) {
      return;
    }
    matomoRequestEvent({
      category: 'SignText',
      action: action,
      label: [
        getKRCategoryByType(currentAccount.type),
        currentAccount.brandName,
      ].join('|'),
      transport: 'beacon',
    });
    stats.report(action, {
      type: currentAccount.brandName,
      category: getKRCategoryByType(currentAccount.type),
      method: 'personalSign',
      ...extra,
    });
  };

  const handleCancel = () => {
    report('cancelSignText');
    rejectApproval('User rejected the request.');
  };

  const { activeApprovalPopup } = useCommonPopupView();
  const invokeEnterPassphrase = useEnterPassphraseModal('address');

  const handleAllow = async () => {
    if (activeApprovalPopup()) {
      return;
    }
    const currentAccount = isGnosis
      ? params.account
      : await preferenceService.getCurrentAccount();

    if (currentAccount?.type === KEYRING_TYPE.HdKeyring) {
      await invokeEnterPassphrase(currentAccount.address);
    }

    if (
      currentAccount?.type &&
      WaitingSignMessageComponent[currentAccount?.type]
    ) {
      resolveApproval({
        uiRequestComponent: WaitingSignMessageComponent[currentAccount?.type],
        type: currentAccount.type,
        address: currentAccount.address,
        extra: {
          brandName: currentAccount.brandName,
          signTextMethod: 'personalSign',
        },
      });

      return;
    }
    report('startSignText');
    resolveApproval({});
  };

  const executeSecurityEngine = async () => {
    const ctx = formatSecurityEngineCtx({
      actionData: parsedActionData!,
      origin: session.origin,
    });
    const result = await executeEngine(ctx);
    setEngineResults(result);
  };

  const handleIgnoreAllRules = () => {
    apiApprovalSecurityEngine.processAllRules(
      engineResults.map(result => result.id),
    );
  };

  const handleIgnoreRule = (id: string) => {
    apiApprovalSecurityEngine.processRule(id);
    apiApprovalSecurityEngine.closeRuleDrawer();
  };

  const handleUndoIgnore = (id: string) => {
    apiApprovalSecurityEngine.unProcessRule(id);
    apiApprovalSecurityEngine.closeRuleDrawer();
  };

  const handleRuleEnableStatusChange = async (id: string, value: boolean) => {
    if (currentTx.processedRules.includes(id)) {
      apiApprovalSecurityEngine.unProcessRule(id);
    }
    await apiSecurityEngine.ruleEnableStatusChange(id, value);
    apiApprovalSecurityEngine.init();
  };

  const handleRuleDrawerClose = (update: boolean) => {
    if (update) {
      executeSecurityEngine();
    }
    apiApprovalSecurityEngine.closeRuleDrawer();
  };

  const checkWachMode = async () => {
    const currentAccount = isGnosis
      ? params.account
      : await preferenceService.getCurrentAccount();
    const accountType =
      isGnosis && params.account ? params.account.type : currentAccount?.type;
    if (accountType === KEYRING_TYPE.WatchAddressKeyring) {
      setIsWatch(true);
      setCantProcessReason(t('page.signTx.canOnlyUseImportedAddress'));
    }
  };

  const init = async (
    textActionData: ParseTextResponse,
    signText: string,
    sender: string,
  ) => {
    const parsed = parseAction(textActionData, signText, sender);
    setParsedActionData(parsed);
    const ctx = formatSecurityEngineCtx({
      actionData: parsed,
      origin: params.session.origin,
    });
    const result = await executeEngine(ctx);
    setEngineResults(result);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!loading) {
      if (textActionData) {
        init(textActionData, signText, from);
      } else {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, signText, textActionData, params, from]);

  // useEffect(() => {
  //   if (scrollRef.current && scrollInfo && scrollRefSize) {
  //     const avaliableHeight =
  //       scrollRef.current.scrollHeight - scrollRefSize.height;
  //     if (avaliableHeight <= 0) {
  //       setFooterShowShadow(false);
  //     } else {
  //       setFooterShowShadow(avaliableHeight - 20 > scrollInfo.y);
  //     }
  //   }
  // }, [scrollInfo, scrollRefSize]);

  useEffect(() => {
    executeSecurityEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  useEffect(() => {
    checkWachMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    report('createSignText');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.approvalTx}>
        {isLoading && (
          <Skeleton
            style={{
              width: 358,
              height: 400,
            }}
          />
        )}
        {!isLoading && (
          <Actions
            data={parsedActionData}
            engineResults={engineResults}
            raw={hexData}
            message={signText}
            origin={params.session.origin}
            originLogo={params.session.icon}
          />
        )}
      </ScrollView>

      <FooterBar
        hasShadow={footerShowShadow}
        securityLevel={securityLevel}
        hasUnProcessSecurityResult={hasUnProcessSecurityResult}
        origin={params.session.origin}
        originLogo={params.session.icon}
        gnosisAccount={isGnosis ? params.account : undefined}
        enableTooltip={isWatch}
        tooltipContent={cantProcessReason}
        onCancel={handleCancel}
        onSubmit={() => handleAllow()}
        disabledProcess={isWatch || hasUnProcessSecurityResult}
        engineResults={engineResults}
        onIgnoreAllRules={handleIgnoreAllRules}
      />
      <RuleDrawer
        selectRule={currentTx.ruleDrawer.selectRule}
        visible={currentTx.ruleDrawer.visible}
        onIgnore={handleIgnoreRule}
        onUndo={handleUndoIgnore}
        onRuleEnableStatusChange={handleRuleEnableStatusChange}
        onClose={handleRuleDrawerClose}
      />
    </View>
  );
};
