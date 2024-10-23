import React, { ReactNode, useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { WaitingSignComponent } from './map';
import { FooterBar } from './FooterBar/FooterBar';
import RuleDrawer from './SecurityEngine/RuleDrawer';
import Actions from './TypedDataActions';
import {
  parseAction,
  formatSecurityEngineContext,
  fetchActionRequiredData,
  ActionRequireData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { findChain, isTestnetChainId } from '@/utils/chain';
import { Account } from '@/core/services/preference';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { underline2Camelcase } from '@/core/controllers/rpcFlow';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useApproval } from '@/hooks/useApproval';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Skeleton } from '@rneui/themed';
import { useApprovalSecurityEngine } from '../hooks/useApprovalSecurityEngine';
import { apiKeyring, apiSecurityEngine } from '@/core/apis';
import { parseSignTypedDataMessage } from './SignTypedDataExplain/parseSignTypedDataMessage';
import {
  dappService,
  keyringService,
  preferenceService,
  transactionHistoryService,
  whitelistService,
} from '@/core/services';
import { openapi, testOpenapi } from '@/core/request';
import { ScrollView, Text, View } from 'react-native';
import useAsync from 'react-use/lib/useAsync';
import { useThemeColors } from '@/hooks/theme';
import { getStyles } from './SignTx/style';
import { matomoRequestEvent } from '@/utils/analytics';
import { getKRCategoryByType } from '@/utils/transaction';
import { stats } from '@/utils/stats';
import { apisSafe } from '@/core/apis/safe';
import { toast } from '@/components/Toast';
import { adjustV } from '@/utils/gnosis';
import { apisKeyring } from '@/core/apis/keyring';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { TestnetTag } from './TestnetTag';
import { normalizeTypeData } from './TypedDataActions/utils';
import { CHAINS } from '@debank/common';
import { ALIAS_ADDRESS } from '@/constant/gas';
import { getTimeSpan } from '@/utils/time';

interface SignTypedDataProps {
  method: string;
  data: any[];
  session: {
    origin: string;
    icon: string;
    name: string;
  };
  isGnosis?: boolean;
  isSend?: boolean;
  account?: Account;
}

