/**
 * 这个场景下，from是抵押物，to是债务，和ui的方向相反
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ChainId, InterestRate } from '@aave/contract-helpers';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { OptimalRate } from '@paraswap/sdk';
import { last, noop } from 'lodash';
import BigNumber from 'bignumber.js';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { apiProvider } from '@/core/apis';
import { useTheme2024 } from '@/hooks/theme';
import { toast } from '@/components2024/Toast';
import { Button } from '@/components2024/Button';
import { useMiniSigner } from '@/hooks/useSigner';
import { createGetStyles2024 } from '@/utils/styles';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { transactionHistoryService } from '@/core/services';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import RcIconWalletCC from '@/assets2024/icons/swap/wallet-cc.svg';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { BridgeSlippage } from '@/screens/Bridge/components/BridgeSlippage';
import { formatSpeicalAmount, formatTokenAmount } from '@/utils/number';
import { WarningText } from '@/screens/Bridge/components/WarningText';
import RcIconBluePolygon from '@/assets2024/icons/bridge/IconBluePolygon.svg';
import {
  MINI_SIGN_ERROR,
  useSignatureStore,
} from '@/components2024/MiniSignV2/state/SignatureManager';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { normalizeBN } from '@aave/math-utils';
import { approveToken } from '@/core/apis/approvals';
import { getERC20Allowance } from '@/core/apis/provider';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

import { SwapType } from '../../../types/swap';
import TokenIcon from '../../TokenIcon';
import { APP_CODE_LENDING_REPAY_WITH_COLLATERAL } from '../../../utils/constant';
import { ParaswapRatesType, SwappableToken } from '../../../types/swap';
import { getParaswap } from '../../../config/paraswap';
import { getParaswapSellRates } from '../DebtSwap/paraswap';
import { usePoolDataProviderContract, useSelectedMarket } from '../../../hooks';
import {
  useFormatValues,
  useSwapReserves,
  useRepayWithCollateralSlippage,
  useHFForRepayWithCollateral,
} from './hook';
import {
  maxInputAmountWithSlippage,
  formatTx,
} from '../../../modals/DebtSwapModal/utils';
import { buildRepayWithCollateralTx } from '../../../poolService';
import {
  calculateSignedAmount,
  getPriceImpactData,
  getToAmountAfterSlippage,
} from '../../../modals/DebtSwapModal/warning';
import BridgeSwitchBtn from '@/screens/Bridge/components/BridgeSwitchBtn';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { ethers, PopulatedTransaction } from 'ethers';
import { DEFAULT_REPAY_WITH_COLLATERAL_SLIPPAGE } from './utils';
import RepayWithCollateralOverview from './Overview';

interface RepayWithCollateralProps {
  repayToken: SwappableToken;
  defaultCollateralToken?: SwappableToken;
  onClose?: () => void;
}

const BOTTOM_SIZE = {
  BUTTON: 116,
  CHECKBOX: 40,
  TIPS: 80,
};

export default function RepayWithCollateral({
  repayToken,
  defaultCollateralToken,
  onClose,
}: RepayWithCollateralProps) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });

  const { chainEnum, chainInfo, selectedMarketData, isMainnet } =
    useSelectedMarket();
  const { pools } = usePoolDataProviderContract();
  const { ctx } = useSignatureStore();

  const [selectedCollateralToken, setSelectedCollateralToken] = useState<
    SwappableToken | undefined
  >(defaultCollateralToken);

  const [repayAmount, setRepayAmount] = useState<string>('');
  const debouncedRepayAmount = useDebouncedValue(repayAmount || '0', 400);
  const [collateralAmount, setCollateralAmount] = useState<string>('');

  const [quote, setQuote] = useState<ParaswapRatesType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [riskChecked, setRiskChecked] = useState(false);
  const [noQuote, setNoQuote] = useState(false);
  const [quoteRefreshId, setQuoteRefreshId] = useState(0);

  const [swapRate, setSwapRate] = useState<{
    optimalRateData?: OptimalRate;
    inputAmount?: string;
    outputAmount?: string;
    slippageBps?: number;
    maxInputAmountWithSlippage?: string;
  }>({});

  const [currentTxs, setCurrentTxs] = useState<Tx[]>([]);

  const lastQuoteParamsRef = useRef<{
    rawAmount: string;
    toToken?: string;
    srcAmount?: string;
  }>();

  const quoteExpiredTimerRef = useRef<NodeJS.Timeout>();
  const enableQuoteAutoRefreshRef = useRef(false);

  const {
    collateralUsdValue,
    debtBalanceToDisplay,
    debtUsdValue,
    debtBalance,
  } = useFormatValues({
    collateralToken: selectedCollateralToken,
    repayToken,
    collateralAmount,
    repayAmount: debouncedRepayAmount,
  });

  const { collateralReserve, repayReserve, isSameToken, repayDisplayReserve } =
    useSwapReserves({
      collateralToken: selectedCollateralToken,
      repayToken,
    });

  const {
    slippage,
    slippageBpsRef,
    setSlippage,
    autoSlippage,
    setAutoSlippage,
    isCustomSlippage,
    setIsCustomSlippage,
    displaySlippage,
  } = useRepayWithCollateralSlippage({
    collateralToken: selectedCollateralToken,
    repayToken,
    setSwapRate,
  });

  const collateralAmountAfterSlippage = useMemo(() => {
    return getToAmountAfterSlippage({
      inputAmount: collateralAmount || '0',
      slippage: Number(slippage) * 100,
    });
  }, [collateralAmount, slippage]);

  const priceImpactData = useMemo(() => {
    return getPriceImpactData({
      fromToken: repayToken,
      toToken: selectedCollateralToken,
      fromAmount: debouncedRepayAmount,
      toAmount: collateralAmountAfterSlippage,
    });
  }, [
    repayToken,
    selectedCollateralToken,
    debouncedRepayAmount,
    collateralAmountAfterSlippage,
  ]);

  useEffect(() => {
    setRiskChecked(false);
  }, [displaySlippage, priceImpactData.showConfirmation]);

  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );

  const handleOpenFromTokenSelect = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.COLLATERAL_TOKEN_SELECT,
      excludeTokenAddress: repayToken.underlyingAddress,
      onChange: (token: SwappableToken) => {
        setSelectedCollateralToken(token);
        setCollateralAmount('');
        setQuote(null);
        setSwapRate({});
        setIsQuoteLoading(false);
        setNoQuote(false);
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
    });
  }, [repayToken.underlyingAddress, isLight, colors2024]);

  const clearQuoteExpiredTimer = useCallback(() => {
    if (quoteExpiredTimerRef.current) {
      clearTimeout(quoteExpiredTimerRef.current);
    }
  }, []);

  useEffect(
    () => () => {
      clearQuoteExpiredTimer();
    },
    [clearQuoteExpiredTimer],
  );

  const onInputChange = useCallback(
    (text: string) => {
      const formatted = formatSpeicalAmount(text);
      if (!/^\d*(\.\d*)?$/.test(formatted)) {
        return;
      }

      if (formatted === '') {
        setRepayAmount('');
        return;
      }

      const amountBn = new BigNumber(formatted || 0);
      const exceedBalance = amountBn.gt(debtBalance);
      const displayAmountStr = exceedBalance
        ? debtBalance.toString(10)
        : formatted;

      setRepayAmount(displayAmountStr);
    },
    [debtBalance],
  );

  useEffect(() => {
    let cancelled = false;
    const fetchQuote = async () => {
      const resetQuote = () => {
        setCollateralAmount('');
        setQuote(null);
        setSwapRate({});
        setIsQuoteLoading(false);
        setNoQuote(false);
        enableQuoteAutoRefreshRef.current = false;
        clearQuoteExpiredTimer();
      };

      setIsQuoteLoading(true);
      if (
        !selectedCollateralToken ||
        isSameToken ||
        !debouncedRepayAmount ||
        !currentAccount?.address ||
        !collateralReserve?.underlyingAsset ||
        !collateralReserve?.decimals
      ) {
        resetQuote();
        return;
      }

      const amountBn = new BigNumber(debouncedRepayAmount || 0);
      if (amountBn.lte(0)) {
        resetQuote();
        return;
      }

      try {
        const rawAmount = normalizeBN(
          debouncedRepayAmount,
          -1 * repayToken.decimals,
        ).toFixed(0);

        const quoteParams = {
          swapType: SwapType.RepayWithCollateral,
          chainId: repayToken.chainId,
          amount: rawAmount,
          srcToken: collateralReserve?.underlyingAsset,
          srcDecimals: collateralReserve?.decimals,
          destToken: repayToken.underlyingAddress,
          user: currentAccount.address,
          destDecimals: repayToken.decimals,
          side: 'buy' as const,
          appCode: APP_CODE_LENDING_REPAY_WITH_COLLATERAL,
          options: {
            partner: APP_CODE_LENDING_REPAY_WITH_COLLATERAL,
          },
          invertedQuoteRoute: true,
        };

        const quoteRes = await getParaswapSellRates(quoteParams);

        if (cancelled || !quoteRes) {
          if (!cancelled) {
            setNoQuote(true);
            enableQuoteAutoRefreshRef.current = false;
            clearQuoteExpiredTimer();
          }
          return;
        }

        const destAmount = normalizeBN(
          quoteRes.destSpotAmount,
          quoteRes.destDecimals,
        ).toFixed();

        lastQuoteParamsRef.current = {
          rawAmount,
          toToken: selectedCollateralToken.addressToSwap,
          srcAmount: quoteRes.destSpotAmount,
        };

        setQuote(quoteRes);
        setSwapRate({
          optimalRateData: quoteRes.optimalRateData,
          inputAmount: quoteRes.destSpotAmount,
          outputAmount: rawAmount,
          slippageBps: slippageBpsRef.current,
          maxInputAmountWithSlippage: maxInputAmountWithSlippage(
            quoteRes.destSpotAmount,
            slippageBpsRef.current,
          ),
        });
        setCollateralAmount(destAmount);
        setNoQuote(false);
        enableQuoteAutoRefreshRef.current = true;
        clearQuoteExpiredTimer();
        quoteExpiredTimerRef.current = setTimeout(() => {
          if (enableQuoteAutoRefreshRef.current) {
            setQuoteRefreshId(prev => prev + 1);
          }
        }, 1000 * 30);
      } catch (e) {
        if (!cancelled) {
          setCollateralAmount('');
          setQuote(null);
          setSwapRate({});
          setNoQuote(true);
          enableQuoteAutoRefreshRef.current = false;
          clearQuoteExpiredTimer();
        }
      } finally {
        if (!cancelled) {
          setIsQuoteLoading(false);
        }
      }
    };
    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [
    currentAccount?.address,
    isSameToken,
    slippageBpsRef,
    quoteRefreshId,
    clearQuoteExpiredTimer,
    selectedCollateralToken,
    debouncedRepayAmount,
    repayToken.decimals,
    repayToken.chainId,
    repayToken.underlyingAddress,
    collateralReserve?.underlyingAsset,
    collateralReserve?.decimals,
  ]);

  const {
    openDirect,
    prefetch: prefetchMiniSigner,
    close: closeMiniSigner,
  } = useMiniSigner({
    account: currentAccount!,
    chainServerId: chainInfo?.serverId || '',
    autoResetGasStoreOnChainChange: true,
  });
  const collateralNotEnough = useMemo(() => {
    if (!selectedCollateralToken) {
      return false;
    }
    return new BigNumber(collateralAmountAfterSlippage).gt(
      selectedCollateralToken?.balance || '0',
    );
  }, [collateralAmountAfterSlippage, selectedCollateralToken]);
  const buildRepayWithCollateralTxs = useCallback(async (): Promise<Tx[]> => {
    if (
      !currentAccount ||
      !selectedCollateralToken ||
      !quote ||
      !swapRate.optimalRateData ||
      !selectedMarketData?.addresses?.REPAY_WITH_COLLATERAL_ADAPTER ||
      !pools?.provider ||
      !repayReserve ||
      !collateralReserve ||
      !pools?.pool ||
      !chainInfo ||
      collateralNotEnough
    ) {
      return [];
    }

    const rawAmount = normalizeBN(
      debouncedRepayAmount,
      -1 * repayToken.decimals,
    ).toFixed(0);

    if (
      !lastQuoteParamsRef.current ||
      lastQuoteParamsRef.current.rawAmount !== rawAmount ||
      lastQuoteParamsRef.current.toToken !==
        selectedCollateralToken.addressToSwap
    ) {
      throw new Error('quote-outdated');
    }

    const { paraswap, feeTarget } = getParaswap(repayToken.chainId as ChainId);
    const slippageBps =
      swapRate.slippageBps ?? DEFAULT_REPAY_WITH_COLLATERAL_SLIPPAGE;

    const swapTxParams: any = {
      destAmount: rawAmount,
      destDecimals: repayToken.decimals,
      destToken: repayToken.underlyingAddress,
      isDirectFeeTransfer: true,
      partnerAddress: feeTarget,
      slippage: slippageBps,
      priceRoute: swapRate.optimalRateData,
      srcToken: selectedCollateralToken?.underlyingAddress,
      srcDecimals: selectedCollateralToken.decimals,
      userAddress: currentAccount.address,
      takeSurplus: true,
    };

    const txParams: any = await paraswap.buildTx(swapTxParams, {
      ignoreChecks: true,
    });

    const swapCallData = txParams.data;
    const augustus = txParams.to;

    const isMaxSelected = new BigNumber(debouncedRepayAmount || 0).gte(
      debtBalance,
    );

    const repayWithAmount =
      swapRate.maxInputAmountWithSlippage ||
      swapRate.inputAmount ||
      swapRate.optimalRateData.srcAmount ||
      '0';

    const repayWithCollateralParams = {
      fromUnderlyingAsset: selectedCollateralToken.underlyingAddress,
      fromATokenAddress: collateralReserve.aTokenAddress,
      toUnderlyingAsset: repayToken.underlyingAddress,
      repayAmount: debouncedRepayAmount,
      repayWithAmount: BigNumber(collateralAmount)
        .multipliedBy(1 + slippageBps / 10000)
        .decimalPlaces(selectedCollateralToken.decimals, BigNumber.ROUND_CEIL)
        .toFixed(selectedCollateralToken.decimals),
      repayAllDebt: isMaxSelected,
      rateMode: InterestRate.Variable,
      useFlashLoan: false,
      swapCallData,
      augustus,
    };
    const repayWithCollateralTx = await buildRepayWithCollateralTx({
      pool: pools.pool,
      address: currentAccount.address,
      ...repayWithCollateralParams,
    });

    const txs: Tx[] = [];

    if (
      !isSameAddress(
        selectedCollateralToken.addressToSwap,
        chainInfo?.nativeTokenAddress || '',
      )
    ) {
      const aTokenAddress = selectedCollateralToken.addressToSwap;
      if (!aTokenAddress) {
        throw new Error('aTokenAddress not found');
      }

      const approveAmount = calculateSignedAmount(repayWithAmount);

      // 实时检查当前allowance
      const allowance = await getERC20Allowance(
        chainInfo.serverId,
        aTokenAddress,
        selectedMarketData.addresses.REPAY_WITH_COLLATERAL_ADAPTER,
        currentAccount.address,
        currentAccount,
      );

      const requiredAmount = new BigNumber(approveAmount).toString();
      const actualNeedApprove = !new BigNumber(allowance || '0').gte(
        requiredAmount,
      );

      if (actualNeedApprove) {
        let shouldTwoStepApprove = false;
        if (
          isMainnet &&
          isSameAddress(
            selectedCollateralToken.underlyingAddress,
            ETH_USDT_CONTRACT,
          ) &&
          Number(allowance) !== 0 &&
          !new BigNumber(allowance || '0').gte(requiredAmount)
        ) {
          shouldTwoStepApprove = true;
        }

        // 如果需要两步approve，先执行0额度approve
        if (shouldTwoStepApprove) {
          const zeroApproveResult = await approveToken({
            chainServerId: chainInfo.serverId,
            id: aTokenAddress,
            spender: selectedMarketData.addresses.REPAY_WITH_COLLATERAL_ADAPTER,
            amount: 0,
            account: currentAccount,
            isBuild: true,
          });

          const zeroApproveTxBuilt = {
            ...zeroApproveResult.params[0],
            from: zeroApproveResult.params[0].from || currentAccount.address,
            value: zeroApproveResult.params[0].value ?? '0x0',
            chainId: zeroApproveResult.params[0].chainId || chainInfo.id,
          };

          txs.push(zeroApproveTxBuilt);
        }
        const approveResult = await approveToken({
          chainServerId: chainInfo.serverId,
          id: aTokenAddress,
          spender: selectedMarketData.addresses.REPAY_WITH_COLLATERAL_ADAPTER,
          amount: approveAmount,
          account: currentAccount,
          isBuild: true,
        });

        const approveTxBuilt = {
          ...approveResult.params[0],
          from: approveResult.params[0].from || currentAccount.address,
          value: approveResult.params[0].value ?? '0x0',
          chainId: approveResult.params[0].chainId || chainInfo.id,
        };

        txs.push(approveTxBuilt);
      }
    }

    const actionTx = repayWithCollateralTx.find(tx =>
      ['DLP_ACTION'].includes(tx.txType),
    );
    if (!actionTx) {
      throw new Error('Action tx not found');
    }
    let tx;
    try {
      tx = await actionTx.tx();
    } catch (error) {
      // 内部的gas limit没预估通过，就忽略
      if ((error as any).transaction) {
        tx = (error as any).transaction;
      }
    }
    if (!tx) {
      throw new Error('tx not found');
    }
    const populatedTx: PopulatedTransaction = {
      to: tx.to,
      from: tx.from,
      data: tx.data,
      value: tx.value ? ethers.BigNumber.from(tx.value) : undefined,
    };
    const formattedRepayTx = formatTx(
      populatedTx,
      currentAccount.address,
      repayToken.chainId,
    );
    txs.push(formattedRepayTx as unknown as Tx);

    return txs;
  }, [
    currentAccount,
    selectedCollateralToken,
    quote,
    swapRate.optimalRateData,
    swapRate.slippageBps,
    swapRate.maxInputAmountWithSlippage,
    swapRate.inputAmount,
    selectedMarketData?.addresses.REPAY_WITH_COLLATERAL_ADAPTER,
    pools?.provider,
    pools?.pool,
    repayReserve,
    collateralReserve,
    chainInfo,
    collateralNotEnough,
    debouncedRepayAmount,
    repayToken.decimals,
    repayToken.chainId,
    repayToken.underlyingAddress,
    debtBalance,
    collateralAmount,
    isMainnet,
  ]);

  useEffect(() => {
    let cancelled = false;
    const buildTxs = async () => {
      if (
        !currentAccount ||
        !selectedCollateralToken ||
        !quote ||
        !swapRate.optimalRateData ||
        !selectedMarketData?.addresses?.REPAY_WITH_COLLATERAL_ADAPTER ||
        !pools?.provider ||
        !repayReserve ||
        !collateralReserve ||
        !debouncedRepayAmount ||
        new BigNumber(debouncedRepayAmount).lte(0) ||
        collateralNotEnough
      ) {
        if (!cancelled) {
          setCurrentTxs([]);
        }
        return;
      }

      try {
        const txs = await buildRepayWithCollateralTxs();
        if (!cancelled) {
          setCurrentTxs(txs.filter(tx => !!tx));
        }
      } catch (error) {
        console.error('CUSTOM_LOGGER:=>: error', error);
        if (!cancelled) {
          setCurrentTxs([]);
        }
      }
    };
    buildTxs();
    return () => {
      cancelled = true;
    };
  }, [
    buildRepayWithCollateralTxs,
    currentAccount,
    collateralReserve,
    pools?.provider,
    quote,
    selectedMarketData?.addresses?.REPAY_WITH_COLLATERAL_ADAPTER,
    swapRate.optimalRateData,
    repayReserve,
    selectedCollateralToken,
    debouncedRepayAmount,
    collateralNotEnough,
  ]);

  const { isHFLow, isLiquidatable, currentHF, afterSwapInfo } =
    useHFForRepayWithCollateral({
      collateralToken: selectedCollateralToken,
      repayToken,
      collateralAmount: collateralAmountAfterSlippage,
      repayAmount: debouncedRepayAmount,
    });

  useEffect(() => {
    if (
      !currentAccount ||
      !canShowDirectSubmit ||
      !currentTxs?.length ||
      collateralNotEnough
    ) {
      closeMiniSigner();
      return;
    }
    prefetchMiniSigner({
      txs: currentTxs,
      synGasHeaderInfo: true,
      checkGasFeeTooHigh: true,
    });
  }, [
    canShowDirectSubmit,
    closeMiniSigner,
    collateralNotEnough,
    currentAccount,
    currentTxs,
    prefetchMiniSigner,
  ]);

  const handleRepay = useCallback(
    async (p?: { ignoreGasFee?: boolean; forceFullSign?: boolean }) => {
      if (
        !selectedCollateralToken ||
        !debouncedRepayAmount ||
        !currentAccount
      ) {
        return;
      }

      try {
        setIsLoading(true);
        if (!currentTxs.length) {
          toast.info('please retry');
          return;
        }

        let results: string[] = [];
        if (canShowDirectSubmit && !p?.forceFullSign) {
          try {
            results = await openDirect({
              txs: currentTxs,
              ga: {
                customAction: CUSTOM_HISTORY_ACTION.LENDING,
                customActionTitleType:
                  CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY_WITH_COLLATERAL,
              },
              checkGasFeeTooHigh: ctx?.gasFeeTooHigh,
              ignoreGasFeeTooHigh: p?.ignoreGasFee,
            });
          } catch (error) {
            console.error('CUSTOM_LOGGER:=>: error', error);
            if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
              closeMiniSigner();
              onClose?.();
              return;
            }
            if (error === MINI_SIGN_ERROR.PREFETCH_FAILURE) {
              await handleRepay({
                ...p,
                forceFullSign: true,
              });
            }
            return;
          }
        } else {
          for (const tx of currentTxs) {
            const hash = await apiProvider.sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [tx],
              },
              session: INTERNAL_REQUEST_SESSION,
              account: currentAccount,
            });
            results.push(hash);
          }
        }

        const txId = last(results);
        if (txId && chainInfo?.id) {
          transactionHistoryService.setCustomTxItem(
            currentAccount.address,
            chainInfo?.id,
            txId,
            {
              actionType:
                CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY_WITH_COLLATERAL,
            },
          );
        }
        toast.success(
          `${t('page.Lending.repayWithCollateral.action.title', {
            collateral: selectedCollateralToken?.symbol,
          })} ${t('page.Lending.submitted')}`,
        );
        closeMiniSigner();
        onClose?.();
      } catch (error) {
        console.error('repay with collateral error', error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedCollateralToken,
      debouncedRepayAmount,
      currentAccount,
      currentTxs,
      canShowDirectSubmit,
      chainInfo?.id,
      t,
      closeMiniSigner,
      onClose,
      openDirect,
      ctx?.gasFeeTooHigh,
    ],
  );

  const isSlippageHigh = useMemo(() => {
    const slippageValue = new BigNumber(displaySlippage || 0);
    return slippageValue.gt(30);
  }, [displaySlippage]);

  const isRisky = useMemo(() => {
    return isSlippageHigh || priceImpactData.showConfirmation || isHFLow;
  }, [isHFLow, isSlippageHigh, priceImpactData.showConfirmation]);

  const riskDesc = useMemo(() => {
    if (isHFLow) {
      return t('page.Lending.debtSwap.lpRiskWarning');
    }
    return t('page.bridge.showMore.signWarning');
  }, [isHFLow, t]);

  const canRepay = useMemo(() => {
    return (
      !!selectedCollateralToken &&
      !isSameToken &&
      !!quote &&
      !!debouncedRepayAmount &&
      !collateralNotEnough &&
      new BigNumber(debouncedRepayAmount).gt(0) &&
      new BigNumber(debouncedRepayAmount).lte(debtBalance) &&
      !isQuoteLoading
    );
  }, [
    selectedCollateralToken,
    isSameToken,
    quote,
    debouncedRepayAmount,
    collateralNotEnough,
    debtBalance,
    isQuoteLoading,
  ]);

  const buttonDisabled = useMemo(() => {
    return (
      !canRepay ||
      (isRisky && !riskChecked) ||
      isLiquidatable ||
      collateralNotEnough
    );
  }, [canRepay, collateralNotEnough, isLiquidatable, isRisky, riskChecked]);

  return (
    <>
      <BottomSheetScrollView
        showsVerticalScrollIndicator
        persistentScrollbar
        style={styles.scrollableBlock}
        contentContainerStyle={[styles.contentContainer]}>
        <View style={styles.content}>
          <View style={styles.tokenContainer}>
            <View style={styles.tokenHeader}>
              <Text style={styles.label}>
                {t('page.Lending.repayWithCollateral.toRepay')}
              </Text>
            </View>

            <View style={styles.tokenBody}>
              <TextInput
                style={styles.amountInput}
                value={repayAmount}
                onChangeText={onInputChange}
                placeholder="0"
                keyboardType="numeric"
                textAlign="left"
                numberOfLines={1}
                multiline={false}
                spellCheck={false}
                inputMode="decimal"
                scrollEnabled={true}
                placeholderTextColor={colors2024['neutral-info']}
              />
              {(!repayAmount || BigNumber(repayAmount || '0').lte(0)) && (
                <Pressable
                  style={styles.maxButtonWrapper}
                  onPress={() => setRepayAmount(debtBalance.toString(10))}>
                  <Text style={styles.maxButtonText}>MAX</Text>
                </Pressable>
              )}
              <View style={styles.divider} />
              <View style={styles.tokenInfo}>
                <TokenIcon
                  size={26}
                  chainSize={12}
                  chain={chainEnum}
                  tokenSymbol={repayToken.symbol}
                />
                <View style={styles.tokenDetails}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.tokenSymbol}>
                    {repayToken.symbol}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.usdValueRow}>
              <Text style={styles.usdValue}>{debtUsdValue}</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceText}>
                  Borrowed {debtBalanceToDisplay}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <View style={styles.arrowContainer}>
              <BridgeSwitchBtn
                style={styles.arrowWrapper}
                loading={isQuoteLoading}
              />
            </View>
          </View>

          <View style={styles.tokenContainer}>
            <View style={styles.tokenHeader}>
              <Text style={styles.label}>
                {t('page.Lending.repayWithCollateral.repayWith')}
              </Text>
            </View>

            <View style={styles.tokenBody}>
              <Text
                style={[
                  styles.amountDisplay,
                  !collateralAmount && styles.amountDisplayPlaceholder,
                  isQuoteLoading && styles.loadingOpacity,
                ]}>
                {collateralAmount ? formatTokenAmount(collateralAmount) : '0'}
              </Text>
              <Pressable
                style={[
                  styles.tokenInfo,
                  !selectedCollateralToken && styles.placeholderTokenInfo,
                ]}
                onPress={handleOpenFromTokenSelect}>
                {selectedCollateralToken ? (
                  <>
                    <TokenIcon
                      size={26}
                      chainSize={12}
                      chain={chainEnum}
                      tokenSymbol={selectedCollateralToken.symbol}
                    />
                    <View style={styles.tokenDetails}>
                      <Text style={styles.tokenSymbol}>
                        {selectedCollateralToken.symbol}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.selectTokenText}>
                      {t('page.Lending.debtSwap.actions.select')}
                    </Text>
                  </>
                )}
                <RcIconSwapBottomArrow />
              </Pressable>
            </View>

            {selectedCollateralToken && (
              <View style={styles.usdValueRow}>
                <Text
                  style={[
                    styles.usdValue,
                    isQuoteLoading && styles.loadingOpacity,
                  ]}>
                  {collateralUsdValue}
                </Text>
                <View style={styles.balanceRow}>
                  <RcIconWalletCC
                    width={16}
                    height={16}
                    color={colors2024['neutral-foot']}
                  />
                  <Text style={styles.balanceText}>
                    {formatTokenAmount(selectedCollateralToken.balance || '0')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
        {noQuote && !isQuoteLoading && (
          <Text style={styles.errorText}>{t('page.swap.no-quote-found')}</Text>
        )}

        {canRepay && !noQuote && (
          <View style={styles.slippageContainer}>
            <BridgeSlippage
              value={slippage}
              displaySlippage={displaySlippage}
              onChange={setSlippage}
              autoSlippage={autoSlippage}
              isCustomSlippage={isCustomSlippage}
              setAutoSlippage={setAutoSlippage}
              setIsCustomSlippage={setIsCustomSlippage}
              type="swap"
              loading={isQuoteLoading}
            />
          </View>
        )}
        {canRepay &&
          !noQuote &&
          priceImpactData.showWarning &&
          !isQuoteLoading && (
            <View style={styles.priceImpactContainer}>
              <View style={styles.priceImpactRow}>
                <Text style={styles.priceImpactText}>
                  {t('page.bridge.price-impact')}
                </Text>
                <View style={styles.priceImpactDiffBox}>
                  <Text style={styles.priceImpactLossAmount}>
                    {(priceImpactData.lostValue * 100).toFixed(1)}%
                  </Text>
                  <RcIconBluePolygon color={colors2024['orange-default']} />
                </View>
              </View>

              <WarningText>
                <Text>
                  {t('page.Lending.debtSwap.priceImpactTips', {
                    lostValue: `${(priceImpactData.lostValue * 100).toFixed(
                      1,
                    )}%`,
                  })}
                </Text>
              </WarningText>
            </View>
          )}
        {canShowDirectSubmit && canRepay && (
          <View style={styles.gasPreContainer}>
            <DirectSignGasInfo
              supportDirectSign={true}
              loading={false}
              openShowMore={noop}
              chainServeId={chainInfo?.serverId || ''}
            />
          </View>
        )}
        {(noQuote && !isQuoteLoading) || collateralNotEnough ? null : (
          <RepayWithCollateralOverview
            fromToken={selectedCollateralToken}
            toToken={repayToken}
            chainEnum={chainEnum}
            fromAmount={collateralAmountAfterSlippage}
            currentToAmount={repayDisplayReserve?.variableBorrows || '0'}
            toAmount={debouncedRepayAmount}
            fromBalanceBn={selectedCollateralToken?.balance || '0'}
            isQuoteLoading={isQuoteLoading}
            currentHF={currentHF}
            afterHF={afterSwapInfo?.hfAfterSwap.toString()}
          />
        )}
      </BottomSheetScrollView>

      <View
        style={[
          styles.buttonContainer,
          {
            height:
              BOTTOM_SIZE.BUTTON +
              (isLiquidatable
                ? BOTTOM_SIZE.TIPS
                : isRisky
                ? BOTTOM_SIZE.CHECKBOX
                : 0),
          },
        ]}>
        {isLiquidatable || collateralNotEnough ? (
          <View style={styles.riskContainer}>
            <Text style={styles.dangerWarningText}>
              {collateralNotEnough
                ? t('page.Lending.repayWithCollateral.collateralNotEnough')
                : isLiquidatable
                ? t('page.Lending.debtSwap.lpDangerWarning')
                : ''}
            </Text>
          </View>
        ) : isRisky ? (
          <Pressable
            style={styles.riskContainer}
            onPress={() => {
              setRiskChecked(!riskChecked);
            }}>
            <CheckBoxRect checked={riskChecked} size={16} />
            <Text style={styles.warningText}>{riskDesc}</Text>
          </Pressable>
        ) : null}
        {canShowDirectSubmit ? (
          <DirectSignBtn
            loading={isLoading}
            loadingType="circle"
            key={`${selectedCollateralToken?.underlyingAddress}-${repayToken?.underlyingAddress}-${debouncedRepayAmount}`}
            showTextOnLoading
            wrapperStyle={styles.directSignBtn}
            authTitle={t('page.Lending.repayWithCollateral.button.repay')}
            title={t('page.Lending.repayWithCollateral.button.repay')}
            onFinished={() => handleRepay()}
            disabled={buttonDisabled || !!ctx?.disabledProcess}
            type="primary"
            syncUnlockTime
            account={currentAccount}
            showHardWalletProcess
          />
        ) : (
          <Button
            loadingType="circle"
            showTextOnLoading
            containerStyle={styles.fullWidthButton}
            onPress={() => handleRepay()}
            title={t('page.Lending.repayWithCollateral.button.repay')}
            loading={isLoading}
            disabled={buttonDisabled}
          />
        )}
      </View>
    </>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  scrollableBlock: {
    flex: 1,
    width: '100%',
    marginTop: 16,
    height: '100%',
    overflow: 'visible',
  },
  contentContainer: {
    //paddingHorizontal: 25,
    paddingBottom: 220,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    paddingLeft: 4,
  },
  content: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingVertical: 20,
  },
  slippageContainer: {
    paddingHorizontal: 8,
    marginBottom: 8,
    marginTop: 10,
  },
  tokenContainer: {
    borderRadius: 16,
    padding: 16,
    paddingVertical: 0,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  slider: {
    width: 100,
  },
  sliderValue: {
    //width: 40,
    textAlign: 'right',
    color: colors2024['brand-default'],
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'SF Pro',
  },
  tokenBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 100,
    paddingHorizontal: 4,
    height: 34,
    paddingRight: 8,
    width: 'auto',
  },
  maxButtonWrapper: {
    marginLeft: 8,
    padding: 4,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 8,
  },
  maxButtonText: {
    color: colors2024['brand-default'],
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
  },
  divider: {
    height: 24,
    width: 1,
    backgroundColor: colors2024['neutral-line'],
    marginHorizontal: 8,
  },
  placeholderTokenInfo: {
    paddingLeft: 12,
  },
  tokenDetails: {
    flexShrink: 0,
  },
  tokenSymbol: {
    fontSize: 16,
    lineHeight: 20,
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  selectTokenText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'left',
    minWidth: 100,
    flex: 1,
  },
  amountDisplay: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'left',
    flex: 1,
  },
  amountDisplayPlaceholder: {
    color: colors2024['neutral-info'],
  },
  usdValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usdValue: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  dividerContainer: {
    position: 'relative',
    alignItems: 'center',
    marginTop: -6.5,
    marginBottom: -6.5,
  },
  dividerLine: {
    position: 'absolute',
    top: 22.5,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },
  arrowContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  arrowWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -45 / 2 }, { translateY: -45 / 2 }],
  },
  arrowText: {
    fontSize: 22,
    color: colors2024['neutral-secondary'],
  },
  gasPreContainer: {
    paddingHorizontal: 8,
    marginTop: 12,
    width: '100%',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    height: 116,
    paddingTop: 12,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  directSignBtn: {
    width: '100%',
  },
  fullWidthButton: {
    flex: 1,
  },
  loadingOpacity: {
    opacity: 0.5,
  },
  riskContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  dangerWarningText: {
    fontSize: 13,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['red-default'],
  },
  priceImpactContainer: {
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  priceImpactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceImpactText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  priceImpactDiffBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceImpactLossAmount: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['orange-default'],
    marginRight: 4,
  },
  priceImpactTooltipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  errorText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
    marginTop: 8,
    paddingHorizontal: 8,
  },
}));
