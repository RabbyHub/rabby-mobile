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
import { Text, View } from 'react-native';
import useAsync from 'react-use/lib/useAsync';
import { useThemeColors } from '@/hooks/theme';
import { getStyles } from './SignTx/style';
import { matomoRequestEvent } from '@/utils/analytics';
import { getKRCategoryByType } from '@/utils/transaction';
import { stats } from '@/utils/stats';
import { toast } from '@/components/Toast';
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
import {
  MultiAction,
  TypeDataActionItem,
} from '@rabby-wallet/rabby-api/dist/types';

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
}

export const SignTypedData = ({
  params,
  account: $account,
}: {
  params: SignTypedDataProps;
  account: Account;
}) => {
  const currentAccount = params.isGnosis ? params.account! : $account;
  const [, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const { data, session, method, isGnosis, isSend } = params;
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
  const site = dappService.getDapp(params.session.origin);

  const [currentChainId, setCurrentChainId] = useState<number | undefined>(
    undefined,
  );
  const isGnosisAccount = currentAccount?.type === KEYRING_TYPE.GnosisKeyring;
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [gnosisFooterBarVisible, setGnosisFooterBarVisible] = useState(false);
  const [currentGnosisAdmin, setCurrentGnosisAdmin] = useState<Account | null>(
    null,
  );
  const [sameMessageState, setSameMessageState] = useSetState({
    visible: false,
    preparedSignature: '',
  });

  const isViewGnosisSafe = params?.$ctx?.isViewGnosisSafe;

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
  const [multiActionList, setMultiActionList] = useState<
    ParsedTypedDataActionData[]
  >([]);
  const [multiActionRequireDataList, setMultiActionRequireDataList] = useState<
    ActionRequireData[]
  >([]);
  const [multiActionEngineResultList, setMultiActionEngineResultList] =
    useState<Result[][]>([]);
  const isMultiActions = useMemo(() => {
    return !parsedActionData && multiActionList.length > 0;
  }, [parsedActionData, multiActionList]);
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

  const [signTypedData, rawMessage]: (null | Record<string, any>)[] =
    useMemo(() => {
      if (!isSignTypedDataV1) {
        try {
          const v = JSON.parse(data[1]);
          const normalized = normalizeTypeData(v);
          return [normalized, v];
        } catch (error) {
          console.error('parse signTypedData error: ', error);
          return [null, null];
        }
      }
      return [null, null];
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
    } else if (params.$ctx.chainId) {
      return params.$ctx.chainId;
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
    if (isGnosisAccount) {
      if (!isViewGnosisSafe) {
        apisSafe.clearGnosisMessage();
      }
    }
    if (!isSignTypedDataV1 && signTypedData) {
      const chainId = signTypedData?.domain?.chainId;
      if (isTestnetChainId(chainId)) {
        return null;
      }
      return await openapi.parseCommon({
        typed_data: signTypedData,
        user_addr: currentAccount!.address,
        origin: session.origin,
      });
    }
    return;
  }, [data, isSignTypedDataV1, signTypedData]);

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
    report('cancelSignText');
    rejectApproval('User rejected the request.');
  };

  const { activeApprovalPopup } = useCommonPopupView();
  const invokeEnterPassphrase = useEnterPassphraseModal('address');

  const handleAllow = async () => {
    if (activeApprovalPopup()) {
      return;
    }

    if (currentAccount?.type === KEYRING_TYPE.HdKeyring) {
      await invokeEnterPassphrase(currentAccount.address);
    }

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
    if (params.session.origin !== INTERNAL_REQUEST_ORIGIN) {
      const site = await dappService.getDapp(params.session.origin);
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
      cex: cexInfo,
    });
    return requireData;
  };

  const getSecurityEngineResult = async ({
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
    return result;
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
    executeSecurityEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  useEffect(() => {
    const sender = isSignTypedDataV1 ? params.data[1] : params.data[0];
    if (!loading) {
      console.log('typedDataActionData', typedDataActionData);
      if (typedDataActionData) {
        if (typedDataActionData?.action?.type === 'multi_actions') {
          const actions = typedDataActionData.action.data as MultiAction;
          const res = actions.map(action =>
            parseAction({
              type: 'typed_data',
              data: action as TypeDataActionItem,
              typedData: signTypedData,
              sender,
              balanceChange:
                typedDataActionData.pre_exec_result?.balance_change,
              preExecVersion:
                typedDataActionData.pre_exec_result?.pre_exec_version,
              gasUsed: typedDataActionData.pre_exec_result?.gas.gas_used,
            }),
          );
          setMultiActionList(res);
          Promise.all(
            res.map(item => {
              if (!item.contractId) {
                item.contractId =
                  typedDataActionData.contract_call_data?.contract.id;
              }
              return getRequireData(item);
            }),
          ).then(async requireDataList => {
            setMultiActionRequireDataList(requireDataList);
            const results = await Promise.all(
              requireDataList.map((requireData, index) => {
                return getSecurityEngineResult({
                  data: res[index],
                  requireData,
                });
              }),
            );
            setMultiActionEngineResultList(results);
            setIsLoading(false);
          });
        } else {
          const parsed = parseAction({
            type: 'typed_data',
            data: typedDataActionData.action as any,
            typedData: signTypedData,
            sender,
            balanceChange: typedDataActionData.pre_exec_result?.balance_change,
            preExecVersion:
              typedDataActionData.pre_exec_result?.pre_exec_version,
            gasUsed: typedDataActionData.pre_exec_result?.gas.gas_used,
          });
          setParsedActionData(parsed);
          if (!parsed.contractId) {
            parsed.contractId =
              typedDataActionData.contract_call_data?.contract.id;
          }
          getRequireData(parsed).then(async requireData => {
            setActionRequireData(requireData);
            const securityEngineResult = await getSecurityEngineResult({
              data: parsed,
              requireData,
            });
            setEngineResults(securityEngineResult);
            setIsLoading(false);
          });
        }
      } else {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, typedDataActionData, signTypedData, params, isSignTypedDataV1]);

  useEffect(() => {
    init();
    checkWachMode();
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
            requireData={actionRequireData}
            chain={chain}
            engineResults={engineResults}
            raw={isSignTypedDataV1 ? data[0] : signTypedData || data[1]}
            message={parsedMessage}
            origin={params.session.origin}
            originLogo={site?.icon}
            typedDataActionData={typedDataActionData}
            multiAction={
              isMultiActions
                ? {
                    actionList: multiActionList,
                    requireDataList: multiActionRequireDataList,
                    engineResultList: multiActionEngineResultList,
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
        origin={params.session.origin}
        originLogo={site?.icon}
        chain={chain}
        gnosisAccount={isGnosis ? params.account : undefined}
        account={currentAccount}
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