export const SignTypedData = ({ params }: { params: SignTypedDataProps }) => {
  const [, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWatch, setIsWatch] = useState(false);
  const [isLedger, setIsLedger] = useState(false);
  const [useLedgerLive, setUseLedgerLive] = useState(false);
  const [footerShowShadow, setFooterShowShadow] = useState(false);
  const { executeEngine } = useSecurityEngine();
  const [engineResults, setEngineResults] = useState<Result[]>([]);
  const { userData, rules, currentTx, ...apiApprovalSecurityEngine } =
    useApprovalSecurityEngine();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [currentChainId, setCurrentChainId] = useState<
    number | string | undefined
  >(undefined);

  // useSignPermissionCheck({
  //   origin: params.session.origin,
  //   chainId: currentChainId,
  //   onOk: () => {
  //     handleCancel();
  //   },
  //   onDisconnect: () => {
  //     handleCancel();
  //   },
  // });

  // useTestnetCheck({
  //   chainId: currentChainId,
  //   onOk: () => {
  //     handleCancel();
  //   },
  // });
  const [actionRequireData, setActionRequireData] =
    useState<ActionRequireData>(null);
  const [parsedActionData, setParsedActionData] =
    useState<ParsedTypedDataActionData | null>(null);
  const [cantProcessReason, setCantProcessReason] =
    useState<ReactNode | null>();
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
    // const hasForbidden = enableResults.find(
    //   (result) => result.level === Level.FORBIDDEN
    // );
    const hasSafe = !!enableResults.find(result => result.level === Level.SAFE);
    const needProcess = enableResults.filter(
      result =>
        (result.level === Level.DANGER ||
          result.level === Level.WARNING ||
          result.level === Level.FORBIDDEN) &&
        !processedRules.includes(result.id),
    );
    // if (hasForbidden) return true;
    if (needProcess.length > 0) {
      return !hasSafe;
    } else {
      return false;
    }
  }, [engineResults, currentTx]);

  const { data, session, method, isGnosis, isSend, account } = params;
  let parsedMessage = '';
  let _message = '';
  try {
    // signTypeDataV1 [Message, from]
    if (/^eth_signTypedData(_v1)?$/.test(method)) {
      _message = data[0].reduce((m, n) => {
        m[n.name] = n.value;
        return m;
      }, {});
    } else {
      // [from, Message]
      _message = parseSignTypedDataMessage(data[1]);
    }

    parsedMessage = JSON.stringify(_message, null, 4);
  } catch (err) {
    console.log('parse message error', parsedMessage);
  }

  const isSignTypedDataV1 = useMemo(
    () => /^eth_signTypedData(_v1)?$/.test(method),
    [method],
  );

  const signTypedData: null | Record<string, any> = useMemo(() => {
    if (!isSignTypedDataV1) {
      try {
        const v = JSON.parse(data[1]);
        const normalized = normalizeTypeData(v);
        return normalized;
      } catch (error) {
        console.error('parse signTypedData error: ', error);
        return null;
      }
    }
    return null;
  }, [data, isSignTypedDataV1]);

  const chain = useMemo(() => {
    if (!isSignTypedDataV1 && signTypedData) {
      let chainId;
      try {
        chainId = signTypedData?.domain?.chainId;
      } catch (error) {
        console.error(error);
      }
      if (chainId) {
        // return CHAINS_LIST.find(e => e.id === Number(chainId));
        return (
          findChain({
            id: chainId,
          }) || undefined
        );
      }
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isSignTypedDataV1, signTypedData]);

  const getCurrentChainId = async () => {
    if (params.session.origin !== INTERNAL_REQUEST_ORIGIN) {
      const site = await dappService.getDapp(params.session.origin);
      if (site) {
        return findChain({
          enum: site?.chainId,
        })?.id;
      }
    } else {
      return chain?.id;
    }
  };
  useEffect(() => {
    getCurrentChainId().then(id => {
      setCurrentChainId(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.session.origin]);

  const {
    value: typedDataActionData,
    loading,
    error,
  } = useAsync(async () => {
    if (!isSignTypedDataV1 && signTypedData) {
      const currentAccount = isGnosis
        ? account
        : await preferenceService.getCurrentAccount();

      const chainId = signTypedData?.domain?.chainId;
      if (isTestnetChainId(chainId)) {
        return null;
      }
      return await openapi.parseTypedData({
        typedData: signTypedData,
        address: currentAccount!.address,
        origin: session.origin,
      });
    }
    return;
  }, [data, isSignTypedDataV1, signTypedData]);

  if (error) {
    console.error('error', error);
  }

  const checkWachMode = async () => {
    const currentAccount = isGnosis
      ? account
      : await preferenceService.getCurrentAccount();
    if (
      currentAccount &&
      currentAccount.type === KEYRING_TYPE.WatchAddressKeyring
    ) {
      setIsWatch(true);
      setCantProcessReason(t('page.signTx.canOnlyUseImportedAddress'));
    }
    if (currentAccount && currentAccount.type === KEYRING_TYPE.GnosisKeyring) {
      setIsWatch(true);
      setCantProcessReason(t('page.signTypedData.safeCantSignText'));
    }
  };

  const report = async (
    action:
      | 'createSignText'
      | 'startSignText'
      | 'cancelSignText'
      | 'completeSignText',
    extra?: Record<string, any>,
  ) => {
    const currentAccount = isGnosis
      ? account
      : await preferenceService.getCurrentAccount();
    if (currentAccount) {
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
        method: underline2Camelcase(params.method),
        ...extra,
      });
    }
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
      ? account
      : await preferenceService.getCurrentAccount();

    if (currentAccount?.type === KEYRING_TYPE.HdKeyring) {
      await invokeEnterPassphrase(currentAccount.address);
    }

    if (isGnosis && params.account) {
      if (
        WaitingSignComponent[params.account.type] &&
        ![KEYRING_CLASS.PRIVATE_KEY, KEYRING_CLASS.MNEMONIC].includes(
          params.account.type as any,
        )
      ) {
        apisKeyring.signTypedData(
          params.account.type,
          params.account.address,
          JSON.parse(params.data[1]),
          {
            brandName: params.account.brandName,
            version: 'V4',
          },
        );

        resolveApproval({
          uiRequestComponent: WaitingSignComponent[params.account.type],
          type: params.account.type,
          address: params.account.address,
          data: params.data,
          isGnosis: true,
          account: params.account,
        });
      } else {
        try {
          let result = await apisKeyring.signTypedData(
            params.account.type,
            params.account.address,
            JSON.parse(params.data[1]),
            {
              version: 'V4',
            },
          );
          result = adjustV('eth_signTypedData', result);
          report('completeSignText', {
            success: true,
          });
          const sigs = await apisSafe.getGnosisTransactionSignatures();
          if (sigs.length > 0) {
            await apisSafe.gnosisAddConfirmation(
              params.account.address,
              result,
            );
          } else {
            await apisSafe.gnosisAddSignature(params.account.address, result);
            await apisSafe.postGnosisTransaction();
          }

          resolveApproval(result, false, false);
        } catch (e: any) {
          toast.info(e?.message);
          report('completeSignText', {
            success: false,
          });
        }
      }
      return;
    }
    if (currentAccount?.type && WaitingSignComponent[currentAccount?.type]) {
      resolveApproval({
        uiRequestComponent: WaitingSignComponent[currentAccount?.type],
        type: currentAccount.type,
        address: currentAccount.address,
        extra: {
          brandName: currentAccount.brandName,
          signTextMethod: underline2Camelcase(params.method),
        },
      });

      return;
    }
    report('startSignText');
    resolveApproval({});
  };

  const init = async () => {};

  const getRequireData = async (data: ParsedTypedDataActionData) => {
    const currentAccount = isGnosis
      ? account
      : await preferenceService.getCurrentAccount();

    if (params.session.origin !== INTERNAL_REQUEST_ORIGIN) {
      const site = await dappService.getDapp(params.session.origin);
      if (site) {
        data.chainId = findChain({
          enum: site.chainId,
        })?.id?.toString();
      }
    }
    if (currentAccount) {
      let chainServerId: string | undefined;
      if (data.chainId) {
        chainServerId = findChain({
          id: Number(data.chainId),
        })?.serverId;
      }

      const requireData = await fetchActionRequiredData({
        type: 'typed_data',
        actionData: data,
        sender: currentAccount.address,
        chainId: chainServerId || CHAINS.ETH.serverId,
        walletProvider: {
          hasPrivateKeyInWallet: apiKeyring.hasPrivateKeyInWallet,
          hasAddress: keyringService.hasAddress.bind(keyringService),
          getWhitelist: async () => whitelistService.getWhitelist(),
          isWhitelistEnabled: async () => whitelistService.isWhitelistEnabled(),
          getPendingTxsByNonce: async (...args) =>
            transactionHistoryService.getPendingTxsByNonce(...args),
          findChain,
          ALIAS_ADDRESS,
        },
        apiProvider: isTestnetChainId(data.chainId) ? testOpenapi : openapi,
      });
      setActionRequireData(requireData);
      const ctx = await formatSecurityEngineContext({
        type: 'typed_data',
        actionData: data,
        requireData,
        chainId: chainServerId || CHAINS.ETH.serverId,
        isTestnet: isTestnetChainId(data.chainId),
        provider: {
          getTimeSpan,
          hasAddress: keyringService.hasAddress.bind(keyringService),
        },
        origin: params.session.origin,
      });
      const result = await executeEngine(ctx);
      setEngineResults(result);
    }
    setIsLoading(false);
  };

  const executeSecurityEngine = async () => {
    if (!parsedActionData) {
      return;
    }
    let chainServerId: string | undefined;
    if (parsedActionData.chainId) {
      chainServerId = findChain({
        id: Number(parsedActionData.chainId),
      })?.serverId;
    }
    const ctx = await formatSecurityEngineContext({
      type: 'typed_data',
      actionData: parsedActionData,
      requireData: actionRequireData,
      chainId: chainServerId || CHAINS.ETH.serverId,
      isTestnet: isTestnetChainId(parsedActionData.chainId),
      provider: {
        getTimeSpan,
        hasAddress: keyringService.hasAddress.bind(keyringService),
      },
      origin: params.session.origin,
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

  useEffect(() => {
    executeSecurityEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  useEffect(() => {
    const sender = isSignTypedDataV1 ? params.data[1] : params.data[0];
    if (!loading) {
      if (typedDataActionData) {
        const parsed = parseAction({
          type: 'typed_data',
          data: typedDataActionData.action,
          typedData: signTypedData,
          sender,
        });
        setParsedActionData(parsed);
        getRequireData(parsed);
      } else {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, typedDataActionData, signTypedData, params, isSignTypedDataV1]);

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
    init();
    checkWachMode();
    report('createSignText');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.approvalTx}>
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
            data={parsedActionData}
            requireData={actionRequireData}
            chain={chain}
            engineResults={engineResults}
            raw={isSignTypedDataV1 ? data[0] : signTypedData || data[1]}
            message={parsedMessage}
            origin={params.session.origin}
            originLogo={params.session.icon}
          />
        )}
        {chain?.isTestnet ? (
          <TestnetTag
            style={{
              right: 0,
              top: 320,
            }}
          />
        ) : null}
      </ScrollView>

      <FooterBar
        hasShadow={footerShowShadow}
        origin={params.session.origin}
        originLogo={params.session.icon}
        chain={chain}
        gnosisAccount={isGnosis ? account : undefined}
        onCancel={handleCancel}
        securityLevel={securityLevel}
        hasUnProcessSecurityResult={hasUnProcessSecurityResult}
        onSubmit={() => handleAllow()}
        enableTooltip={isWatch}
        tooltipContent={cantProcessReason}
        disabledProcess={isLoading || isWatch || hasUnProcessSecurityResult}
        isTestnet={chain?.isTestnet}
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
      {/* <TokenDetailPopup
        token={tokenDetail.selectToken}
        visible={tokenDetail.popupVisible}
        onClose={() => dispatch.sign.closeTokenDetailPopup()}
        canClickToken={false}
        hideOperationButtons
        variant="add"
      /> */}
    </View>
  );
};
