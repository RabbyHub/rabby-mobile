import type { ReactNode } from 'react';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { WaitingSignComponent } from './map';
import { FooterBar } from './FooterBar/FooterBar';
import RuleDrawer from './SecurityEngine/RuleDrawer';
import Actions from './TypedDataActions';
import type {
  ActionRequireData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';
import {
  parseAction,
  formatSecurityEngineContext,
  fetchActionRequiredData,
} from '@rabby-wallet/rabby-action';
import { findChain, isTestnetChainId } from '@/utils/chain';
import type { Account } from '@/core/startupServices/preference';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { useApproval } from '@/hooks/useApproval';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Skeleton } from '@rneui/themed';
import {
  useApprovalSecurityEngine,
  SecurityEngineScopeProvider,
} from '../hooks/useApprovalSecurityEngine';
import {
  useActionSecurity,
  type PreparedSecurityActions,
} from '../hooks/useActionSecurity';
import { SecurityEngineError } from './SecurityEngine/SecurityEngineError';
import type { ContextActionData } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { apiKeyring, apiProvider, apiSecurityEngine } from '@/core/apis';
import { parseSignTypedDataMessage } from './SignTypedDataExplain/parseSignTypedDataMessage';
import { dappServiceApi, getDappSnapshot } from '@/core/serviceApi/dapp';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import { whitelistServiceApi } from '@/core/serviceApi/whitelist';
import { openapi, testOpenapi } from '@/core/request';
import { View } from 'react-native';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import { useTheme2024 } from '@/hooks/theme';
import { getStyles } from './SignTx/style';
import { matomoRequestEvent } from '@/utils/analytics';
import { getKRCategoryByType } from '@/utils/transaction';
import { stats } from '@/utils/stats';
import { toast } from '@/components2024/Toast';
import { adjustV } from '@/utils/gnosis';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { TestnetTag } from './TestnetTag';
import { normalizeTypeData } from './TypedDataActions/utils';
import { CHAINS } from '@debank/common';
import { ALIAS_ADDRESS } from '@/constant/gas';
import { getTimeSpan } from '@/utils/time';
import { useGetCurrentSafeInfo } from '@/hooks/gnosis/useGetCurrentSafeInfo';
import { useGetMessageHash } from '@/hooks/gnosis/useGetCurrentMessageHash';
import { useCheckCurrentSafeMessage } from '@/hooks/gnosis/useCheckCurrentSafeMessage';
import { apisSafe } from '@/core/apis/safe';
import { generateTypedData } from '@safe-global/protocol-kit/dist/src/utils/eip-712';
import { apisKeyring } from '@/core/apis/keyring';
import { GnosisDrawer } from './TxComponents/GnosisDrawer';
import { GnosisAdminFooterBarPopup } from './TxComponents/GnosisAdminFooterBarPopup';
import { useSetState } from 'ahooks';
import { GnosisSameMessageModal } from './TxComponents/GnosisSameMessageModal';
import { underline2Camelcase } from '@/core/utils/common';
import { getCexInfo } from '@/hooks/useCexSupportList';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type {
  MultiAction,
  TypeDataActionItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { Text } from '@/components/Typography';
import type { ProviderRequestContext } from '@/core/controllers/type';
import {
  tokenizeSignTypedDataMessage,
  type SignMessageHighlightToken,
} from './signMessageTokenizer';
import { useSignMessageAddressData } from './useSignMessageAddressData';
import { addSignMessageOriginFallback } from './signMessageOrigin';
import { SignMessageTagProvider } from './SignMessageHighlighter';

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
  $ctx?: any;
  requestContext?: ProviderRequestContext;
}

