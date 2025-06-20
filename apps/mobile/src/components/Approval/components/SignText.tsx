import { Account } from '@/core/services/preference';
import { useApproval } from '@/hooks/useApproval';
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WaitingSignComponent } from './map';
import { FooterBar } from './FooterBar/FooterBar';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { findChain, isTestnetChainId } from '@/utils/chain';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { ParseTextResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { useTranslation } from 'react-i18next';
import {
  dappService,
  keyringService,
  preferenceService,
} from '@/core/services';
import { useApprovalSecurityEngine } from '../hooks/useApprovalSecurityEngine';
import {
  parseAction,
  formatSecurityEngineContext,
  ParsedTextActionData,
} from '@rabby-wallet/rabby-action';
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
import { CHAINS } from '@debank/common';
import { getTimeSpan } from '@/utils/time';
import { useGetCurrentSafeInfo } from '@/hooks/gnosis/useGetCurrentSafeInfo';
import { useGetMessageHash } from '@/hooks/gnosis/useGetCurrentMessageHash';
import { useCheckCurrentSafeMessage } from '@/hooks/gnosis/useCheckCurrentSafeMessage';
import { apisSafe } from '@/core/apis/safe';
import { generateTypedData } from '@safe-global/protocol-kit/dist/src/utils/eip-712';
import { apisKeyring } from '@/core/apis/keyring';
import { GnosisDrawer } from './TxComponents/GnosisDrawer';
import { GnosisAdminFooterBarPopup } from './TxComponents/GnosisAdminFooterBarPopup';
import { GnosisSameMessageModal } from './TxComponents/GnosisSameMessageModal';
import { useSetState } from 'ahooks';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

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
  $ctx: any;
}

