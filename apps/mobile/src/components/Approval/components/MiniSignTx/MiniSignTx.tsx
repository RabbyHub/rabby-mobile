import { AppBottomSheetModal } from '@/components';
import { toast } from '@/components/Toast';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { Chain } from '@/constant/chains';
import { SUPPORT_1559_KEYRING_TYPE } from '@/constant/tx';
import { apisSafe } from '@/core/apis/safe';
import { openapi } from '@/core/request';
import { preferenceService } from '@/core/services';
import { Account, ChainGas } from '@/core/services/preference';
import { useCurrentAccount } from '@/hooks/account';
import { useSecurityEngine } from '@/hooks/securityEngine';
import { useThemeColors } from '@/hooks/theme';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { useFindChain } from '@/hooks/useFindChain';
import { useSheetModal } from '@/hooks/useSheetModal';
import { matomoRequestEvent } from '@/utils/analytics';
import { intToHex } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import {
  calcGasLimit,
  calcMaxPriorityFee,
  checkGasAndNonce,
  convertLegacyTo1559,
  getPendingTxs,
} from '@/utils/transaction';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  ExplainTxResponse,
  GasLevel,
  Tx,
  TxPushType,
} from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import { isHexString } from 'ethereumjs-util';
import _ from 'lodash';
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import {
  ActionRequireData,
  ParsedActionData,
  formatSecurityEngineCtx,
} from '../Actions/utils';
import { GasLessConfig } from '../FooterBar/GasLessComponents';
import {
  explainGas,
  getNativeTokenBalance,
  getRecommendGas,
  getRecommendNonce,
} from '../SignTx/calc';
import { normalizeTxParams } from '../SignTx/util';
import {
  GasSelectorHeader,
  GasSelectorResponse,
} from '../TxComponents/GasSelector/GasSelectorHeader';
import { MiniFooterBar } from './MiniFooterBar';
import { MiniWaiting } from './MiniWaiting';
import { getStyles } from './style';
import { useBatchSignTxTask } from './useBatchSignTxTask';

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