export const SignTypedData = ({
  params,
  account: $account,
}: {
  params: SignTypedDataProps;
  account: Account;
}) => {
  const currentAccount = params.isGnosis ? params.account! : $account;
  const { t } = useTranslation();
  const [approvalViewportHeight, setApprovalViewportHeight] = useState(0);
  const { data, session, method, isGnosis, isSend } = params;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isWatch, setIsWatch] = useState(false);
  const [isLedger, setIsLedger] = useState(false);
  const [useLedgerLive, setUseLedgerLive] = useState(false);
  const [footerShowShadow, setFooterShowShadow] = useState(false);
  const apiApprovalSecurityEngine = useApprovalSecurityEngine();
  const { currentTx } = apiApprovalSecurityEngine;
  const { colors2024 } = useTheme2024();
  const styles = useMemo(() => getStyles(colors2024), [colors2024]);
  const site = getDappSnapshot(params.session.origin);

  const isGnosisAccount = currentAccount?.type === KEYRING_TYPE.GnosisKeyring;
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [gnosisFooterBarVisible, setGnosisFooterBarVisible] = useState(false);
  const [currentGnosisAdmin, setCurrentGnosisAdmin] = useState<Account | null>(
    null,
  );
  const [sameMessageState, setSameMessageState] = useSetState({
    visible: false,
    preparedSignature: '',
    requestKey: '',
  });

  const isViewGnosisSafe = params?.$ctx?.isViewGnosisSafe;

  // useTestnetCheck({
  //   chainId: currentChainId,
  //   onOk: () => {
  //     handleCancel();
  //   },
  // });
  const [preparedActions, setPreparedActions] = useState<
    | (PreparedSecurityActions<ParsedTypedDataActionData> & {
        requestKey: string;
      })
    | null
  >(null);
  const [preparationError, setPreparationError] = useState(false);
  const [cantProcessReason, setCantProcessReason] =
    useState<ReactNode | null>();

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

  const requestChainId = params.requestContext?.chainId ?? params.$ctx?.chainId;

  const [signTypedData, rawMessage]: (null | Record<string, any>)[] =
    useMemo(() => {
      if (!isSignTypedDataV1) {
        try {
          const raw = JSON.parse(data[1]);
          const normalized = normalizeTypeData(JSON.parse(data[1]));
          return [normalized, raw];
        } catch (error) {
          console.error('parse signTypedData error: ', error);
          return [null, null];
        }
      }
      return [null, null];
    }, [data, isSignTypedDataV1]);

  const chain = useMemo(() => {
    if (requestChainId) {
      return (
        findChain({
          id: requestChainId,
        }) || undefined
      );
    }

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
  }, [data, isSignTypedDataV1, signTypedData, requestChainId]);

  const currentChainId =
    requestChainId ||
    (params.session.origin !== INTERNAL_REQUEST_ORIGIN
      ? findChain({ enum: site?.chainId })?.id
      : params.$ctx?.chainId || chain?.id);

  const messageTokens = useMemo<SignMessageHighlightToken[]>(() => {
    if (!parsedMessage) return [];
    if (isSignTypedDataV1) {
      const fields = (Array.isArray(data[0]) ? data[0] : []) as Array<{
        name: string;
        type: string;
        value: unknown;
      }>;
      return tokenizeSignTypedDataMessage(
        {
          primaryType: 'RabbySignTypedDataV1',
          types: {
            RabbySignTypedDataV1: fields.map(({ name, type }) => ({
              name,
              type,
            })),
          },
          message: Object.fromEntries(
            fields.map(({ name, value }) => [name, value]),
          ),
        },
        parsedMessage,
      );
    }

    return rawMessage
      ? tokenizeSignTypedDataMessage(rawMessage, parsedMessage)
      : [{ type: 'text', value: parsedMessage }];
  }, [data, isSignTypedDataV1, parsedMessage, rawMessage]);
  const resolvedAddressChain =
    chain ||
    (currentChainId ? findChain({ id: currentChainId }) : undefined) ||
    CHAINS.ETH;
  const addressData = useSignMessageAddressData({
    tokens: messageTokens,
    chain: resolvedAddressChain,
    accountAddress: currentAccount.address,
  });

  const requestKey = useMemo(
    () =>
      JSON.stringify([
        method,
        data,
        session.origin,
        currentAccount.address,
        currentAccount.type,
        currentChainId,
      ]),
    [
      method,
      data,
      session.origin,
      currentAccount.address,
      currentAccount.type,
      currentChainId,
    ],
  );
  const {
    value: parsedResponse,
    loading,
    error,
    retry: retryParse,
  } = useAsyncRetry(async () => {
    if (isGnosisAccount && !isViewGnosisSafe) {
      await apisSafe.clearGnosisMessage();
    }
    if (
      !isSignTypedDataV1 &&
      signTypedData &&
      !isTestnetChainId(signTypedData.domain?.chainId)
    ) {
      const response = await openapi.parseCommon({
        typed_data: signTypedData,
        user_addr: currentAccount.address,
        origin: session.origin,
      });
      if (!response) throw new Error('Missing typed-data parse response');
      return { requestKey, response };
    }
    return { requestKey, response: null };
  }, [requestKey, isSignTypedDataV1, signTypedData]);
  const typedDataActionData =
    parsedResponse?.requestKey === requestKey ? parsedResponse.response : null;
  const currentPreparedActions =
    !loading && !error && preparedActions?.requestKey === requestKey
      ? preparedActions
      : null;
  const security = useActionSecurity(
    currentPreparedActions,
    apiApprovalSecurityEngine,
    'typedData',
  );
  const {
    securityLevel,
    hasUnProcessSecurityResult,
    blocked: securityBlocked,
  } = security;
  const isMultiActions = currentPreparedActions?.type === 'multi';
  const parsedActionData = isMultiActions
    ? null
    : currentPreparedActions?.actions[0]?.data || null;
  const actionRequireData = isMultiActions
    ? null
    : currentPreparedActions?.actions[0]?.requireData || null;
  const multiActionList = useMemo(
    () => currentPreparedActions?.actions.map(action => action.data) || [],
    [currentPreparedActions],
  );
  const multiActionRequireDataList = useMemo(
    () =>
      currentPreparedActions?.actions.map(action => action.requireData) || [],
    [currentPreparedActions],
  );
  const multiActionEngineResultList = security.resultList;
  const engineResults = isMultiActions ? [] : security.engineResults;
  const securityCheckFailed = !!error || preparationError || security.error;
  const isLoading = !securityCheckFailed && !security.ready;
  const [getApproval, resolveApproval, rejectApproval] = useApproval({
    canResolve: () => !isWatch && security.canSubmit(),
  });
  const executeSecurityEngine = security.retry;
  const retrySecurityCheck = () => {
    security.invalidate();
    setPreparedActions(null);
    setPreparationError(false);
    retryParse();
  };
  const isUnparsedAction = typedDataActionData?.action === null;

  if (error) {
    console.error('error', error);
  }

  const checkWachMode = async () => {
    if (
      currentAccount &&
      currentAccount.type === KEYRING_TYPE.WatchAddressKeyring
    ) {
      setIsWatch(true);
      setCantProcessReason(t('page.signTx.canOnlyUseImportedAddress'));
    }

    if (
      currentAccount &&
      currentAccount.type === KEYRING_TYPE.GnosisKeyring &&
      isSignTypedDataV1
    ) {
      setIsWatch(true);
      setCantProcessReason(t('page.signTypedData.safeCantSignTypedData'));
    }
  };

  const { data: safeInfo } = useGetCurrentSafeInfo({
    chainId: currentChainId,
    account: currentAccount!,
    rejectApproval,
  });
  const { data: safeMessageHash } = useGetMessageHash({
    chainId: currentChainId,
    message: rawMessage,
    account: currentAccount!,
  });
  const { data: currentSafeMessage } = useCheckCurrentSafeMessage(
    {
      chainId: currentChainId,
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
            requestKey,
          });
        }
      },
    },
  );

  const report = async (
    action:
      | 'createSignText'
      | 'startSignText'
      | 'cancelSignText'
      | 'completeSignText',
    extra?: Record<string, any>,
  ) => {
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
    security.invalidate();
    report('cancelSignText');
    rejectApproval('User rejected the request.');
  };

  const { activeApprovalPopup } = useCommonPopupView();
  const invokeEnterPassphrase = useEnterPassphraseModal('address');

  const handleAllow = async () => {
    if (isWatch || !security.canSubmit() || activeApprovalPopup()) {
      return;
    }

    if (currentAccount?.type === KEYRING_TYPE.HdKeyring) {
      await invokeEnterPassphrase(currentAccount.address);
    }

    if (!security.canSubmit()) return;
    if (!(await getApproval()) || !security.canSubmit()) return;
    if (isGnosisAccount) {
      setDrawerVisible(true);
      return;
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
          $account: currentAccount,
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
        $account: currentAccount,
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
    if (requestChainId) {
      data.chainId = requestChainId.toString();
    } else if (params.session.origin !== INTERNAL_REQUEST_ORIGIN) {
      const site = await dappServiceApi.getDapp(params.session.origin);
      if (site) {
        data.chainId = findChain({
          enum: site.chainId,
        })?.id?.toString();
      }
    }
    if (!currentAccount) throw new Error('No current account found');
    let chainServerId: string | undefined;
    if (data.chainId) {
      chainServerId = findChain({
        id: Number(data.chainId),
      })?.serverId;
    }
    const cexInfo = await getCexInfo(data.send?.to || '');

    const requireData = await fetchActionRequiredData({
      type: 'typed_data',
      actionData: data,
      sender: currentAccount.address,
      chainId: chainServerId || CHAINS.ETH.serverId,
      walletProvider: {
        ethRpc: apiProvider.requestETHRpc,
        hasPrivateKeyInWallet: apiKeyring.hasPrivateKeyInWallet,
        hasAddress: address => keyringServiceApi.hasAddress(address),
        getWhitelist: async () => whitelistServiceApi.getWhitelist(),
        isWhitelistEnabled: async () =>
          whitelistServiceApi.isWhitelistEnabled(),
        getPendingTxsByNonce: async (...args) =>
          transactionHistoryServiceApi.getPendingTxsByNonce(...args),
        findChain,
        ALIAS_ADDRESS,
      },
      apiProvider: isTestnetChainId(data.chainId) ? testOpenapi : openapi,
      cex: cexInfo,
    });
    return requireData;
  };

  const withOriginFallback = (ctx: ContextActionData) =>
    addSignMessageOriginFallback(ctx, {
      isUnparsedAction,
      isInternalOrigin: params.session.origin === INTERNAL_REQUEST_ORIGIN,
      message: parsedMessage,
      origin: params.session.origin,
    });

  const getSecurityEngineContext = async ({
    data,
    requireData,
  }: {
    data: ParsedTypedDataActionData;
    requireData: ActionRequireData;
  }) => {
    let chainServerId: string | undefined;
    if (data.chainId) {
      chainServerId = findChain({
        id: Number(data.chainId),
      })?.serverId;
    }
    const baseCtx = await formatSecurityEngineContext({
      type: 'typed_data',
      actionData: data,
      requireData,
      chainId: chainServerId || CHAINS.ETH.serverId,
      isTestnet: isTestnetChainId(data.chainId),
      provider: {
        getTimeSpan,
        hasAddress: address => keyringServiceApi.hasAddress(address),
      },
      origin: params.session.origin,
    });
    return withOriginFallback(baseCtx);
  };

  const handleIgnoreAllRules = () => {
    if (!security.ready) return;
    apiApprovalSecurityEngine.processAllRules([
      ...currentTx.processedRules,
      ...security.pendingRuleKeys,
    ]);
  };

  const handleIgnoreRule = (id: string) => {
    apiApprovalSecurityEngine.processRule(
      id,
      currentTx.ruleDrawer.selectRule?.scope,
    );
    apiApprovalSecurityEngine.closeRuleDrawer();
  };

  const handleUndoIgnore = (id: string) => {
    apiApprovalSecurityEngine.unProcessRule(
      id,
      currentTx.ruleDrawer.selectRule?.scope,
    );
    apiApprovalSecurityEngine.closeRuleDrawer();
  };

  const handleRuleEnableStatusChange = async (id: string, value: boolean) => {
    security.invalidate();
    apiApprovalSecurityEngine.unProcessRule(
      id,
      currentTx.ruleDrawer.selectRule?.scope,
    );
    try {
      await apiSecurityEngine.ruleEnableStatusChange(id, value);
      await apiApprovalSecurityEngine.init();
    } finally {
      security.retry();
    }
  };

  const handleRuleDrawerClose = (update: boolean) => {
    if (update) {
      executeSecurityEngine();
    }
    apiApprovalSecurityEngine.closeRuleDrawer();
  };

  const handleDrawerCancel = () => {
    setDrawerVisible(false);
  };

  const handleGnosisConfirm = async (account: Account) => {
    if (!safeInfo) return;
    setGnosisFooterBarVisible(true);
    setCurrentGnosisAdmin(account);
  };

  const handleGnosisSign = async () => {
    if (!security.canSubmit()) return;
    const account = currentGnosisAdmin;
    const signTypedData = rawMessage;
    if (!safeInfo || !account || !signTypedData) {
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
        networkId: currentChainId + '',
        message: signTypedData,
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

    if (!security.canSubmit()) return;
    if (!(await getApproval()) || !security.canSubmit()) return;
    const typedData = generateTypedData({
      safeAddress: safeInfo.address,
      safeVersion: safeInfo.version,
      chainId: BigInt(currentChainId!),
      data: signTypedData as any,
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
        type: account.type,
        address: account.address,
        data: [account.address, JSON.stringify(typedData)],
        isGnosis: true,
        account: account,
        safeMessage: {
          message: signTypedData,
          safeAddress: safeInfo.address,
          chainId: currentChainId,
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

  useEffect(() => {
    let cancelled = false;
    setPreparedActions(null);
    setPreparationError(false);
    if (loading || error || parsedResponse?.requestKey !== requestKey) return;
    const prepare = async () => {
      const sender = isSignTypedDataV1 ? params.data[1] : params.data[0];
      if (!typedDataActionData) {
        setPreparedActions({ requestKey, type: 'single', actions: [] });
        return;
      }
      const multi = typedDataActionData.action?.type === 'multi_actions';
      const actionsToParse = multi
        ? (typedDataActionData.action!.data as MultiAction)
        : [typedDataActionData.action];
      if (!actionsToParse.length)
        throw new Error('Empty typed-data action batch');
      const actions = await Promise.all(
        actionsToParse.map(async action => {
          const data = parseAction({
            type: 'typed_data',
            data: action as TypeDataActionItem,
            typedData: signTypedData,
            sender,
            balanceChange: typedDataActionData.pre_exec_result?.balance_change,
            preExecVersion:
              typedDataActionData.pre_exec_result?.pre_exec_version,
            gasUsed: typedDataActionData.pre_exec_result?.gas.gas_used,
          });
          if (!data.contractId)
            data.contractId =
              typedDataActionData.contract_call_data?.contract.id;
          const requireData = await getRequireData(data);
          const ctx = await getSecurityEngineContext({ data, requireData });
          return { data, requireData, ctx };
        }),
      );
      if (!cancelled)
        setPreparedActions({
          requestKey,
          type: multi ? 'multi' : 'single',
          actions,
        });
    };
    prepare().catch(() => {
      if (!cancelled) setPreparationError(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, parsedResponse, requestKey, signTypedData]);

  useEffect(() => {
    init();
    checkWachMode();
    report('createSignText');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SecurityEngineScopeProvider scope={security.securityScopes[0]}>
      <SignMessageTagProvider style={styles.wrapper}>
        <BottomSheetScrollView
          style={styles.approvalTx}
          nestedScrollEnabled
          onLayout={event =>
            setApprovalViewportHeight(event.nativeEvent.layout.height)
          }>
          {isLoading && (
            <Skeleton
              style={{
                width: '100%',
                height: 400,
              }}
            />
          )}
          {securityCheckFailed && (
            <SecurityEngineError onRetry={retrySecurityCheck} />
          )}
          {!isLoading && !securityCheckFailed && (
            <Actions
              account={currentAccount}
              data={parsedActionData}
              requireData={actionRequireData}
              chain={resolvedAddressChain || CHAINS.ETH}
              engineResults={engineResults}
              raw={isSignTypedDataV1 ? data[0] : signTypedData || data[1]}
              copyMessage={
                isSignTypedDataV1 ? JSON.stringify(data[0]) : data[1]
              }
              message={parsedMessage}
              messageTokens={messageTokens}
              addressData={addressData}
              origin={params.session.origin}
              originLogo={site?.icon}
              typedDataActionData={typedDataActionData}
              approvalViewportHeight={approvalViewportHeight}
              multiAction={
                isMultiActions
                  ? {
                      actionList: multiActionList,
                      requireDataList: multiActionRequireDataList,
                      engineResultList: multiActionEngineResultList,
                      securityScopes: security.securityScopes,
                    }
                  : undefined
              }
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
            account={currentGnosisAdmin}
            onCancel={() => {
              setGnosisFooterBarVisible(false);
              handleCancel();
            }}
            securityLevel={securityLevel}
            hasUnProcessSecurityResult={hasUnProcessSecurityResult}
            securityBlocked={securityBlocked}
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
          origin={params.session.origin}
          originLogo={site?.icon}
          chain={chain}
          gnosisAccount={isGnosis ? params.account : undefined}
          account={currentAccount}
          onCancel={handleCancel}
          securityLevel={securityLevel}
          securityBlocked={securityBlocked}
          hasUnProcessSecurityResult={hasUnProcessSecurityResult}
          onSubmit={() => handleAllow()}
          enableTooltip={isWatch}
          tooltipContent={cantProcessReason}
          disabledProcess={isWatch || securityBlocked}
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

        <GnosisSameMessageModal
          visible={
            sameMessageState.visible &&
            sameMessageState.requestKey === requestKey &&
            !securityBlocked
          }
          onCancel={() => {
            setSameMessageState({
              visible: false,
            });
            rejectApproval('');
          }}
          onConfirm={() => {
            if (
              !security.canSubmit() ||
              sameMessageState.requestKey !== requestKey
            )
              return;
            setSameMessageState({
              visible: false,
            });
            resolveApproval(sameMessageState.preparedSignature);
          }}
        />
      </SignMessageTagProvider>
    </SecurityEngineScopeProvider>
  );
};
