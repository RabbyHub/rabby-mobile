import { Account, ChainGas } from '@/core/services/preference';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { intToHex } from '@/utils/number';
import {
  calcMaxPriorityFee,
  validateGasPriceRange,
  convertLegacyTo1559,
} from '@/utils/transaction';
import { Chain } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  ExplainTxResponse,
  GasLevel,
  Tx,
  TxPushType,
} from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import BigNumber from 'bignumber.js';
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { WaitingSignComponent } from '../map';
import { isHexString } from 'ethereumjs-util';
import {
  ActionRequireData,
  ParsedActionData,
  fetchActionRequiredData,
  formatSecurityEngineCtx,
  parseAction,
} from '../Actions/utils';
import { openapi } from '@/core/request';
import { useSignPermissionCheck } from '../../hooks/useSignPermissionCheck';
import { useTestnetCheck } from '../../hooks/useTestnetCheck';
import GasSelector, {
  GasSelectorResponse,
} from '../TxComponents/GasSelector/GasSelector';
import { apiProvider, apiSecurityEngine } from '@/core/apis';
import {
  DEFAULT_GAS_LIMIT_RATIO,
  GAS_TOP_UP_ADDRESS,
  SAFE_GAS_LIMIT_RATIO,
} from '@/constant/gas';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { SUPPORT_1559_KEYRING_TYPE } from '@/constant/tx';
import {
  dappService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { toast } from '@/components/Toast';
import { BroadcastMode } from '../BroadcastMode';
import RuleDrawer from '../SecurityEngine/RuleDrawer';
import { FooterBar } from '../FooterBar/FooterBar';
import {
  useExplainGas,
  useCheckGasAndNonce,
  getRecommendNonce,
  getRecommendGas,
  getNativeTokenBalance,
  getGasLimitBaseAccountBalance,
  explainGas,
} from './calc';
import { TxTypeComponent } from './TxTypeComponent';
import { normalizeTxParams } from './util';
import { getStyles } from './style';
import { BottomSheetView } from '@gorhom/bottom-sheet';

interface SignTxProps<TData extends any[] = any[]> {
  params: {
    session: {
      origin: string;
      icon: string;
      name: string;
    };
    data: TData;
    isGnosis?: boolean;
    account?: Account;
    $ctx?: any;
  };
  origin?: string;
}

interface BlockInfo {
  baseFeePerGas: string;
  difficulty: string;
  extraData: string;
  gasLimit: string;
  gasUsed: string;
  hash: string;
  logsBloom: string;
  miner: string;
  mixHash: string;
  nonce: string;
  number: string;
  parentHash: string;
  receiptsRoot: string;
  sha3Uncles: string;
  size: string;
  stateRoot: string;
  timestamp: string;
  totalDifficulty: string;
  transactions: string[];
  transactionsRoot: string;
  uncles: string[];
}

export const SignTx = ({ params, origin }: SignTxProps) => {
  const { account } = params;
  const [isReady, setIsReady] = useState(false);
  const [nonceChanged, setNonceChanged] = useState(false);
  const [canProcess, setCanProcess] = useState(true);
  const [cantProcessReason, setCantProcessReason] =
    useState<ReactNode | null>();
  const [gasPriceMedian, setGasPriceMedian] = useState<null | number>(null);
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null);
  const [recommendGasLimit, setRecommendGasLimit] = useState<string>('');
  const [gasUsed, setGasUsed] = useState(0);
  const [recommendGasLimitRatio, setRecommendGasLimitRatio] = useState(1); // 1 / 1.5 / 2
  const [recommendNonce, setRecommendNonce] = useState<string>('');
  const [updateId, setUpdateId] = useState(0);
  const [txDetail, setTxDetail] = useState<ExplainTxResponse | null>({
    pre_exec_version: 'v0',
    balance_change: {
      receive_nft_list: [],
      receive_token_list: [],
      send_nft_list: [],
      send_token_list: [],
      success: true,
      usd_value_change: 0,
    },
    trace_id: '',
    native_token: {
      amount: 0,
      chain: '',
      decimals: 18,
      display_symbol: '',
      id: '1',
      is_core: true,
      is_verified: true,
      is_wallet: true,
      is_infinity: true,
      logo_url: '',
      name: '',
      optimized_symbol: '',
      price: 0,
      symbol: '',
      time_at: 0,
      usd_value: 0,
    },
    gas: {
      gas_used: 0,
      gas_limit: 0,
      estimated_gas_cost_usd_value: 0,
      estimated_gas_cost_value: 0,
      estimated_gas_used: 0,
      estimated_seconds: 0,
    },
    pre_exec: {
      success: true,
      error: null,
      // err_msg: '',
    },
    recommend: {
      gas: '',
      nonce: '',
    },
    support_balance_change: true,
    type_call: {
      action: '',
      contract: '',
      contract_protocol_logo_url: '',
      contract_protocol_name: '',
    },
  });
  const [actionData, setActionData] = useState<ParsedActionData>({});
  const [actionRequireData, setActionRequireData] =
    useState<ActionRequireData>(null);
  const { t } = useTranslation();
  const [preprocessSuccess, setPreprocessSuccess] = useState(true);
  const [chainId, setChainId] = useState<number>(
    params.data[0].chainId && Number(params.data[0].chainId),
  );
  const [chain, setChain] = useState(
    Object.values(CHAINS).find(item => item.id === chainId),
  );
  const [inited, setInited] = useState(false);
  const [isHardware, setIsHardware] = useState(false);
  const [manuallyChangeGasLimit, setManuallyChangeGasLimit] = useState(false);
  const [selectedGas, setSelectedGas] = useState<GasLevel | null>(null);
  const [gasList, setGasList] = useState<GasLevel[]>([
    {
      level: 'slow',
      front_tx_count: 0,
      price: 0,
      estimated_seconds: 0,
      base_fee: 0,
      priority_price: null,
    },
    {
      level: 'normal',
      front_tx_count: 0,
      price: 0,
      estimated_seconds: 0,
      base_fee: 0,
      priority_price: null,
    },
    {
      level: 'fast',
      front_tx_count: 0,
      price: 0,
      estimated_seconds: 0,
      base_fee: 0,
      priority_price: null,
    },
    {
      level: 'custom',
      price: 0,
      front_tx_count: 0,
      estimated_seconds: 0,
      base_fee: 0,
      priority_price: null,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // const scrollRefSize = useSize(scrollRef);
  // const scrollInfo = useScroll(scrollRef);
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  if (!chain) throw new Error('No support chain found');
  const [support1559, setSupport1559] = useState(chain.eip['1559']);
  const [footerShowShadow, setFooterShowShadow] = useState(false);
  const { userData, rules, currentTx, ...apiApprovalSecurityEngine } =
    useApprovalSecurityEngine();

  // useSignPermissionCheck({
  //   origin,
  //   chainId,
  //   onDisconnect: () => {
  //     handleCancel();
  //   },
  //   onOk: () => {
  //     handleCancel();
  //   },
  // });

  // useTestnetCheck({
  //   chainId,
  //   onOk: () => {
  //     handleCancel();
  //   },
  // });

  const {
    data = '0x',
    from,
    gas,
    gasPrice,
    nonce,
    to,
    value,
    maxFeePerGas,
    isSpeedUp,
    isCancel,
    isSend,
    isSwap,
    swapPreferMEVGuarded,
    isViewGnosisSafe,
    reqId,
    safeTxGas,
  } = normalizeTxParams(params.data[0]);

  const [pushInfo, setPushInfo] = useState<{
    type: TxPushType;
    lowGasDeadline?: number;
  }>({
    type: swapPreferMEVGuarded ? 'mev' : 'default',
  });

  let updateNonce = true;
  if (isCancel || isSpeedUp || (nonce && from === to) || nonceChanged)
    updateNonce = false;

  const getGasPrice = () => {
    let result = '';
    if (maxFeePerGas) {
      result = isHexString(maxFeePerGas)
        ? maxFeePerGas
        : intToHex(maxFeePerGas);
    }
    if (gasPrice) {
      result = isHexString(gasPrice) ? gasPrice : intToHex(parseInt(gasPrice));
    }
    if (Number.isNaN(Number(result))) {
      result = '';
    }
    return result;
  };
  const [tx, setTx] = useState<Tx>({
    chainId,
    data: data || '0x', // can not execute with empty string, use 0x instead
    from,
    gas: gas || params.data[0].gasLimit,
    gasPrice: getGasPrice(),
    nonce,
    to,
    value,
  });
  const [realNonce, setRealNonce] = useState('');
  const [gasLimit, setGasLimit] = useState<string | undefined>(undefined);
  // const [safeInfo, setSafeInfo] = useState<BasicSafeInfo | null>(null);
  const [maxPriorityFee, setMaxPriorityFee] = useState(0);
  const [nativeTokenBalance, setNativeTokenBalance] = useState('0x0');
  const { executeEngine } = useSecurityEngine();
  const [engineResults, setEngineResults] = useState<Result[]>([]);
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

  const isGasTopUp = tx.to?.toLowerCase() === GAS_TOP_UP_ADDRESS.toLowerCase();

  const gasExplainResponse = useExplainGas({
    gasUsed,
    gasPrice: selectedGas?.price || 0,
    chainId,
    nativeTokenPrice: txDetail?.native_token.price || 0,
    tx,
    gasLimit,
  });

  const checkErrors = useCheckGasAndNonce({
    recommendGasLimit,
    recommendNonce,
    gasLimit: Number(gasLimit),
    nonce: Number(realNonce || tx.nonce),
    gasExplainResponse,
    isSpeedUp,
    isCancel,
    tx,
    isGnosisAccount: false,
    nativeTokenBalance,
    recommendGasLimitRatio,
  });

  const explainTx = async (address: string) => {
    let recommendNonce = '0x0';
    recommendNonce = await getRecommendNonce({
      tx,
      chainId,
    });
    setRecommendNonce(recommendNonce);
    if (updateNonce) {
      setRealNonce(recommendNonce);
    } // do not overwrite nonce if from === to(cancel transaction)
    const { pendings } = await transactionHistoryService.getList(address);
    const preExecPromise = openapi
      .preExecTx({
        tx: {
          ...tx,
          nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1', // set a mock nonce for explain if dapp not set it
          data: tx.data,
          value: tx.value || '0x0',
          gas: tx.gas || '', // set gas limit if dapp not set
        },
        origin: origin || '',
        address,
        updateNonce,
        pending_tx_list: pendings
          .filter(item =>
            new BigNumber(item.nonce).lt(
              updateNonce ? recommendNonce : tx.nonce,
            ),
          )
          .reduce((result, item) => {
            return result.concat(item.txs.map(tx => tx.rawTx));
          }, [] as Tx[])
          .map(item => ({
            from: item.from,
            to: item.to,
            chainId: item.chainId,
            data: item.data || '0x',
            nonce: item.nonce,
            value: item.value,
            gasPrice: `0x${new BigNumber(
              item.gasPrice || item.maxFeePerGas || 0,
            ).toString(16)}`,
            gas: item.gas || item.gasLimit || '0x0',
          })),
      })
      .then(async res => {
        let estimateGas = 0;
        if (res.gas.success) {
          estimateGas = res.gas.gas_limit || res.gas.gas_used;
        }
        const { gas, needRatio, gasUsed } = await getRecommendGas({
          gasUsed: res.gas.gas_used,
          gas: estimateGas,
          tx,
          chainId,
        });
        setGasUsed(gasUsed);
        setRecommendGasLimit(`0x${gas.toString(16)}`);
        let block = null;
        try {
          block = await apiProvider.requestETHRpc(
            {
              method: 'eth_getBlockByNumber',
              params: ['latest', false],
            },
            chain.serverId,
          );
          setBlockInfo(block);
        } catch (e) {
          // DO NOTHING
        }
        if (tx.gas && origin === INTERNAL_REQUEST_ORIGIN) {
          setGasLimit(intToHex(Number(tx.gas))); // use origin gas as gasLimit when tx is an internal tx with gasLimit(i.e. for SendMax native token)
          reCalcGasLimitBaseAccountBalance({
            nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1',
            tx: {
              ...tx,
              nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1', // set a mock nonce for explain if dapp not set it
              data: tx.data,
              value: tx.value || '0x0',
              gas: tx.gas || '', // set gas limit if dapp not set
            },
            gasPrice: selectedGas?.price || 0,
            customRecommendGasLimit: gas.toNumber(),
            customGasLimit: Number(tx.gas),
            customRecommendGasLimitRatio: 1,
            block,
          });
        } else if (!gasLimit) {
          // use server response gas limit
          const ratio =
            SAFE_GAS_LIMIT_RATIO[chainId] || DEFAULT_GAS_LIMIT_RATIO;
          setRecommendGasLimitRatio(needRatio ? ratio : 1);
          const recommendGasLimit = needRatio
            ? gas.times(ratio).toFixed(0)
            : gas.toFixed(0);
          setGasLimit(intToHex(Number(recommendGasLimit)));
          reCalcGasLimitBaseAccountBalance({
            nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1',
            tx: {
              ...tx,
              nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1', // set a mock nonce for explain if dapp not set it
              data: tx.data,
              value: tx.value || '0x0',
              gas: tx.gas || '', // set gas limit if dapp not set
            },
            gasPrice: selectedGas?.price || 0,
            customRecommendGasLimit: gas.toNumber(),
            customGasLimit: Number(recommendGasLimit),
            customRecommendGasLimitRatio: needRatio ? ratio : 1,
            block,
          });
        }
        setTxDetail(res);

        setPreprocessSuccess(res.pre_exec.success);
        return res;
      });

    return openapi
      .parseTx({
        chainId: chain.serverId,
        tx: {
          ...tx,
          gas: '0x0',
          nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1',
          value: tx.value || '0x0',
          // todo
          to: tx.to || '',
        },
        origin: origin || '',
        addr: address,
      })
      .then(async actionData => {
        return preExecPromise.then(async res => {
          const parsed = parseAction(
            actionData.action,
            res.balance_change,
            {
              ...tx,
              gas: '0x0',
              nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1',
              value: tx.value || '0x0',
            },
            res.pre_exec_version,
            res.gas.gas_used,
          );
          const requiredData = await fetchActionRequiredData({
            actionData: parsed,
            contractCall: actionData.contract_call,
            chainId: chain.serverId,
            address,
            tx: {
              ...tx,
              gas: '0x0',
              nonce: (updateNonce ? recommendNonce : tx.nonce) || '0x1',
              value: tx.value || '0x0',
            },
          });
          const ctx = formatSecurityEngineCtx({
            actionData: parsed,
            requireData: requiredData,
            chainId: chain.serverId,
          });
          const result = await executeEngine(ctx);
          setEngineResults(result);
          setActionData(parsed);
          setActionRequireData(requiredData);
          const approval = (await getApproval())!;

          approval.signingTxId &&
            (await transactionHistoryService.updateSigningTx(
              approval.signingTxId,
              {
                rawTx: {
                  nonce: updateNonce ? recommendNonce : tx.nonce,
                },
                explain: {
                  ...res,
                  approvalId: approval.id,
                  calcSuccess: !(checkErrors.length > 0),
                },
                action: {
                  actionData: parsed,
                  requiredData,
                },
              },
            ));
        });
      });
  };

  const explain = async () => {
    const currentAccount = (await preferenceService.getCurrentAccount())!;
    try {
      setIsReady(false);
      await explainTx(currentAccount.address);
      setIsReady(true);
    } catch (e: any) {
      toast.show(e.message || JSON.stringify(e));
    }
  };

  const { activeApprovalPopup } = useCommonPopupView();
  const handleAllow = async () => {
    if (!selectedGas) return;

    if (activeApprovalPopup()) {
      return;
    }

    const currentAccount = (await preferenceService.getCurrentAccount())!;

    try {
      validateGasPriceRange(tx);
    } catch (e: any) {
      toast.show(e.message || JSON.stringify(e));
      return;
    }

    const selected: ChainGas = {
      lastTimeSelect: selectedGas.level === 'custom' ? 'gasPrice' : 'gasLevel',
    };
    if (selectedGas.level === 'custom') {
      if (support1559) {
        selected.gasPrice = parseInt(tx.maxFeePerGas!);
      } else {
        selected.gasPrice = parseInt(tx.gasPrice!);
      }
    } else {
      selected.gasLevel = selectedGas.level;
    }
    if (!isSpeedUp && !isCancel && !isSwap) {
      await preferenceService.updateLastTimeGasSelection(chainId, selected);
    }
    const transaction: Tx = {
      from: tx.from,
      to: tx.to,
      data: tx.data,
      nonce: tx.nonce,
      value: tx.value,
      chainId: tx.chainId,
      gas: '',
    };
    if (support1559) {
      transaction.maxFeePerGas = tx.maxFeePerGas;
      transaction.maxPriorityFeePerGas =
        maxPriorityFee <= 0
          ? tx.maxFeePerGas
          : intToHex(Math.round(maxPriorityFee));
    } else {
      (transaction as Tx).gasPrice = tx.gasPrice;
    }
    const approval = (await getApproval())!;
    // gaEvent('allow');

    approval.signingTxId &&
      (await transactionHistoryService.updateSigningTx(approval.signingTxId, {
        rawTx: {
          nonce: realNonce || tx.nonce,
        },
        explain: {
          ...txDetail!,
          approvalId: approval.id,
          calcSuccess: !(checkErrors.length > 0),
        },
        action: {
          actionData,
          requiredData: actionRequireData,
        },
      }));

    if (currentAccount?.type && WaitingSignComponent[currentAccount.type]) {
      resolveApproval({
        ...transaction,
        isSend,
        nonce: realNonce || tx.nonce,
        gas: gasLimit,
        uiRequestComponent: WaitingSignComponent[currentAccount.type],
        type: currentAccount.type,
        address: currentAccount.address,
        traceId: txDetail?.trace_id,
        extra: {
          brandName: currentAccount.brandName,
        },
        $ctx: params.$ctx,
        signingTxId: approval.signingTxId,
        pushType: pushInfo.type,
        lowGasDeadline: pushInfo.lowGasDeadline,
        reqId,
      });

      return;
    }

    // await wallet.reportStats('signTransaction', {
    //   type: currentAccount.brandName,
    //   chainId: chain.serverId,
    //   category: KEYRING_CATEGORY_MAP[currentAccount.type],
    //   preExecSuccess:
    //     checkErrors.length > 0 || !txDetail?.pre_exec.success ? false : true,
    //   createBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
    //   source: params?.$ctx?.ga?.source || '',
    //   trigger: params?.$ctx?.ga?.trigger || '',
    // });

    // matomoRequestEvent({
    //   category: 'Transaction',
    //   action: 'Submit',
    //   label: currentAccount.brandName,
    // });
    resolveApproval({
      ...transaction,
      nonce: realNonce || tx.nonce,
      gas: gasLimit,
      isSend,
      traceId: txDetail?.trace_id,
      signingTxId: approval.signingTxId,
      pushType: pushInfo.type,
      lowGasDeadline: pushInfo.lowGasDeadline,
      reqId,
    });
  };

  const handleGasChange = (gas: GasSelectorResponse) => {
    setSelectedGas({
      level: gas.level,
      front_tx_count: gas.front_tx_count,
      estimated_seconds: gas.estimated_seconds,
      base_fee: gas.base_fee,
      price: Math.round(gas.price),
      priority_price: gas.priority_price,
    });
    if (gas.level === 'custom') {
      setGasList(
        gasList.map(item => {
          if (item.level === 'custom') return gas;
          return item;
        }),
      );
    }
    const beforeNonce = realNonce || tx.nonce;
    const afterNonce = intToHex(gas.nonce);
    if (support1559) {
      setTx({
        ...tx,
        maxFeePerGas: intToHex(Math.round(gas.price)),
        gas: intToHex(gas.gasLimit),
        nonce: afterNonce,
      });
      setMaxPriorityFee(Math.round(gas.maxPriorityFee));
    } else {
      setTx({
        ...tx,
        gasPrice: intToHex(Math.round(gas.price)),
        gas: intToHex(gas.gasLimit),
        nonce: afterNonce,
      });
    }
    setGasLimit(intToHex(gas.gasLimit));
    if (Number(gasLimit) !== gas.gasLimit) {
      setManuallyChangeGasLimit(true);
    } else {
      reCalcGasLimitBaseAccountBalance({
        gasPrice: gas.price,
        tx: {
          ...tx,
          gasPrice: intToHex(Math.round(gas.price)),
          gas: intToHex(gas.gasLimit),
          nonce: afterNonce,
        },
        nonce: afterNonce,
        block: blockInfo,
      });
    }
    setRealNonce(afterNonce);

    if (beforeNonce !== afterNonce) {
      setNonceChanged(true);
    }
  };

  const handleCancel = () => {
    // gaEvent('cancel');
    rejectApproval('User rejected the request.');
  };

  const handleTxChange = (obj: Record<string, any>) => {
    setTx({
      ...tx,
      ...obj,
    });
    // trigger explain
    setUpdateId(id => id + 1);
  };

  const loadGasMarket = async (
    chain: Chain,
    custom?: number,
  ): Promise<GasLevel[]> => {
    const list = await openapi.gasMarket(
      chain.serverId,
      custom && custom > 0 ? custom : undefined,
    );
    setGasList(list);
    return list;
  };

  const loadGasMedian = async (chain: Chain) => {
    const { median } = await openapi.gasPriceStats(chain.serverId);
    setGasPriceMedian(median);
    return median;
  };

  const checkCanProcess = async () => {
    const session = params.session;
    const currentAccount = (await preferenceService.getCurrentAccount())!;
    const site = await dappService.getDapp(session.origin);

    if (currentAccount.type === KEYRING_TYPE.WatchAddressKeyring) {
      setCanProcess(false);
      setCantProcessReason(t('page.signTx.canOnlyUseImportedAddress'));
    }
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

  const init = async () => {
    apiApprovalSecurityEngine.resetCurrentTx();
    try {
      const currentAccount = (await preferenceService.getCurrentAccount())!;
      const is1559 =
        support1559 &&
        SUPPORT_1559_KEYRING_TYPE.includes(currentAccount.type as any);
      setIsHardware(
        // !!Object.values(HARDWARE_KEYRING_TYPES).find(
        //   item => item.type === currentAccount.type,
        // ),
        false,
      );
      const balance = await getNativeTokenBalance({
        chainId,
        address: currentAccount.address,
      });

      setNativeTokenBalance(balance);

      // wallet.reportStats('createTransaction', {
      //   type: currentAccount.brandName,
      //   category: KEYRING_CATEGORY_MAP[currentAccount.type],
      //   chainId: chain.serverId,
      //   createBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
      //   source: params?.$ctx?.ga?.source || '',
      //   trigger: params?.$ctx?.ga?.trigger || '',
      // });

      // matomoRequestEvent({
      //   category: 'Transaction',
      //   action: 'init',
      //   label: currentAccount.brandName,
      // });

      checkCanProcess();
      const lastTimeGas: ChainGas | null =
        await preferenceService.getLastTimeGasSelection(chainId);
      let customGasPrice = 0;
      if (lastTimeGas?.lastTimeSelect === 'gasPrice' && lastTimeGas.gasPrice) {
        // use cached gasPrice if exist
        customGasPrice = lastTimeGas.gasPrice;
      }
      if (isSpeedUp || isCancel || ((isSend || isSwap) && tx.gasPrice)) {
        // use gasPrice set by dapp when it's a speedup or cancel tx
        customGasPrice = parseInt(tx.gasPrice!);
      }
      const gasList = await loadGasMarket(chain, customGasPrice);
      loadGasMedian(chain);
      let gas: GasLevel | null = null;

      if (
        ((isSend || isSwap) && customGasPrice) ||
        isSpeedUp ||
        isCancel ||
        lastTimeGas?.lastTimeSelect === 'gasPrice'
      ) {
        gas = gasList.find(item => item.level === 'custom')!;
      } else if (
        lastTimeGas?.lastTimeSelect &&
        lastTimeGas?.lastTimeSelect === 'gasLevel'
      ) {
        const target = gasList.find(
          item => item.level === lastTimeGas?.gasLevel,
        )!;
        if (target) {
          gas = target;
        } else {
          gas = gasList.find(item => item.level === 'normal')!;
        }
      } else {
        // no cache, use the fast level in gasMarket
        gas = gasList.find(item => item.level === 'normal')!;
      }
      const fee = calcMaxPriorityFee(
        gasList,
        gas,
        chainId,
        isCancel || isSpeedUp,
      );
      setMaxPriorityFee(fee);

      setSelectedGas(gas);
      setSupport1559(is1559);
      if (is1559) {
        setTx(
          convertLegacyTo1559({
            ...tx,
            gasPrice: intToHex(gas.price),
          }),
        );
      } else {
        setTx({
          ...tx,
          gasPrice: intToHex(gas.price),
        });
      }
      setInited(true);
    } catch (e: any) {
      toast.show(e.message || JSON.stringify(e));
    }
  };

  const reCalcGasLimitBaseAccountBalance = async ({
    gasPrice,
    nonce,
    tx,
    customRecommendGasLimit,
    customGasLimit,
    customRecommendGasLimitRatio,
    block,
  }: {
    tx: Tx;
    nonce: number | string | BigNumber;
    gasPrice: number | string | BigNumber;
    customRecommendGasLimit?: number;
    customGasLimit?: number;
    customRecommendGasLimitRatio?: number;
    block: BlockInfo | null;
  }) => {
    const calcGasLimit = customGasLimit || gasLimit;
    const calcGasLimitRatio =
      customRecommendGasLimitRatio || recommendGasLimitRatio;
    const calcRecommendGasLimit = customRecommendGasLimit || recommendGasLimit;
    if (!calcGasLimit) return;
    const currentAccount = (await preferenceService.getCurrentAccount())!;
    const { pendings } = await transactionHistoryService.getList(
      currentAccount.address,
    );
    let res = getGasLimitBaseAccountBalance({
      gasPrice,
      nonce,
      pendingList: pendings.filter(item => item.chainId === chainId),
      nativeTokenBalance,
      tx,
      recommendGasLimit: calcRecommendGasLimit,
      recommendGasLimitRatio: calcGasLimitRatio,
    });

    if (block && res > Number(block.gasLimit)) {
      res = Math.floor(Number(block.gasLimit) * 0.95); // use 95% of block gasLimit when gasLimit greater than block gasLimit
    }
    if (!new BigNumber(res).eq(calcGasLimit)) {
      setGasLimit(`0x${new BigNumber(res).toNumber().toString(16)}`);
      setManuallyChangeGasLimit(false);
    }
  };

  const executeSecurityEngine = async () => {
    const ctx = formatSecurityEngineCtx({
      actionData: actionData,
      requireData: actionRequireData,
      chainId: chain.serverId,
    });
    const result = await executeEngine(ctx);
    setEngineResults(result);
  };

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

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useEffect(() => {
  //   if (isReady) {
  //     if (scrollRef.current && scrollRef.current.scrollTop > 0) {
  //       scrollRef.current && (scrollRef.current.scrollTop = 0);
  //     }
  //   }
  // }, [isReady]);

  useEffect(() => {
    if (!inited) return;
    explain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inited, updateId]);

  useEffect(() => {
    executeSecurityEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, rules]);

  // TODO
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

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <BottomSheetView style={styles.wrapper}>
      <ScrollView style={styles.approvalTx}>
        {txDetail && (
          <View>
            {txDetail && (
              <TxTypeComponent
                isReady={isReady}
                actionData={actionData}
                actionRequireData={actionRequireData}
                chain={chain}
                txDetail={txDetail}
                raw={{
                  ...tx,
                  nonce: realNonce || tx.nonce,
                  gas: gasLimit!,
                }}
                onChange={handleTxChange}
                isSpeedUp={isSpeedUp}
                engineResults={engineResults}
              />
            )}
            <GasSelector
              disabled={false}
              isReady={isReady}
              gasLimit={gasLimit}
              noUpdate={isCancel || isSpeedUp}
              gasList={gasList}
              selectedGas={selectedGas}
              version={txDetail.pre_exec_version}
              gas={{
                error: txDetail.gas.error,
                success: txDetail.gas.success,
                gasCostUsd: gasExplainResponse.gasCostUsd,
                gasCostAmount: gasExplainResponse.gasCostAmount,
              }}
              gasCalcMethod={price => {
                return explainGas({
                  gasUsed,
                  gasPrice: price,
                  chainId,
                  nativeTokenPrice: txDetail?.native_token.price || 0,
                  tx,
                  gasLimit,
                });
              }}
              recommendGasLimit={recommendGasLimit}
              recommendNonce={recommendNonce}
              chainId={chainId}
              onChange={handleGasChange}
              nonce={realNonce || tx.nonce}
              disableNonce={isSpeedUp || isCancel}
              isSpeedUp={isSpeedUp}
              isCancel={isCancel}
              is1559={support1559}
              isHardware={isHardware}
              manuallyChangeGasLimit={manuallyChangeGasLimit}
              errors={checkErrors}
              engineResults={engineResults}
              nativeTokenBalance={nativeTokenBalance}
              gasPriceMedian={gasPriceMedian}
            />
          </View>
        )}
        {/* <BroadcastMode
          // eslint-disable-next-line react-native/no-inline-styles
          style={{
            marginTop: 12,
          }}
          chain={chain.enum}
          value={pushInfo}
          isCancel={isCancel}
          isSpeedUp={isSpeedUp}
          isGasTopUp={isGasTopUp}
          onChange={value => {
            setPushInfo(value);
          }}
        /> */}

        <RuleDrawer
          selectRule={currentTx.ruleDrawer.selectRule}
          visible={currentTx.ruleDrawer.visible}
          onIgnore={handleIgnoreRule}
          onUndo={handleUndoIgnore}
          onRuleEnableStatusChange={handleRuleEnableStatusChange}
          onClose={handleRuleDrawerClose}
        />
        <View style={styles.placeholder} />
      </ScrollView>
      {txDetail && (
        <FooterBar
          hasShadow={footerShowShadow}
          origin={origin}
          originLogo={params.session.icon}
          hasUnProcessSecurityResult={hasUnProcessSecurityResult}
          securityLevel={securityLevel}
          gnosisAccount={undefined}
          chain={chain}
          isTestnet={chain.isTestnet}
          onCancel={handleCancel}
          onSubmit={() => handleAllow()}
          onIgnoreAllRules={handleIgnoreAllRules}
          enableTooltip={
            !canProcess ||
            !!checkErrors.find(item => item.level === 'forbidden')
          }
          tooltipContent={
            checkErrors.find(item => item.level === 'forbidden')
              ? checkErrors.find(item => item.level === 'forbidden')!.msg
              : cantProcessReason
          }
          disabledProcess={
            !isReady ||
            (selectedGas ? selectedGas.price < 0 : true) ||
            !canProcess ||
            !!checkErrors.find(item => item.level === 'forbidden') ||
            hasUnProcessSecurityResult
          }
        />
      )}
      {/* TODO */}
      {/* <TokenDetailPopup
        token={tokenDetail.selectToken}
        visible={tokenDetail.popupVisible}
        onClose={() => dispatch.sign.closeTokenDetailPopup()}
        canClickToken={false}
        hideOperationButtons
        variant="add"
      /> */}
    </BottomSheetView>
  );
};