const MiniSignTx = ({
  txs,
  onReject,
  onResolve,
  onSubmit,
}: {
  txs: Tx[];
  onReject?: () => void;
  onResolve?: () => void;
  onSubmit?: () => void;
}) => {
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
      gas_ratio: 0,
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

  const chainId = txs[0].chainId;
  const chain = useFindChain({
    id: chainId,
  });
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

  const [currentAccountType, setCurrentAccountType] = useState<
    undefined | string
  >();
  const [gasLessLoading, setGasLessLoading] = useState(false);
  const [canUseGasLess, setCanUseGasLess] = useState(false);
  const [useGasLess, setUseGasLess] = useState(false);

  const [isGnosisAccount, setIsGnosisAccount] = useState(false);
  const [gasLessFailedReason, setGasLessFailedReason] = useState<
    string | undefined
  >(undefined);

  // const [isGnosisAccount, setIsGnosisAccount] = useState(false);
  // const [isCoboArugsAccount, setIsCoboArugsAccount] = useState(false);
  const isCoboArugsAccount = false;
  const [drawerVisible, setDrawerVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // const scrollRefSize = useSize(scrollRef);
  // const scrollInfo = useScroll(scrollRef);
  if (!chain) throw new Error('No support chain found');
  const [support1559, setSupport1559] = useState(chain.eip['1559']);
  const [footerShowShadow, setFooterShowShadow] = useState(false);
  const { userData, rules, currentTx, ...apiApprovalSecurityEngine } =
    useApprovalSecurityEngine();

  const [txsResult, setTxsResult] = useState<
    {
      tx: Tx;
      preExecResult: ExplainTxResponse;
      gasUsed: number;
      gasLimit: string;
      recommendGasLimitRatio: number;
      gasCost: Awaited<ReturnType<typeof explainGas>>;
    }[]
  >([]);

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
  } = normalizeTxParams(txs[0]);

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
  // const [tx, setTx] = useState<Tx>({
  //   chainId,
  //   data: data || '0x', // can not execute with empty string, use 0x instead
  //   from,
  //   // gas: gas || params.data[0].gasLimit,
  //   gasPrice: getGasPrice(),
  //   nonce,
  //   to,
  //   value,
  // });
  const [realNonce, setRealNonce] = useState('');
  const [gasLimit, setGasLimit] = useState<string | undefined>(undefined);
  const [safeInfo, setSafeInfo] = useState<BasicSafeInfo | null>(null);
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

  const checkErrors = useMemo(() => {
    let balance = nativeTokenBalance;
    const res = txsResult.map((item, index) => {
      const result = checkGasAndNonce({
        recommendGasLimitRatio: item.recommendGasLimitRatio,
        recommendGasLimit: item.gasLimit,
        recommendNonce: item.tx.nonce,
        tx: item.tx,
        gasLimit: item.gasLimit,
        nonce: item.tx.nonce,
        isCancel: false,
        gasExplainResponse: item.gasCost,
        isSpeedUp: false,
        isGnosisAccount: false,
        nativeTokenBalance: balance,
      });
      balance = new BigNumber(balance)
        .minus(new BigNumber(item.tx.value || 0))
        .minus(new BigNumber(item.gasCost.maxGasCostAmount || 0))
        .toString();
      return result;
    });
    return _.flatten(res);
  }, [txsResult, nativeTokenBalance]);

  const totalGasCost = useMemo(() => {
    return txsResult.reduce(
      (sum, item) => {
        sum.gasCostAmount = sum.gasCostAmount.plus(item.gasCost.gasCostAmount);
        sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCost.gasCostUsd);
        return sum;
      },
      {
        gasCostUsd: new BigNumber(0),
        gasCostAmount: new BigNumber(0),
        success: true,
      },
    );
  }, [txsResult]);

  const isGasNotEnough = useMemo(() => {
    return checkErrors.some(e => e.code === 3001);
  }, [checkErrors]);

  const isSupportedAddr = useMemo(() => {
    const isNotWalletConnect =
      currentAccountType !== KEYRING_TYPE.WalletConnectKeyring;
    const isNotWatchAddress =
      currentAccountType !== KEYRING_TYPE.WatchAddressKeyring;

    if (!isNotWalletConnect) {
      setGasLessFailedReason(
        t('page.signFooterBar.gasless.walletConnectUnavailableTip'),
      );
    }

    if (!isNotWatchAddress) {
      setGasLessFailedReason(
        t('page.signFooterBar.gasless.watchUnavailableTip'),
      );
    }

    return isNotWatchAddress && isNotWalletConnect;
  }, [currentAccountType, t]);

  const [noCustomRPC, setNoCustomRPC] = useState(true);

  // useEffect(() => {
  //   const hasCustomRPC = async () => {
  //     if (chain?.enum) {
  //       const b = await wallet.hasCustomRPC(chain?.enum);
  // if (b) {
  //   setGasLessFailedReason(
  //     t('page.signFooterBar.gasless.customRpcUnavailableTip')
  //   );
  // }
  //       setNoCustomRPC(!b);
  //     }
  //   };
  //   hasCustomRPC();
  // }, [chain?.enum]);
  const [gasLessConfig, setGasLessConfig] = useState<GasLessConfig | undefined>(
    undefined,
  );
  const { activeApprovalPopup } = useCommonPopupView();
  const invokeEnterPassphrase = useEnterPassphraseModal('address');
  const task = useBatchSignTxTask();

  const handleInitTask = useMemoizedFn(() => {
    task.init(
      txsResult.map(item => {
        return {
          tx: item.tx,
          options: {
            chainServerId: chain.serverId,
            gasLevel: selectedGas || undefined,
            isGasLess: useGasLess,
            waitCompleted: false,
            pushType: pushInfo.type,
            ignoreGasCheck: true,
            ignoreGasNotEnoughCheck: true,
          },
          status: 'idle',
        };
      }),
    );
  });

  useEffect(() => {
    handleInitTask();
  }, [
    txsResult,
    chain.serverId,
    selectedGas,
    useGasLess,
    pushInfo.type,
    handleInitTask,
  ]);

  const handleAllow = useMemoizedFn(async () => {
    if (!txsResult?.length || !selectedGas) {
      return;
    }
    await task.start();
    onResolve?.();
  });

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
        (gasList || []).map(item => {
          if (item.level === 'custom') return gas;
          return item;
        }),
      );
    }
    Promise.all(
      txsResult.map(async item => {
        const tx = {
          ...item.tx,
          ...(support1559
            ? {
                maxFeePerGas: intToHex(Math.round(gas.price)),
                maxPriorityFeePerGas:
                  gas.maxPriorityFee <= 0
                    ? item.tx.maxFeePerGas
                    : intToHex(Math.round(gas.maxPriorityFee)),
              }
            : { gasPrice: intToHex(Math.round(gas.price)) }),
        };
        return {
          ...item,
          tx,
          gasCost: await explainGas({
            gasUsed: item.gasUsed,
            gasPrice: gas.price,
            chainId: chain.id,
            nativeTokenPrice: item.preExecResult.native_token.price,
            tx,
            gasLimit: item.gasLimit,
          }),
        };
      }),
    ).then(res => {
      setTxsResult(res);
    });

    setGasLimit(intToHex(gas.gasLimit));
    if (Number(gasLimit) !== gas.gasLimit) {
      setManuallyChangeGasLimit(true);
    }
  };

  const handleCancel = () => {
    onReject?.();
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
    const currentAccount = (await preferenceService.getCurrentAccount())!;

    if (currentAccount.type === KEYRING_TYPE.WatchAddressKeyring) {
      setCanProcess(false);
      setCantProcessReason(t('page.signTx.canOnlyUseImportedAddress'));
    }
  };

  const checkGasLessStatus = useMemoizedFn(async () => {
    if (!selectedGas || !txsResult?.length) {
      return;
    }
    try {
      setGasLessLoading(true);
      const res = await openapi.gasLessTxsCheck({
        tx_list:
          txsResult.map((item, index) => {
            return {
              ...item.tx,
              gas: item.gasLimit,
              gasPrice: intToHex(selectedGas.price),
            };
          }) || [],
      });
      setCanUseGasLess(res.is_gasless);
      setGasLessFailedReason(res.desc);
      setGasLessLoading(false);
      if (res.is_gasless && res?.promotion?.config) {
        setGasLessConfig(res?.promotion?.config);
      }
    } catch (error) {
      console.error('gasLessTxCheck error', error);
      setCanUseGasLess(false);
      setGasLessConfig(undefined);
      setGasLessLoading(false);
    }
  });

  const handleIgnoreAllRules = () => {
    apiApprovalSecurityEngine.processAllRules(
      engineResults.map(result => result.id),
    );
  };

  const init = async () => {
    if (!chainId) {
      return;
    }
    try {
      const currentAccount = (await preferenceService.getCurrentAccount())!;

      setCurrentAccountType(currentAccount.type);

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

      // stats.report('createTransaction', {
      //   type: currentAccount.brandName,
      //   category: KEYRING_CATEGORY_MAP[currentAccount.type],
      //   chainId: chain.serverId,
      //   createBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
      //   source: params?.$ctx?.ga?.source || '',
      //   trigger: params?.$ctx?.ga?.trigger || '',
      // });

      matomoRequestEvent({
        category: 'Transaction',
        action: 'init',
        label: currentAccount.brandName,
      });

      checkCanProcess();
      const lastTimeGas: ChainGas | null =
        await preferenceService.getLastTimeGasSelection(chainId);
      let customGasPrice = 0;
      if (lastTimeGas?.lastTimeSelect === 'gasPrice' && lastTimeGas.gasPrice) {
        // use cached gasPrice if exist
        customGasPrice = lastTimeGas.gasPrice;
      }
      if (isSpeedUp || isCancel || ((isSend || isSwap) && txs[0].gasPrice)) {
        // use gasPrice set by dapp when it's a speedup or cancel tx
        customGasPrice = parseInt(txs[0].gasPrice!);
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
      setInited(true);
    } catch (e: any) {
      toast.show(e.message || JSON.stringify(e));
    }
  };

  const handleIsGnosisAccountChange = useMemoizedFn(async () => {
    if (!isViewGnosisSafe) {
      await apisSafe.clearGnosisTransaction();
    }
  });

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

  const { currentAccount } = useCurrentAccount();

  const prepareTxs = useMemoizedFn(async () => {
    if (!selectedGas || !inited || !currentAccount?.address) {
      return;
    }

    const recommendNonce = await getRecommendNonce({
      tx: txs[0],
      chainId: chain.id,
    });
    setRecommendNonce(recommendNonce);

    const tempTxs: Tx[] = [];
    const res = await Promise.all(
      txs.map(async (rawTx, index) => {
        const normalizedTx = normalizeTxParams(rawTx);
        let tx: Tx = {
          chainId,
          data: normalizedTx.data || '0x', // can not execute with empty string, use 0x instead
          from: normalizedTx.from,
          gas: normalizedTx.gas || rawTx.gasLimit,
          nonce:
            normalizedTx.nonce ||
            intToHex(new BigNumber(recommendNonce).plus(index).toNumber()),
          to: normalizedTx.to,
          value: normalizedTx.value,
          gasPrice: intToHex(selectedGas.price),
        };
        tempTxs.push(tx);

        if (support1559) {
          tx = convertLegacyTo1559(tx);
        }

        const preExecResult = await openapi.preExecTx({
          tx: tx,
          origin: INTERNAL_REQUEST_SESSION.origin,
          address: currentAccount?.address,
          updateNonce: true,
          pending_tx_list: [
            ...(await getPendingTxs({
              recommendNonce,
              address: currentAccount?.address,
            })),
            ...tempTxs.slice(0, index),
          ],
        });
        let estimateGas = 0;
        if (preExecResult.gas.success) {
          estimateGas =
            preExecResult.gas.gas_limit || preExecResult.gas.gas_used;
        }
        const {
          gas: gasRaw,
          needRatio,
          gasUsed,
        } = await getRecommendGas({
          gasUsed: preExecResult.gas.gas_used,
          gas: estimateGas,
          tx: tx,
          chainId: chain.id,
        });
        const gas = new BigNumber(gasRaw);

        let gasLimit = tx.gas || tx.gasLimit;
        let recommendGasLimitRatio = 1;

        if (!gasLimit) {
          const {
            gasLimit: _gasLimit,
            recommendGasLimitRatio: _recommendGasLimitRatio,
          } = await calcGasLimit({
            chain,
            tx,
            gas,
            selectedGas: selectedGas,
            nativeTokenBalance,
            explainTx: preExecResult,
            needRatio,
          });
          gasLimit = _gasLimit;
          recommendGasLimitRatio = _recommendGasLimitRatio;
        }

        // calc gasCost
        const gasCost = await explainGas({
          gasUsed,
          gasPrice: selectedGas?.price,
          chainId: chain.id,
          nativeTokenPrice: preExecResult.native_token.price,
          tx,
          gasLimit,
        });

        tx.gas = gasLimit;

        const actionData = await openapi.parseTx({
          chainId: chain.serverId,
          tx: {
            ...tx,
            gas: '0x0',
            nonce: tx.nonce || '0x1',
            value: tx.value || '0x0',
            to: tx.to || '',
          },
          origin: INTERNAL_REQUEST_SESSION.origin || '',
          addr: currentAccount.address,
        });

        return {
          rawTx,
          tx,
          preExecResult,
          gasUsed,
          gasLimit,
          recommendGasLimitRatio,
          gasCost,
          actionData,
        };
      }),
    );

    setIsReady(true);
    setTxsResult(res);
  });

  useEffect(() => {
    if (
      isReady &&
      txsResult.length &&
      !isGnosisAccount &&
      !isCoboArugsAccount
    ) {
      if (isSupportedAddr && noCustomRPC) {
        checkGasLessStatus();
      } else {
        setGasLessLoading(false);
      }
    }
  }, [
    isReady,
    nativeTokenBalance,
    gasLimit,
    txsResult,
    realNonce,
    isSupportedAddr,
    noCustomRPC,
    isGnosisAccount,
    isCoboArugsAccount,
    checkGasLessStatus,
  ]);

  useEffect(() => {
    if (inited) {
      prepareTxs();
    }
  }, [inited, prepareTxs, txs]);

  useEffect(() => {
    if (isGnosisAccount) {
      handleIsGnosisAccountChange();
    }
  }, [handleIsGnosisAccountChange, isGnosisAccount]);

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  console.log('task.error', task.error);

  return (
    <>
      <MiniWaiting
        visible={!!task.error}
        error={task.error}
        onCancel={onReject}
        onRetry={async () => {
          await task.retry();
          onResolve?.();
        }}
      />
      <MiniFooterBar
        task={task}
        Header={
          <GasSelectorHeader
            pushType={pushInfo.type}
            disabled={false}
            isReady={isReady}
            gasLimit={gasLimit}
            noUpdate={false}
            gasList={gasList}
            selectedGas={selectedGas}
            version={txsResult?.[0]?.preExecResult?.pre_exec_version || 'v0'}
            recommendGasLimit={recommendGasLimit}
            recommendNonce={recommendNonce}
            chainId={chainId}
            onChange={handleGasChange}
            nonce={realNonce}
            disableNonce={true}
            isSpeedUp={false}
            isCancel={false}
            is1559={support1559}
            isHardware={isHardware}
            manuallyChangeGasLimit={manuallyChangeGasLimit}
            errors={checkErrors}
            engineResults={engineResults}
            nativeTokenBalance={nativeTokenBalance}
            gasPriceMedian={gasPriceMedian}
            gas={totalGasCost}
            gasCalcMethod={async price => {
              const res = await Promise.all(
                txsResult.map(item =>
                  explainGas({
                    gasUsed: item.gasUsed,
                    gasPrice: price,
                    chainId,
                    nativeTokenPrice:
                      item.preExecResult.native_token.price || 0,
                    tx: item.tx,
                    gasLimit: item.gasLimit,
                  }),
                ),
              );
              const totalCost = res.reduce(
                (sum, item) => {
                  sum.gasCostAmount = sum.gasCostAmount.plus(
                    item.gasCostAmount,
                  );
                  sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCostUsd);
                  return sum;
                },
                {
                  gasCostUsd: new BigNumber(0),
                  gasCostAmount: new BigNumber(0),
                },
              );
              return totalCost;
            }}
          />
        }
        isWatchAddr={currentAccountType === KEYRING_TYPE.WatchAddressKeyring}
        gasLessConfig={gasLessConfig}
        gasLessFailedReason={gasLessFailedReason}
        canUseGasLess={canUseGasLess}
        showGasLess={
          !gasLessLoading && isReady && (isGasNotEnough || !!gasLessConfig)
        }
        useGasLess={
          (isGasNotEnough || !!gasLessConfig) && canUseGasLess && useGasLess
        }
        isGasNotEnough={isGasNotEnough}
        enableGasLess={() => setUseGasLess(true)}
        hasShadow={footerShowShadow}
        origin={INTERNAL_REQUEST_SESSION.origin}
        originLogo={INTERNAL_REQUEST_SESSION.icon}
        // hasUnProcessSecurityResult={hasUnProcessSecurityResult}
        securityLevel={securityLevel}
        gnosisAccount={undefined}
        chain={chain}
        isTestnet={chain.isTestnet}
        onCancel={handleCancel}
        onSubmit={() => handleAllow()}
        onIgnoreAllRules={handleIgnoreAllRules}
        enableTooltip={
          // 3001 use gasless tip
          checkErrors && checkErrors?.[0]?.code === 3001
            ? false
            : !canProcess ||
              !!checkErrors.find(item => item.level === 'forbidden')
        }
        tooltipContent={
          checkErrors && checkErrors?.[0]?.code === 3001
            ? undefined
            : checkErrors.find(item => item.level === 'forbidden')
            ? checkErrors.find(item => item.level === 'forbidden')!.msg
            : cantProcessReason
        }
        disabledProcess={
          !isReady ||
          (selectedGas ? selectedGas.price < 0 : true) ||
          !canProcess ||
          !!checkErrors.find(item => item.level === 'forbidden')
        }
      />
    </>
  );
};

export const MiniApproval = ({
  txs,
  visible,
  onResolve,
  onReject,
}: {
  txs?: Tx[];
  visible?: boolean;
  onReject?: () => void;
  onResolve?: () => void;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => getSheetStyles(colors), [colors]);
  // const { isDarkTheme } = useThemeMode();
  useEffect(() => {
    if (visible) {
      setIsSubmitting(false);
    }
  }, [visible]);

  const { sheetModalRef } = useSheetModal();

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, visible]);

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      // snapPoints={snapPoints}
      enableDismissOnClose
      onDismiss={onReject}
      handleStyle={styles.sheetBg}
      enableDynamicSizing
      backgroundStyle={styles.sheetBg}>
      <BottomSheetView>
        {txs?.length ? (
          <MiniSignTx
            txs={txs}
            onSubmit={() => {
              setIsSubmitting(true);
            }}
            onReject={onReject}
            onResolve={() => {
              setIsSubmitting(false);
              onResolve?.();
            }}
          />
        ) : null}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getSheetStyles = createGetStyles(colors => ({
  sheetBg: {
    backgroundColor: colors['neutral-bg-1'],
  },
}));
