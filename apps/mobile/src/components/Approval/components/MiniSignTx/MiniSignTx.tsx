import { AppBottomSheetModal } from '@/components';
import { toast } from '@/components/Toast';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { Chain } from '@/constant/chains';
import { SUPPORT_1559_KEYRING_TYPE } from '@/constant/tx';
import { apisSafe } from '@/core/apis/safe';
import { openapi } from '@/core/request';
import { customRPCService } from '@/core/services';
import { Account, ChainGas } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { useFindChain } from '@/hooks/useFindChain';
import { useSheetModal } from '@/hooks/useSheetModal';
import { matomoRequestEvent } from '@/utils/analytics';
import { intToHex } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import {
  calcMaxPriorityFee,
  checkGasAndNonce,
  convertLegacyTo1559,
} from '@/utils/transaction';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  ExplainTxResponse,
  GasLevel,
  ParseTxResponse,
  Tx,
  TxPushType,
} from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { useDebounceFn, useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import _, { omit } from 'lodash';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
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
import { calcGasLimit } from '@/core/apis/transactions';
import { useGasAccountTxsCheck } from '@/screens/GasAccount/hooks/checkTsx';
import { apiCustomRPC, apiProvider } from '@/core/apis';
import { toast as toast2024 } from '@/components2024/Toast';
import { useGasAccountInfo } from '@/screens/GasAccount/hooks';
import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import {
  MiniApprovalTaskType,
  useMiniApprovalTask,
} from '@/hooks/useMiniApprovalTask';
import { sendTransaction } from '@/utils/sendTransaction';
import { EVENT_MINI_APPROVAL_START_SIGN, eventBus } from '@/utils/events';
import AutoLockView from '@/components/AutoLockView';

import { useAtom } from 'jotai';
import { MiniApprovalError } from './error';
import {
  useMiniSignFixedMode,
  useMiniSignGasStore,
} from '@/hooks/miniSignGasStore';
import { View } from 'react-native';
import { BalanceChangeLoading } from './BalanceChangeLoanding';
import { useGetMiniSignTxExtraProps } from '@/hooks/useMiniApproval';
import BalanceChange from '../TxComponents/BalanceChange';

let count = 1;
let unCount = 0;

export const MiniSignTx = ({
  txs,
  onReject,
  onResolve,
  onVisibleChange,
  task,
  onSubmitting,
  onSubmitted,
  directSubmit,
  visible,
  account,
}: {
  txs: Tx[];
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendTransaction>>[]) => void;
  onSubmit?: () => void;
  ga?: Record<string, any>;
  onVisibleChange?: (v: boolean) => void;
  task: MiniApprovalTaskType;
  onSubmitting?: () => void;
  onSubmitted?: (isSuccess: boolean) => void;
  directSubmit?: boolean;
  visible?: boolean;
  account: Account;
}) => {
  useEffect(() => {
    if (count - unCount !== 1) {
      if (__DEV__) {
        toast2024.info(
          `MiniSignTx error render, count:${count},unCount:${unCount}`,
        );
      }
      console.error('MiniSignTx error', count - unCount);
    }
    count++;
    return () => {
      unCount++;
    };
  }, []);
  const {
    showSimulateChange,
    title,
    onPreExecChange,
    disableSignBtn = false,
    autoThrowPreExecError = true,
  } = useGetMiniSignTxExtraProps();

  const { styles } = useTheme2024({
    getStyle: getSheetStyles,
  });
  const [isReady, setIsReady] = useState(false);
  const [nonceChanged, setNonceChanged] = useState(false);
  const [canProcess, setCanProcess] = useState(true);
  const [cantProcessReason, setCantProcessReason] =
    useState<ReactNode | null>();
  const [gasPriceMedian, setGasPriceMedian] = useState<null | number>(null);
  const [recommendGasLimit, setRecommendGasLimit] = useState<string>('');
  const [recommendNonce, setRecommendNonce] = useState<string>('');

  const { t } = useTranslation();

  const currentAccount = account;

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

  const currentAccountType = currentAccount.type;

  const [gasLessLoading, setGasLessLoading] = useState(false);
  const [canUseGasLess, setCanUseGasLess] = useState(false);
  const [isFirstGasLessLoading, setIsFirstGasLessLoading] = useState(true);
  const [useGasLess, setUseGasLess] = useState(false);

  const [isGnosisAccount, setIsGnosisAccount] = useState(false);
  const [gasLessFailedReason, setGasLessFailedReason] = useState<
    string | undefined
  >(undefined);

  // const [isGnosisAccount, setIsGnosisAccount] = useState(false);
  // const [isCoboArugsAccount, setIsCoboArugsAccount] = useState(false);
  const isCoboArugsAccount = false;
  const [drawerVisible, setDrawerVisible] = useState(false);
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
      actionData: ParseTxResponse;
    }[]
  >([]);

  const {
    from,
    nonce,
    to,
    isSpeedUp,
    isCancel,
    isSend,
    isSwap,
    isBridge,
    swapPreferMEVGuarded,
    isViewGnosisSafe,
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
  const [maxPriorityFee, setMaxPriorityFee] = useState(0);
  const [nativeTokenBalance, setNativeTokenBalance] = useState('0x0');
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
    const res = txsResult.map(item => {
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
        .toFixed();
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

  const gasAccountTxs = useMemo(() => {
    if (!selectedGas?.price) {
      return [] as Tx[];
    }
    return (
      txsResult.map(item => {
        return {
          ...item.tx,
          gas: item.gasLimit,
          gasPrice: intToHex(selectedGas.price),
        };
      }) || ([] as Tx[])
    );
  }, [txsResult, selectedGas?.price]);

  const {
    gasAccountCost,
    gasMethod,
    setGasMethod,
    isGasAccountLogin,
    gasAccountCanPay,
    canGotoUseGasAccount,
    canDepositUseGasAccount,
    gasAccountCostFn,
    gasAccountAddress,
    sig,
    isFirstGasCostLoading,
  } = useGasAccountTxsCheck({
    isReady,
    txs: gasAccountTxs,
    noCustomRPC,
    isSupportedAddr,
    currentAccount,
  });

  useEffect(() => {
    const hasCustomRPC = async () => {
      if (chain?.enum) {
        const b = await apiCustomRPC.hasCustomRPC(chain?.enum);
        if (b) {
          setGasLessFailedReason(
            t('page.signFooterBar.gasless.customRpcUnavailableTip'),
          );
        }
        setNoCustomRPC(!b);
      }
    };
    hasCustomRPC();
  }, [chain?.enum, t]);
  const [gasLessConfig, setGasLessConfig] = useState<GasLessConfig | undefined>(
    undefined,
  );

  const {
    // updateMiniCustomPrice,
    // setMiniGasLevel,
    // miniGasLevel,
    // miniCustomPrice,
    currentMiniCustomGas,
    currentMiniSignGasLevel,
    updateMiniGas,
  } = useMiniSignGasStore(chainId);

  const fixedModeOnCurrentChain = useMiniSignFixedMode(chainId);

  const handleInitTask = useMemoizedFn(() => {
    // if (selectedGas && txsResult[0]) {
    //   const lastGasLevel = selectedGas?.level || 'normal';
    //   setMiniGasLevel(lastGasLevel as any);

    //   if (selectedGas?.level === 'custom') {
    //     updateMiniCustomPrice(
    //       parseInt(
    //         support1559
    //           ? txsResult[0].tx.maxFeePerGas || '0'
    //           : txsResult[0].tx.gasPrice || '0',
    //       ),
    //     );
    //   }
    // }

    task.init(
      txsResult.map(item => {
        return {
          tx: item.tx,
          options: {
            chainServerId: chain.serverId,
            gasLevel: selectedGas || undefined,
            isGasLess: gasMethod === 'native' ? useGasLess : false,
            isGasAccount: gasAccountCanPay,
            waitCompleted: false,
            pushType: pushInfo.type,
            ignoreGasCheck: true,
            ignoreGasNotEnoughCheck: true,
            sig,
            extra: {
              preExecResult: item.preExecResult,
              actionData: item.actionData,
            },
            account: currentAccount,
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
    gasAccountCanPay,
  ]);

  const handleAllow = useMemoizedFn(async () => {
    if (!txsResult?.length || !selectedGas) {
      return;
    }
    if (
      [KEYRING_CLASS.MNEMONIC, KEYRING_CLASS.PRIVATE_KEY].includes(
        currentAccount?.type || ('' as any),
      )
    ) {
      onVisibleChange?.(false);
    }
    onSubmitting?.();
    try {
      eventBus.emit(EVENT_MINI_APPROVAL_START_SIGN, {});
      const res = await task.start();
      // todo check this
      onResolve?.(res || []);
      onSubmitted?.(true);
    } catch (e) {
      console.error(e);
      onSubmitted?.(false);
      throw e;
    }
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
          if (item.level === 'custom') {
            return omit(gas, ['fixedMode']);
          }
          return item;
        }),
      );
    }
    updateMiniGas({
      chainId: txs?.[0]?.chainId!,
      gasLevel: gas.level as any,
      fixed: !!gas?.fixedMode,
      customGasPrice:
        gas.level === 'custom' ? Math.round(gas.price) : undefined,
    });

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
            account,
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
    const list = await apiProvider.gasMarketV2(
      {
        chain,
        customGas: custom && custom > 0 ? custom : undefined,
        tx: txs[0],
      },
      account,
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
          txsResult.map(item => {
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
        setGasLessConfig(
          res.promotion.id === '0ca5aaa5f0c9217e6f45fe1d109c24fb'
            ? {
                ...res.promotion.config,
                dark_color: '',
                theme_color: '',
              }
            : res?.promotion?.config,
        );
      }
      setIsFirstGasLessLoading(false);
    } catch (error) {
      console.error('gasLessTxCheck error', error);
      setCanUseGasLess(false);
      setGasLessConfig(undefined);
      setGasLessLoading(false);
      setIsFirstGasLessLoading(false);
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
      await customRPCService.syncDefaultRPC();
    } catch (e) {
      console.error(' miniSignTx sync default rpc error', e);
    }
    try {
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
        account,
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
      const lastTimeGas: ChainGas = {
        lastTimeSelect:
          currentMiniSignGasLevel === 'custom' ? 'gasPrice' : 'gasLevel',
        gasLevel: currentMiniSignGasLevel,
        gasPrice: currentMiniCustomGas || 0,
      };

      let customGasPrice = 0;
      if (lastTimeGas?.lastTimeSelect === 'gasPrice' && lastTimeGas.gasPrice) {
        // use cached gasPrice if exist
        customGasPrice = lastTimeGas.gasPrice;
      }
      if (
        ((isSend || isSwap || isBridge) && txs[0].gasPrice) ||
        isSpeedUp ||
        isCancel
      ) {
        // use gasPrice set by dapp when it's a speedup or cancel tx
        customGasPrice = parseInt(txs[0].gasPrice!);
      }
      const gasList = await loadGasMarket(chain, customGasPrice);
      loadGasMedian(chain);
      let gas: GasLevel | null = null;

      if (
        ((isSend || isSwap || isBridge) && customGasPrice) ||
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

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [initdTxs, setInitdTxs] = useState<typeof txsResult>([]);

  const checkGasLevelIsNotEnough = useMemoizedFn(
    (
      gas: GasSelectorResponse,
      type?: 'gasAccount' | 'native',
    ): Promise<[boolean, number]> => {
      if (!isReady || !initdTxs.length) {
        return Promise.resolve([true, 0]);
      }
      let _txsResult = initdTxs;
      return Promise.all(
        initdTxs.map(async item => {
          const tx = {
            ...item.tx,
            ...(support1559
              ? {
                  maxFeePerGas: intToHex(Math.round(gas.price || 0)),
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
              account,
            }),
          };
        }),
      ).then(arr => {
        let balance = nativeTokenBalance;
        _txsResult = arr;

        if (!_txsResult.length) {
          return [true, 0];
        }

        if (type === 'native') {
          const checkResult = _txsResult.map((item, index) => {
            const result = checkGasAndNonce({
              recommendGasLimitRatio: item.recommendGasLimitRatio,
              recommendGasLimit: item.gasLimit,
              recommendNonce: item.tx.nonce,
              tx: item.tx,
              gasLimit: item.gasLimit,
              nonce: item.tx.nonce,
              isCancel: isCancel,
              gasExplainResponse: item.gasCost,
              isSpeedUp: isSpeedUp,
              isGnosisAccount: false,
              nativeTokenBalance: balance,
            });
            balance = new BigNumber(balance)
              .minus(new BigNumber(item.tx.value || 0))
              .minus(new BigNumber(item.gasCost.maxGasCostAmount || 0))
              .toFixed();
            return result;
          });
          return [_.flatten(checkResult)?.some(e => e.code === 3001), 0] as [
            boolean,
            number,
          ];
        }
        return openapi
          .checkGasAccountTxs({
            sig: sig || '',
            account_id: gasAccountAddress,
            tx_list: arr.map((item, index) => {
              return {
                ...item.tx,
                gas: item.gasLimit,
                gasPrice: intToHex(gas.price),
              };
            }),
          })
          .then(gasAccountRes => {
            return [
              !gasAccountRes.balance_is_enough,
              (gasAccountRes.gas_account_cost.estimate_tx_cost || 0) +
                (gasAccountRes.gas_account_cost?.gas_cost || 0),
            ];
          });
      });
    },
  );
  const [simulateError, setSimulateError] = useState<Error | null>(null);

  const prepareTxs = useMemoizedFn(async () => {
    try {
      if (!selectedGas || !inited || !currentAccount?.address) {
        return;
      }

      const recommendNonce = await getRecommendNonce({
        tx: txs[0],
        chainId: chain.id,
        account,
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
            tx.maxPriorityFeePerGas =
              maxPriorityFee <= 0
                ? tx.maxFeePerGas
                : intToHex(Math.round(maxPriorityFee));
          }

          const preExecResult = await openapi.preExecTx({
            tx: tx,
            origin: INTERNAL_REQUEST_SESSION.origin,
            address: currentAccount?.address,
            updateNonce: true,
            pending_tx_list: [
              ...(await apisTransactionHistory.getPendingTxs({
                recommendNonce,
                address: currentAccount?.address,
                chainId: tx.chainId,
              })),
              ...tempTxs.slice(0, index),
            ],
          });
          let estimateGas = 0;
          if (index === txs.length - 1) {
            onPreExecChange?.(preExecResult);
          }
          if (!preExecResult.pre_exec.success && autoThrowPreExecError) {
            console.log(preExecResult);
            throw new Error('Pre exec failed');
          }
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

          let gasLimit = tx.gas || tx.gasLimit || '';
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
              account,
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
            account,
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
      setInitdTxs(res);
      setSimulateError(null);
    } catch (e) {
      console.error(e);
      setSimulateError(
        new MiniApprovalError('Simulate Error', {
          name: 'SimulateError',
          cause: e as any,
        }),
      );
    }
  });

  useEffect(() => {
    if (visible && simulateError) {
      onReject?.(simulateError);
    }
  }, [onReject, simulateError, visible]);

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
        setIsFirstGasLessLoading(false);
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

  useGasAccountInfo();

  const gasCalcMethod = useCallback(
    async price => {
      const res = await Promise.all(
        txsResult.map(item =>
          explainGas({
            gasUsed: item.gasUsed,
            gasPrice: price,
            chainId,
            nativeTokenPrice: item.preExecResult.native_token.price || 0,
            tx: item.tx,
            gasLimit: item.gasLimit,
            account,
          }),
        ),
      );
      const totalCost = res.reduce(
        (sum, item) => {
          sum.gasCostAmount = sum.gasCostAmount.plus(item.gasCostAmount);
          sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCostUsd);

          sum.maxGasCostAmount = sum.maxGasCostAmount.plus(
            item.maxGasCostAmount,
          );
          return sum;
        },
        {
          gasCostUsd: new BigNumber(0),
          gasCostAmount: new BigNumber(0),
          maxGasCostAmount: new BigNumber(0),
        },
      );
      return totalCost;
    },
    [account, chainId, txsResult],
  );

  const disabledProcess =
    !isReady ||
    (selectedGas ? selectedGas.price < 0 : true) ||
    !canProcess ||
    !!checkErrors.find(item => item.level === 'forbidden') ||
    disableSignBtn;

  return (
    <>
      <MiniFooterBar
        directSubmit={directSubmit}
        task={task}
        Header={
          <View>
            {showSimulateChange ? (
              <View>
                {title}

                {showSimulateChange ? (
                  <>
                    {txsResult?.[txsResult?.length - 1]?.preExecResult ? (
                      <BalanceChange
                        version={
                          txsResult?.[txsResult?.length - 1].preExecResult
                            .pre_exec_version
                        }
                        data={
                          txsResult?.[txsResult?.length - 1].preExecResult
                            .balance_change
                        }
                        style={styles.balanceChangeContainer}
                      />
                    ) : (
                      <BalanceChangeLoading />
                    )}
                  </>
                ) : null}
              </View>
            ) : null}
            <GasSelectorHeader
              fixedMode
              defaultFixedModeOnCurrentChain={fixedModeOnCurrentChain}
              tx={txs[0]}
              gasAccountCost={gasAccountCost}
              gasMethod={gasMethod}
              onChangeGasMethod={setGasMethod}
              pushType={pushInfo.type}
              isDisabledGasPopup={task.status !== 'idle'}
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
              gasCalcMethod={gasCalcMethod}
              directSubmit={directSubmit}
              checkGasLevelIsNotEnough={checkGasLevelIsNotEnough}
              account={currentAccount}
            />
          </View>
        }
        isSwap={isSwap}
        noCustomRPC={noCustomRPC}
        gasMethod={gasMethod}
        gasAccountCost={gasAccountCost}
        isFirstGasCostLoading={isFirstGasCostLoading}
        isFirstGasLessLoading={isFirstGasLessLoading}
        gasAccountCanPay={gasAccountCanPay}
        canGotoUseGasAccount={canGotoUseGasAccount}
        canDepositUseGasAccount={canDepositUseGasAccount}
        rejectApproval={onReject}
        onDeposit={() => {
          toast2024.success(t('page.gasAccount.depositSuccess'), {
            position: toast2024.positions.CENTER,
          });
          gasAccountCostFn();
        }}
        gasAccountAddress={gasAccountAddress}
        isGasAccountLogin={isGasAccountLogin}
        isWalletConnect={
          currentAccountType === KEYRING_TYPE.WalletConnectKeyring
        }
        onChangeGasAccount={() => setGasMethod('gasAccount')}
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
        account={currentAccount}
        chain={chain}
        isTestnet={chain.isTestnet}
        onCancel={handleCancel}
        onSubmit={() => handleAllow()}
        onIgnoreAllRules={handleIgnoreAllRules}
        enableTooltip={
          currentAccountType === KEYRING_TYPE.WatchAddressKeyring
            ? true
            : // 3001 use gasless tip
            checkErrors && checkErrors?.[0]?.code === 3001
            ? false
            : !canProcess ||
              !!checkErrors.find(item => item.level === 'forbidden')
        }
        tooltipContent={
          currentAccountType === KEYRING_TYPE.WatchAddressKeyring
            ? t('page.signTx.canOnlyUseImportedAddress')
            : checkErrors && checkErrors?.[0]?.code === 3001
            ? undefined
            : checkErrors.find(item => item.level === 'forbidden')
            ? checkErrors.find(item => item.level === 'forbidden')!.msg
            : cantProcessReason
        }
        disabledProcess={disabledProcess}
      />
    </>
  );
};

export const MiniApproval = ({
  txs,
  visible,
  onResolve,
  onReject,
  onVisibleChange,
  ga,
  onSubmitting,
  onSubmitted,
  account,
}: {
  txs?: Tx[];
  visible?: boolean;
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendTransaction>>[]) => void;
  onVisibleChange?: (v: boolean) => void;
  ga?: Record<string, any>;
  onSubmitting?: () => void;
  onSubmitted?: (isSuccess: boolean) => void;
  account: Account;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { styles } = useTheme2024({
    getStyle: getSheetStyles,
  });
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
  }, [sheetModalRef, visible, txs?.length]);

  useEffect(() => {
    if (txs?.length) {
      sheetModalRef.current?.present();
    }
  }, [sheetModalRef, txs]);

  const indexRef = useRef(-1);
  const dismissedByCodeRef = useRef(false);
  const { run: handleReject } = useDebounceFn(
    (reason?: string | Error) => {
      task.clear();
      onReject?.(reason);
    },
    {
      wait: 100,
    },
  );

  const pressBackdropRef = useRef(false);

  const onChange = useCallback(
    (index: number) => {
      if (index === -1 && indexRef.current > -1 && visible) {
        if (!dismissedByCodeRef.current) {
          const reason = pressBackdropRef.current
            ? 'PRESS_BACKDROP'
            : undefined;

          handleReject?.(reason);
          pressBackdropRef.current = false;
        }
        dismissedByCodeRef.current = false;
      }

      indexRef.current = index;
    },
    [handleReject, visible],
  );

  const task = useMiniApprovalTask({
    ga,
  });

  if (!txs?.length) {
    return null;
  }

  return (
    <>
      <AppBottomSheetModal
        index={visible ? 0 : -1}
        ref={sheetModalRef}
        style={styles.sheet}
        handleStyle={styles.handleStyle}
        handleIndicatorStyle={styles.handleIndicatorStyle}
        enableDynamicSizing
        backgroundStyle={styles.sheetBg}
        backdropProps={{
          onPress() {
            pressBackdropRef.current = true;
          },
        }}
        // containerStyle={{ zIndex: 2001 }}
        onChange={onChange}>
        <BottomSheetView>
          <AutoLockView
            style={{
              minHeight: 164,
            }}>
            {txs?.length ? (
              <MiniSignTx
                task={task}
                txs={txs}
                ga={ga}
                visible={visible}
                onVisibleChange={v => {
                  onVisibleChange?.(v);
                  if (!v) {
                    dismissedByCodeRef.current = true;
                  }
                }}
                onSubmit={() => {
                  setIsSubmitting(true);
                }}
                onReject={e => {
                  handleReject(e);
                  dismissedByCodeRef.current = true;
                }}
                onResolve={res => {
                  setIsSubmitting(false);
                  onResolve?.(res);
                  dismissedByCodeRef.current = true;
                }}
                onSubmitting={onSubmitting}
                onSubmitted={onSubmitted}
                account={account}
              />
            ) : null}
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>

      <MiniWaiting
        visible={!!task.error}
        error={task.error}
        onCancel={handleReject}
        onRetry={async () => {
          try {
            onSubmitting?.();
            const res = await task.retry();
            // todo check this
            onResolve?.(res || []);
            onSubmitted?.(true);
            dismissedByCodeRef.current = true;
          } catch (e) {
            console.error(e);
            onSubmitted?.(false);
          }
        }}
        account={account}
        ga={ga}
      />
    </>
  );
};

const getSheetStyles = createGetStyles2024(({ colors2024 }) => ({
  sheetBg: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  handleStyle: {
    paddingTop: 10,
    backgroundColor: colors2024['neutral-bg-1'],
    height: 36,
  },
  handleIndicatorStyle: {
    backgroundColor: colors2024['neutral-line'],
    height: 6,
    width: 50,
  },
  sheet: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  simulateChangeContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginBottom: 16,
    gap: 16,
  },
  balanceChangeContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginTop: 0,
    marginBottom: 16,
    paddingVertical: 16,
    paddingTop: 12,
    paddingBottom: 0,
    borderRadius: 8,
  },
}));
