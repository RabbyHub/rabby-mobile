import { Dimensions, ScrollView, View } from 'react-native';
import { MiniFooterBar } from './MiniFooterBar';
import BalanceChange from '../TxComponents/BalanceChange';
import { createGetStyles2024 } from '@/utils/styles';
import { BalanceChangeLoading } from './BalanceChangeLoanding';
import {
  GasSelectorHeader,
  GasSelectorResponse,
} from '../TxComponents/GasSelector/GasSelectorHeader';
import type { ApprovalGasMethod } from '../TxComponents/GasSelector/approvalGasDisplay';
import { useTranslation } from 'react-i18next';
import { MiniSecurityHeader } from '@/components2024/MiniSignV2/components/MiniSecurityHeader';
import type { SignatureFlowState } from '@/components2024/MiniSignV2/state/types';
import type { SignatureManager } from '@/components2024/MiniSignV2/state/SignatureManager';
import { useSignatureStore } from '@/components2024/MiniSignV2/state/useSignatureStore';
import { useSignatureInstance } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useGasAccountSign } from '@/screens/GasAccount/hooks/atom';
import { findChain } from '@/utils/chain';
import { useMemoizedFn } from 'ahooks';
import { intToHex } from '@/utils/number';
import { explainGas } from '../SignTx/calc';
import { checkGasAndNonce } from '@/utils/transaction';
import _, { noop } from 'lodash';
import { openapi } from '@/core/request';
import { normalizeTxParams } from '../SignTx/util';
import { useTheme2024 } from '@/hooks/theme';
import { useMiniSignFixedMode } from '@/hooks/miniSignGasStore';
import BigNumber from 'bignumber.js';
import { toast as toast2024 } from '@/components2024/Toast';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import miscService from '@/core/services/misc';
import {
  buildTopUpResumedTxs,
  GasAccountTopUpResult,
} from '@/screens/GasAccount/components/topUpContinuation';
import {
  calcTempoMaxGasCostRawAmountIn18,
  isTempoBatchSupportedAccountType,
  isTempoChain,
  listTempoFeeTokenOptionsFromCache,
  loadTempoFeeTokenOptionsState,
  TempoFeeTokenOption,
  TxWithTempoExtras,
} from '@/utils/tempo';
import { SignMainnetGasSelectorHeader } from '../TxComponents/GasSelector/SignMainnetGasSelectorHeader';
import tokenListStore from '@/store/tokens';
import type {
  GasAccountCheckResult,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';

const rawAmountToBn = (
  value: string | number | BigNumber | null | undefined,
) => {
  if (BigNumber.isBigNumber(value)) {
    return value;
  }
  return new BigNumber(value || 0);
};

const MiniSignTxV2 = ({
  showCheckSecurity,
  onToggleCheckSecurity,
  synGasHeaderInfo,
  instanceOverride,
  stateOverride,
}: {
  showCheckSecurity: boolean;
  onToggleCheckSecurity: () => void;
  synGasHeaderInfo?: boolean;
  instanceOverride?: SignatureManager;
  stateOverride?: SignatureFlowState;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle: getSheetStyles,
  });

  const contextInstance = useSignatureInstance();
  const contextState = useSignatureStore();
  const instance = instanceOverride || contextInstance;
  const state = stateOverride || contextState;

  const { ctx, config, error, status } = state;

  const session = config?.session;

  const fixedModeOnCurrentChain = useMiniSignFixedMode(ctx?.txs[0]?.chainId);

  const currentAccount = config?.account;
  const isGasAccountTopUpFlow = config?.purpose === 'gasAccountTopUp';

  const loading =
    status === 'prefetching' || status === 'signing' || !ctx?.txsCalc.length;

  const { sig, accountId: gasAccountAddress } = useGasAccountSign();
  const [manualGasMethod, setManualGasMethod] = useState<
    ApprovalGasMethod | undefined
  >(undefined);
  const manualGasScopeKey = useMemo(() => {
    if (!currentAccount?.address || !ctx?.chainId) {
      return '';
    }

    return `${currentAccount.type}:${currentAccount.address}:${ctx.chainId}`;
  }, [ctx?.chainId, currentAccount?.address, currentAccount?.type]);
  const manualGasScopeKeyRef = useRef('');

  useEffect(() => {
    if (!manualGasScopeKey) {
      return;
    }

    if (
      manualGasScopeKeyRef.current &&
      manualGasScopeKeyRef.current !== manualGasScopeKey
    ) {
      setManualGasMethod(undefined);
    }

    manualGasScopeKeyRef.current = manualGasScopeKey;
  }, [manualGasScopeKey]);

  const handleAutoChangeGasMethod = useCallback(
    async (method: ApprovalGasMethod) => {
      try {
        instance.setGasMethod(method);
      } catch (error) {
        console.error('Gas method change error:', error);
      }
    },
    [instance],
  );

  const handleChangeGasMethod = useCallback(
    async (method: ApprovalGasMethod) => {
      setManualGasMethod(method);
      try {
        instance.setGasMethod(method, { manual: true });
      } catch (error) {
        console.error('Gas method change error:', error);
      }
    },
    [instance],
  );

  const handleGasChange = useCallback(
    async gas => {
      try {
        await instance.updateGasLevel(gas);
      } catch (error) {
        console.error('Gas change error:', error);
      }
    },
    [instance],
  );

  const handleChangeGasAccount = useMemoizedFn(async () => {
    await handleChangeGasMethod('gasAccount');
    if (ctx?.selectedGas) {
      await handleGasChange(ctx.selectedGas as any);
    }
  });

  const handleTopUpWaitResult = useMemoizedFn(
    async (result: GasAccountTopUpResult) => {
      if (!ctx || !config || !ctx.txs.length) {
        return;
      }

      const nextTxs = await buildTopUpResumedTxs({
        txs: ctx.txs,
        originalAccount: config.account,
        originalChainServerId: chain.serverId,
        topUpResult: result,
      });
      instance.replaceTxs(nextTxs);
      if (ctx.selectedGas) {
        await handleGasChange(ctx.selectedGas as any);
      }
      setManualGasMethod('gasAccount');
      instance.setGasMethod('gasAccount', { manual: true });
    },
  );

  const isReady = (ctx?.txsCalc?.length || 0) > 0;
  const chain = findChain({ id: ctx?.chainId })!;
  const nativeTokenBalance = ctx?.nativeTokenBalance || '0x0';
  const gasToken = ctx?.gasToken || {
    tokenId: chain?.nativeTokenAddress || '',
    symbol: chain?.nativeTokenSymbol || '',
    decimals: chain?.nativeTokenDecimals || 18,
    logoUrl: chain?.nativeTokenLogo || '',
  };
  const checkTxValueInBalance = !isTempoChain(chain?.serverId);
  const support1559 = !!ctx?.is1559;
  const [tempoGasTokenList, setTempoGasTokenList] = useState<
    TempoFeeTokenOption[]
  >([]);
  const [tempoGasTokenLoading, setTempoGasTokenLoading] = useState(false);
  const txFeeToken =
    ((ctx?.txs?.[0] as unknown as TxWithTempoExtras | undefined)?.feeToken as
      | string
      | undefined) || '';
  const maxGasCostRawAmount = useMemo(
    () =>
      (ctx?.txsCalc || []).reduce(
        (sum, item) =>
          sum.plus(new BigNumber(item.gasCost.maxGasCostRawAmount || 0)),
        new BigNumber(0),
      ),
    [ctx?.txsCalc],
  );
  const maxGasCostRawAmountText = useMemo(
    () => maxGasCostRawAmount.toFixed(),
    [maxGasCostRawAmount],
  );
  const maxGasCostRawAmountIn18 = useMemo(
    () => calcTempoMaxGasCostRawAmountIn18(ctx?.txs || []),
    [ctx?.txs],
  );
  const maxGasCostRawAmountIn18Text = useMemo(
    () => maxGasCostRawAmountIn18.toFixed(),
    [maxGasCostRawAmountIn18],
  );
  const currentTempoTokenId =
    txFeeToken || ctx?.tempoPreferredFeeTokenId || gasToken.tokenId || '';
  const showTempoGasTokenSelector =
    !!chain &&
    isTempoChain(chain.serverId) &&
    (manualGasMethod ?? ctx?.gasMethod) !== 'gasAccount' &&
    isTempoBatchSupportedAccountType(currentAccount?.type);

  const getCachedTokenItems = useCallback(() => {
    if (!currentAccount?.address) {
      return [];
    }

    return (tokenListStore.getState().tokenListMap[
      currentAccount.address.toLowerCase()
    ] || []) as unknown as TokenItem[];
  }, [currentAccount?.address]);

  const handleSelectTempoGasToken = useCallback(
    async (
      token: TempoFeeTokenOption,
      options?: Parameters<typeof instance.setTempoFeeToken>[1],
    ) => {
      instance.setTempoFeeToken(token, options);
      if (ctx?.selectedGas) {
        await instance.updateGasLevel(ctx.selectedGas as any);
      }
    },
    [ctx?.selectedGas, instance],
  );

  useEffect(() => {
    if (!currentAccount?.address || !chain || !showTempoGasTokenSelector) {
      setTempoGasTokenList([]);
      setTempoGasTokenLoading(false);
      return;
    }

    let mounted = true;
    const cachedTokenItems = getCachedTokenItems();
    const cachedOptions = listTempoFeeTokenOptionsFromCache({
      tokenList: cachedTokenItems,
      chainServerId: chain.serverId,
      maxGasCostRawAmount,
      maxGasCostRawAmountDecimals: gasToken.decimals || 18,
      maxGasCostRawAmountIn18,
    });

    if (cachedOptions.length) {
      setTempoGasTokenList(cachedOptions);
    }

    setTempoGasTokenLoading(true);
    loadTempoFeeTokenOptionsState({
      account: currentAccount,
      userAddress: currentAccount.address,
      chainServerId: chain.serverId,
      tokenList: cachedTokenItems,
      txFeeToken,
      maxGasCostRawAmount,
      maxGasCostRawAmountDecimals: gasToken.decimals || 18,
      maxGasCostRawAmountIn18,
    })
      .then(({ options, preferredTokenId, selectedOption }) => {
        if (!mounted) {
          return;
        }
        setTempoGasTokenList(options);
        if (
          selectedOption &&
          currentTempoTokenId.toLowerCase() !== selectedOption.id.toLowerCase()
        ) {
          const shouldApplyFallbackFeeToken =
            !!txFeeToken &&
            txFeeToken.toLowerCase() !== selectedOption.id.toLowerCase();
          handleSelectTempoGasToken(selectedOption, {
            applyFeeToken: shouldApplyFallbackFeeToken,
            tempoPreferredFeeTokenId: preferredTokenId,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setTempoGasTokenLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    chain,
    chain?.serverId,
    currentAccount,
    currentAccount?.address,
    currentTempoTokenId,
    gasToken.decimals,
    getCachedTokenItems,
    handleSelectTempoGasToken,
    maxGasCostRawAmount,
    maxGasCostRawAmountIn18,
    maxGasCostRawAmountIn18Text,
    maxGasCostRawAmountText,
    showTempoGasTokenSelector,
    txFeeToken,
  ]);

  const checkGasLevelIsNotEnough = useMemoizedFn(
    (
      gas: GasSelectorResponse,
      type?: 'gasAccount' | 'native',
    ): Promise<[boolean, number, GasAccountCheckResult?]> => {
      const initdTxs = ctx?.txsCalc || [];
      let _txsResult = initdTxs;
      if (!isReady || !initdTxs.length) {
        return Promise.resolve([true, 0]);
      }

      return Promise.all(
        initdTxs.map(async item => {
          const tx = {
            ...item.tx,
            ...(ctx?.is1559
              ? {
                  maxFeePerGas: intToHex(Math.round(gas.price || 0)),
                  maxPriorityFeePerGas:
                    gas.maxPriorityFee < 0
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
              account: currentAccount!,
              preparedL1Fee: item.L1feeCache,
              gasTokenDecimals: gasToken.decimals || 18,
            }),
          };
        }),
      ).then(arr => {
        let balance = ctx?.nativeTokenBalance || '';
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
              gasTokenDecimals: gasToken.decimals || 18,
              gasTokenId: gasToken.tokenId,
              tempoPreferredFeeTokenId: ctx?.tempoPreferredFeeTokenId,
              checkTxValueInBalance,
            });
            const txValueRaw = checkTxValueInBalance
              ? rawAmountToBn(item.tx.value || 0)
              : new BigNumber(0);
            balance = new BigNumber(balance)
              .minus(txValueRaw)
              .minus(new BigNumber(item.gasCost.maxGasCostRawAmount || 0))
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
            account_id: gasAccountAddress || config!.account.address,
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
              gasAccountRes,
            ];
          });
      });
    },
  );

  useEffect(() => {
    miscService.setCurrentGasLevel(ctx?.selectedGas?.level);
  }, [ctx?.selectedGas?.level]);

  if (!ctx || !config?.account || !ctx?.txs?.length || !currentAccount) {
    return null;
  }

  const { swapPreferMEVGuarded, isSpeedUp, isCancel, isSwap } =
    normalizeTxParams(ctx.txs[0]);

  const handleToggleGasless = value => {
    instance.toggleGasless(value);
  };
  const handleConfirm = () => {
    if (!ctx?.txsCalc?.length) {
      return;
    }
    instance.send().catch(() => undefined);
  };

  const handleCancel = () => {
    instance.close();
  };

  const handleRetry = () => {
    instance.retry().catch(() => undefined);
  };

  const totalGasCost = ctx.txsCalc?.reduce(
    (sum, item) => {
      sum.gasCostAmount = sum.gasCostAmount.plus(
        item.gasCost?.gasCostAmount || 0,
      );
      sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCost?.gasCostUsd || 0);
      return sum;
    },
    {
      gasCostUsd: new BigNumber(0),
      gasCostAmount: new BigNumber(0),
      success: true,
    },
  ) || {
    gasCostUsd: new BigNumber(0),
    gasCostAmount: new BigNumber(0),
    success: true,
  };

  const gasCalcMethod = async (price: number) => {
    const res = await Promise.all(
      (ctx?.txsCalc || []).map(item =>
        explainGas({
          gasUsed: item.gasUsed,
          gasPrice: price,
          chainId,
          nativeTokenPrice: item.preExecResult.native_token.price || 0,
          tx: item.tx,
          gasLimit: item.gasLimit,
          account: currentAccount!,
          gasTokenDecimals: gasToken.decimals || 18,
        }),
      ),
    );
    return res.reduce(
      (sum, item) => {
        sum.gasCostAmount = sum.gasCostAmount.plus(item.gasCostAmount);
        sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCostUsd);
        return sum;
      },
      {
        gasCostUsd: new BigNumber(0),
        gasCostAmount: new BigNumber(0),
      },
    );
  };

  const canUseGasLess = !!ctx?.gasless?.is_gasless;
  let gasLessConfig =
    canUseGasLess && ctx?.gasless?.promotion
      ? ctx?.gasless?.promotion?.config
      : undefined;
  if (
    gasLessConfig &&
    ctx?.gasless?.promotion?.id === '0ca5aaa5f0c9217e6f45fe1d109c24fb'
  ) {
    gasLessConfig = { ...gasLessConfig, dark_color: '', theme_color: '' };
  }

  const isGasNotEnough = !!ctx?.isGasNotEnough;

  const useGasLess =
    (isGasNotEnough || !!gasLessConfig) && !!canUseGasLess && !!ctx?.useGasless;

  const showGasLess = isReady && (isGasNotEnough || !!gasLessConfig);

  const noCustomRPC = ctx?.noCustomRPC ?? true;
  const effectiveGasMethod = manualGasMethod ?? ctx?.gasMethod;

  const canGotoUseGasAccount =
    // isSupportedAddr &&
    noCustomRPC &&
    !!ctx?.gasAccount?.balance_is_enough &&
    !ctx?.gasAccount.chain_not_support &&
    !!ctx?.gasAccount.is_gas_account;

  const canDepositUseGasAccount =
    // isSupportedAddr &&
    noCustomRPC &&
    !!ctx?.gasAccount &&
    !ctx?.gasAccount?.balance_is_enough &&
    !ctx?.gasAccount.chain_not_support;

  const gasAccountCanPay =
    effectiveGasMethod === 'gasAccount' &&
    // isSupportedAddr &&
    noCustomRPC &&
    !!ctx?.gasAccount?.balance_is_enough &&
    !ctx?.gasAccount.chain_not_support &&
    !!ctx?.gasAccount.is_gas_account &&
    !(ctx?.gasAccount as any).err_msg;

  // mock mini sign task
  const task = {
    status: ctx.signInfo?.status
      ? ctx.signInfo?.status === 'signing'
        ? 'active'
        : ctx.signInfo?.status
      : 'idle',
    error: null,
    list: [],
    init: () => {},
    start: () => Promise.resolve(''),
    retry: () => Promise.resolve(''),
    stop: () => {},
    currentActiveIndex: ctx.signInfo?.currentTxIndex || 0,
    total: ctx.signInfo?.totalTxs,
  } as any;

  const directSubmit = ctx.mode === 'direct';

  const {
    enableSecurityEngine,
    showSimulateChange,
    onRedirectToDeposit,
    title,
    originGasPrice,
    disableSignBtn,
  } = config;
  const txsResult = ctx.txsCalc;
  const txs = ctx.txs;
  const gasAccountCost = ctx.gasAccount as any;
  const gasMethod = ctx.gasMethod;
  const setGasMethod = handleChangeGasMethod;
  const pushType = swapPreferMEVGuarded ? 'mev' : 'default';
  const gasLimit = ctx.txs?.[0]?.gas;
  const gasList = ctx.gasList;
  const selectedGas = ctx.selectedGas;
  const recommendGasLimit = ctx.txsCalc?.[0]?.gasLimit;
  const recommendNonce = ctx.txsCalc?.[0]?.tx?.nonce || '0x1';
  const chainId = ctx.chainId;
  const realNonce = ctx.txsCalc?.[0]?.tx?.nonce || '0x1';
  const isHardware = false;
  const manuallyChangeGasLimit = false;
  const checkErrors = ctx.checkErrors || [];
  const engineResults = ctx.engineResults;
  const gasPriceMedian = ctx.gasPriceMedian || null;
  const isWalletConnect = false;
  const isWatchAddr = false;
  const gasLessFailedReason = ctx.gasless?.desc;
  const securityLevel = ctx.engineResults?.actionRequireData?.[0];
  const disabledProcess =
    !!loading ||
    !ctx?.txsCalc?.length ||
    !!ctx.checkErrors?.some(e => e.level === 'forbidden');
  const nativeTokenInsufficient = !!ctx.checkErrors?.some(e => e.code === 3001);
  if (synGasHeaderInfo) {
    return null;
  }

  console.log('SignMainnetHeaderContent  tx render', {
    ctx,
    gasMethod: effectiveGasMethod,
  });

  return (
    <View style={showCheckSecurity ? styles.wrapper : undefined}>
      {showCheckSecurity ? (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 50,
          }}
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}>
          <MiniSecurityHeader
            engineResults={ctx.engineResults}
            tx={ctx?.txs?.[ctx.txs.length - 1]}
            txDetail={ctx?.txsCalc?.[ctx.txs.length - 1]?.preExecResult}
            account={config.account}
            isReady={!!ctx.engineResults}
            session={session}
          />
        </ScrollView>
      ) : null}
      <MiniFooterBar
        directSubmit={directSubmit}
        task={task}
        Header={
          <View>
            {showSimulateChange && !showCheckSecurity ? (
              <View>
                {title}

                {showSimulateChange ? (
                  <>
                    {txsResult?.[txsResult?.length - 1]?.preExecResult ? (
                      <ScrollView style={styles.balanceChangeScrollContainer}>
                        <BalanceChange
                          version={
                            txsResult?.[txsResult?.length - 1]?.preExecResult
                              .pre_exec_version || 'v0'
                          }
                          data={
                            txsResult?.[txsResult?.length - 1]?.preExecResult
                              .balance_change
                          }
                          style={styles.balanceChangeContainer}
                        />
                      </ScrollView>
                    ) : (
                      <BalanceChangeLoading />
                    )}
                  </>
                ) : null}
              </View>
            ) : null}
            <View style={{ paddingBottom: 10 }}>
              <SignMainnetGasSelectorHeader
                fixedMode
                defaultFixedModeOnCurrentChain={fixedModeOnCurrentChain}
                tx={txs[0]!}
                gasAccountCost={gasAccountCost}
                noCustomRPC={noCustomRPC}
                gasMethod={effectiveGasMethod}
                onChangeGasMethod={setGasMethod}
                onAutoChangeGasMethod={handleAutoChangeGasMethod}
                disableAutoGasLevelSwitch={!!manualGasMethod}
                showGasMethodShortcut
                pushType={pushType}
                isDisabledGasPopup={task.status !== 'idle'}
                disabled={false}
                isReady={isReady}
                gasLimit={gasLimit}
                noUpdate={false}
                gasList={gasList}
                selectedGas={selectedGas}
                version={
                  txsResult?.[0]?.preExecResult?.pre_exec_version || 'v0'
                }
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
                engineResults={engineResults?.engineResult}
                nativeTokenBalance={nativeTokenBalance}
                gasToken={gasToken}
                showTempoGasTokenSelector={showTempoGasTokenSelector}
                tempoGasTokenList={tempoGasTokenList}
                tempoPreferredFeeTokenId={ctx?.tempoPreferredFeeTokenId}
                onSelectTempoGasToken={handleSelectTempoGasToken}
                tempoGasTokenLoading={tempoGasTokenLoading}
                gasPriceMedian={gasPriceMedian}
                gas={totalGasCost}
                gasCalcMethod={gasCalcMethod}
                directSubmit={true}
                checkGasLevelIsNotEnough={checkGasLevelIsNotEnough}
                account={currentAccount}
                nativeTokenInsufficient={nativeTokenInsufficient}
                freeGasAvailable={canUseGasLess}
              />
            </View>
          </View>
        }
        isSwap={isSwap}
        noCustomRPC={noCustomRPC}
        gasMethod={effectiveGasMethod}
        gasAccountCost={gasAccountCost}
        isFirstGasCostLoading={!ctx?.txsCalc.length}
        isFirstGasLessLoading={!ctx?.txsCalc.length}
        disableAutoGasAccountSwitch={!!manualGasMethod}
        gasAccountCanPay={gasAccountCanPay}
        canGotoUseGasAccount={canGotoUseGasAccount}
        canDepositUseGasAccount={canDepositUseGasAccount}
        disableGasAccountDeposit={isGasAccountTopUpFlow}
        // rejectApproval={onReject}
        onDeposit={() => {
          toast2024.success(t('page.gasAccount.depositSuccess'), {
            position: toast2024.positions.CENTER,
          });
        }}
        onWaitDepositResult={handleTopUpWaitResult}
        gasAccountAddress={gasAccountAddress}
        isWalletConnect={isWalletConnect}
        onChangeGasAccount={handleChangeGasAccount}
        isWatchAddr={isWatchAddr}
        gasLessConfig={gasLessConfig}
        gasLessFailedReason={gasLessFailedReason}
        canUseGasLess={canUseGasLess}
        showGasLess={showGasLess}
        useGasLess={useGasLess}
        isGasNotEnough={isGasNotEnough}
        enableGasLess={() => handleToggleGasless(true)}
        hasShadow={false}
        origin={INTERNAL_REQUEST_SESSION.origin}
        originLogo={INTERNAL_REQUEST_SESSION.icon}
        // hasUnProcessSecurityResult={hasUnProcessSecurityResult}
        securityLevel={securityLevel}
        gnosisAccount={undefined}
        account={currentAccount}
        chain={chain}
        isTestnet={chain?.isTestnet}
        onCancel={handleCancel}
        onSubmit={handleConfirm}
        onIgnoreAllRules={noop}
        enableTooltip={ctx.checkErrors?.some(
          e => e.code !== 3001 && e.level === 'forbidden',
        )}
        tooltipContent={
          checkErrors && checkErrors?.[0]?.code === 3001
            ? undefined
            : checkErrors.find(item => item.level === 'forbidden')
            ? checkErrors.find(item => item.level === 'forbidden')!.msg
            : undefined
        }
        disabledProcess={disabledProcess}
        disableSignBtn={
          !!disableSignBtn || (config.checkGasFeeTooHigh && ctx.gasFeeTooHigh)
        }
        showCheckSecurityBtn={config?.showCheck}
        showCheckSecurity={showCheckSecurity}
        onToggleCheckSecurity={onToggleCheckSecurity}
        showCheckSecurityBtnDisabled={status === 'signing'}
      />
    </View>
  );
};

const getSheetStyles = createGetStyles2024(({ colors2024 }) => ({
  wrapper: {
    backgroundColor: colors2024['neutral-bg-0'],
    height: Dimensions.get('screen').height * 0.85,
  },
  approvalTx: {
    paddingHorizontal: 15,
    flex: 1,
  },
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
  balanceChangeScrollContainer: {
    maxHeight: Dimensions.get('screen').height * 0.45,
    backgroundColor: colors2024['neutral-bg-2'],
    marginTop: 0,
    marginBottom: 16,
    paddingVertical: 16,
    paddingTop: 12,
    paddingBottom: 0,
    borderRadius: 8,
  },
  balanceChangeContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    margin: 0,
    padding: 0,
    borderRadius: 0,
    marginTop: 0,
  },
}));

export default MiniSignTxV2;