export const SignText = ({
  params,
  account,
}: {
  params: SignTextProps;
  account: Account;
}) => {
  const currentAccount = params.isGnosis ? params.account! : account;
  const [, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const { data, session, isGnosis = false } = params;
  const site = dappService.getDapp(session.origin);
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
    useState<ParsedTextActionData | null>(null);
  const { executeEngine } = useSecurityEngine();
  const { userData, rules, currentTx, ...apiApprovalSecurityEngine } =
    useApprovalSecurityEngine();
  const isGnosisAccount = currentAccount?.type === KEYRING_TYPE.GnosisKeyring;
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [gnosisFooterBarVisible, setGnosisFooterBarVisible] = useState(false);
  const [currentGnosisAdmin, setCurrentGnosisAdmin] = useState<Account | null>(
    null,
  );
  const [sameMessageState, setSameMessageState] = useSetState({
    visible: false,
    preparedSignature: '',
  });

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
    let chainId = 1; // ETH as default
    if (params.session.origin !== INTERNAL_REQUEST_ORIGIN) {
      const site = await dappService.getDapp(params.session.origin);
      if (site) {
        chainId =
          findChain({
            enum: site.chainId,
          })?.id || 1;
      }
    } else if (params?.$ctx?.chainId) {
      chainId = params?.$ctx?.chainId;
    }
    setChainId(chainId);

    const apiProvider = isTestnetChainId(chainId) ? testOpenapi : openapi;

    return await apiProvider.parseText({
      text: signText,
      address: currentAccount!.address,
      origin: session.origin,
    });
  }, [signText, session]);

  const isViewGnosisSafe = params?.$ctx?.isViewGnosisSafe;

  const report = async (
    action:
      | 'createSignText'
      | 'startSignText'
      | 'cancelSignText'
      | 'completeSignText',
    extra?: Record<string, any>,
  ) => {
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

    if (isGnosisAccount) {
      setDrawerVisible(true);
      return;
    }

    if (currentAccount?.type === KEYRING_TYPE.HdKeyring) {
      await invokeEnterPassphrase(currentAccount.address);
    }

    if (currentAccount?.type && WaitingSignComponent[currentAccount?.type]) {
      resolveApproval({
        uiRequestComponent: WaitingSignComponent[currentAccount?.type],
        $account: currentAccount,
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
    const ctx = await formatSecurityEngineContext({
      type: 'text',
      actionData: parsedActionData || ({} as any),
      origin: session.origin,
      isTestnet: false,
      chainId: findChain({ id: chainId })?.serverId || CHAINS.ETH.serverId,
      requireData: null,
      provider: {
        getTimeSpan,
        hasAddress: keyringService.hasAddress.bind(keyringService),
      },
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
    const accountType =
      isGnosis && params.account ? params.account.type : currentAccount?.type;
    if (accountType === KEYRING_TYPE.WatchAddressKeyring) {
      setIsWatch(true);
      setCantProcessReason(t('page.signTx.canOnlyUseImportedAddress'));
    }
  };

  const { data: safeInfo } = useGetCurrentSafeInfo({
    chainId: chainId,
    account: currentAccount!,
    rejectApproval,
  });
  const { data: safeMessageHash } = useGetMessageHash({
    chainId,
    message: signText,
    account: currentAccount!,
  });
  const { data: currentSafeMessage } = useCheckCurrentSafeMessage(
    {
      chainId,
      safeMessageHash,
      threshold: safeInfo?.threshold,
      account: currentAccount!,
    },
    {
      onSuccess(res) {
        if (res?.isFinished) {
          setSameMessageState({
            visible: true,
            preparedSignature: res.safeMessage.preparedSignature,
          });
        }
      },
    },
  );

  const handleDrawerCancel = () => {
    setDrawerVisible(false);
  };

  const handleGnosisConfirm = async (account: Account) => {
    if (!safeInfo) return;
    setGnosisFooterBarVisible(true);
    setCurrentGnosisAdmin(account);
  };

  const handleGnosisSign = async () => {
    const account = currentGnosisAdmin;
    if (!safeInfo || !account) {
      return;
    }
    if (activeApprovalPopup()) {
      return;
    }

    if (!isViewGnosisSafe) {
      await apisSafe.buildGnosisMessage({
        safeAddress: safeInfo.address,
        account,
        version: safeInfo.version,
        networkId: chainId + '',
        message: signText,
      });
      await Promise.all(
        (currentSafeMessage?.safeMessage?.confirmations || []).map(item => {
          return apisSafe.addPureGnosisMessageSignature({
            signerAddress: item.owner,
            signature: item.signature,
          });
        }),
      );
    }

    const typedData = generateTypedData({
      safeAddress: safeInfo.address,
      safeVersion: safeInfo.version,
      chainId: BigInt(chainId!),
      data: signText,
    });
    if (WaitingSignComponent[account.type]) {
      apisKeyring.signTypedDataWithUI(
        account.type,
        account.address,
        typedData as any,
        {
          brandName: account.brandName,
          version: 'V4',
        },
      );

      resolveApproval({
        uiRequestComponent: WaitingSignComponent[account.type],
        $account: currentAccount,
        type: account.type,
        address: account.address,
        data: [account.address, JSON.stringify(typedData)],
        isGnosis: true,
        account: account,
        safeMessage: {
          message: signText,
          safeAddress: safeInfo.address,
          chainId: chainId,
          safeMessageHash: safeMessageHash,
        },
        extra: {
          popupProps: {
            maskStyle: {
              backgroundColor: 'transparent',
            },
          },
        },
      });
    }
    return;
  };

  const init = async (
    textActionData: ParseTextResponse,
    signText: string,
    sender: string,
  ) => {
    const parsed = parseAction({
      type: 'text',
      data: textActionData.action,
      text: signText,
      sender,
    });
    setParsedActionData(parsed);
    const ctx = await formatSecurityEngineContext({
      type: 'text',
      actionData: parsed,
      origin: params.session.origin,
      chainId: findChain({ id: chainId })?.serverId || CHAINS.ETH.serverId,
      isTestnet: false,
      requireData: null,
      provider: {
        getTimeSpan,
        hasAddress: keyringService.hasAddress.bind(keyringService),
      },
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
      <BottomSheetScrollView style={styles.approvalTx} nestedScrollEnabled>
        {isLoading && (
          <Skeleton
            style={{
              width: '100%',
              height: 400,
            }}
          />
        )}
        {!isLoading && (
          <Actions
            account={currentAccount}
            data={parsedActionData}
            engineResults={engineResults}
            raw={hexData}
            message={signText}
            origin={params.session.origin}
            originLogo={site?.icon}
          />
        )}
      </BottomSheetScrollView>
      {isGnosisAccount && safeInfo ? (
        <GnosisDrawer
          visible={drawerVisible}
          safeInfo={safeInfo}
          onCancel={handleDrawerCancel}
          onConfirm={handleGnosisConfirm}
          confirmations={
            isGnosisAccount
              ? currentSafeMessage?.safeMessage?.confirmations || []
              : undefined
          }
        />
      ) : null}
      {isGnosisAccount && safeInfo && currentGnosisAdmin && (
        <GnosisAdminFooterBarPopup
          visible={gnosisFooterBarVisible}
          origin={params.session.origin}
          originLogo={site?.icon}
          // chain={chain}
          gnosisAccount={currentGnosisAdmin}
          account={currentAccount}
          onCancel={() => {
            setGnosisFooterBarVisible(false);
            handleCancel();
          }}
          // securityLevel={securityLevel}
          // hasUnProcessSecurityResult={hasUnProcessSecurityResult}
          onSubmit={handleGnosisSign}
          enableTooltip={
            currentGnosisAdmin?.type === KEYRING_TYPE.WatchAddressKeyring
          }
          tooltipContent={
            currentGnosisAdmin?.type === KEYRING_TYPE.WatchAddressKeyring ? (
              <Text>{t('page.signTx.canOnlyUseImportedAddress')}</Text>
            ) : null
          }
          disabledProcess={
            currentGnosisAdmin?.type === KEYRING_TYPE.WatchAddressKeyring
          }
          // isSubmitting={isSubmittingGnosis}
          onIgnoreAllRules={handleIgnoreAllRules}
        />
      )}
      <FooterBar
        hasShadow={footerShowShadow}
        securityLevel={securityLevel}
        hasUnProcessSecurityResult={hasUnProcessSecurityResult}
        origin={params.session.origin}
        originLogo={site?.icon}
        gnosisAccount={isGnosis ? params.account : undefined}
        account={currentAccount}
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
      <GnosisSameMessageModal
        visible={sameMessageState.visible}
        onCancel={() => {
          setSameMessageState({
            visible: false,
          });
          rejectApproval('');
        }}
        onConfirm={() => {
          setSameMessageState({
            visible: false,
          });
          resolveApproval(sameMessageState.preparedSignature);
        }}
      />
    </View>
  );
};
