import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TouchableOpacity, View } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { PopupDetailProps } from '../../type';
import { formatAmountValueKMB } from '@/screens/TokenDetail/util';
import { TokenAmountInput } from './TokenAmountInput';
import SupplyActionOverView from './SupplyActionOverView';
import {
  calculateHFAfterSupply,
  effectUserAvailable,
} from '../../utils/hfUtils';
import {
  useLendingSummary,
  usePoolDataProviderContract,
  useSelectedMarket,
} from '../../hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { buildSupplyTx, optimizedPath } from '../../poolService';
import {
  DirectSignBtn,
  DirectSignBtnMethods,
} from '@/components2024/DirectSignBtn';
import { getERC20Allowance } from '@/core/apis/provider';
import { approveToken } from '@/core/apis/approvals';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { debounce, last, noop } from 'lodash';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { parseUnits } from 'ethers/lib/utils';
import { toast } from '@/components2024/Toast';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import { API_ETH_MOCK_ADDRESS } from '@aave/contract-helpers';
import { useMiniSigner } from '@/hooks/useSigner';
import { formatTokenAmount } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
  LendingReportType,
  LendingSignType,
} from '@/screens/Transaction/components/type';
import { transactionHistoryService } from '@/core/services';
import { useRefreshHistoryId } from '../../hooks';
import wrapperToken from '../../config/wrapperToken';
import { APP_VERSIONS, INTERNAL_REQUEST_SESSION } from '@/constant';
import { sendRequest } from '@/core/apis/sendRequest';
import { Button } from '@/components2024/Button';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { SignatureInstanceProvider } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import { useSignatureStoreOf } from '@/components2024/MiniSignV2/state/useSignatureStore';
import { SUPPLY_UI_SAFE_MARGIN } from '../../utils/constant';
import { CHAINS_ENUM } from '@debank/common';
import { ReserveErrorTip } from '../ErrorTip';
import { stats } from '@/utils/stats';
import { isZeroAmount } from '../../utils/number';
import { Text } from '@/components/Typography';
import { switchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { PositionTokenSelector } from '../ItemRender/PositionTokenSelector';
import {
  getWrappedNativeTokenOptions,
  isWrappedNativeSelectorReserve,
  type BalancePositionTokenOption,
} from '../../utils/positionTokenSelector';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  BOTTOM_BUTTON_WITH_ICON_TITLE_STYLE,
  RootNames,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { naviPush } from '@/utils/navigation';

type SupplyActionPopupProps = PopupDetailProps & {
  onBeforeSwapNavigate?: () => void;
};

export const SupplyActionPopup: React.FC<SupplyActionPopupProps> = ({
  reserve,
  userSummary,
  onClose,
  onBeforeSwapNavigate,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const [amount, setAmount] = useState<string | undefined>(undefined);
  const [activeUnderlyingAsset, setActiveUnderlyingAsset] = useState(
    reserve.underlyingAsset,
  );
  const [needApprove, setNeedApprove] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supplyTx, setSupplyTx] = useState<any>(null);
  const [approveTxs, setApproveTxs] = useState<any>();
  const { refresh } = useRefreshHistoryId();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const {
    displayPoolReserves,
    formattedPoolReservesAndIncentives,
    getTargetReserve,
  } = useLendingSummary();
  const { isMainnet, chainInfo, chainEnum, selectedMarketData } =
    useSelectedMarket();
  const { pools } = usePoolDataProviderContract();
  const { t } = useTranslation();
  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );
  const directSignBtnRef = useRef<DirectSignBtnMethods>(null);
  const approveRequestIdRef = useRef(0);
  const buildTransactionsRequestIdRef = useRef(0);

  const resetTokenScopedState = useCallback(() => {
    approveRequestIdRef.current += 1;
    buildTransactionsRequestIdRef.current += 1;
    setAmount(undefined);
    setNeedApprove(false);
    setSupplyTx(null);
    setApproveTxs(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    resetTokenScopedState();
    setActiveUnderlyingAsset(reserve.underlyingAsset);
  }, [reserve.underlyingAsset, resetTokenScopedState]);

  const currentReserve = useMemo(() => {
    return getTargetReserve(activeUnderlyingAsset) || reserve;
  }, [activeUnderlyingAsset, getTargetReserve, reserve]);

  const isNativeToken = useMemo(() => {
    return isSameAddress(currentReserve.underlyingAsset, API_ETH_MOCK_ADDRESS);
  }, [currentReserve.underlyingAsset]);

  const tokenOptions = useMemo(() => {
    return isWrappedNativeSelectorReserve(currentReserve, chainEnum)
      ? getWrappedNativeTokenOptions({
          displayPoolReserves,
          chainEnum,
          type: 'balance',
        })
      : undefined;
  }, [chainEnum, currentReserve, displayPoolReserves]);

  const handleChangeActiveUnderlyingAsset = useCallback(
    (underlyingAsset: string) => {
      if (isSameAddress(underlyingAsset, activeUnderlyingAsset)) {
        return;
      }
      resetTokenScopedState();
      setActiveUnderlyingAsset(underlyingAsset);
    },
    [activeUnderlyingAsset, resetTokenScopedState],
  );

  const afterHF = useMemo(() => {
    if (!amount || isZeroAmount(amount)) {
      return undefined;
    }
    const targetPool = formattedPoolReservesAndIncentives.find(item => {
      return isSameAddress(currentReserve.underlyingAsset, API_ETH_MOCK_ADDRESS)
        ? isSameAddress(
            item.underlyingAsset,
            wrapperToken?.[currentReserve.chain]?.address,
          )
        : isSameAddress(item.underlyingAsset, currentReserve.underlyingAsset);
    });
    if (!targetPool) {
      return undefined;
    }
    return calculateHFAfterSupply(
      userSummary,
      targetPool,
      BigNumber(amount).multipliedBy(
        targetPool.formattedPriceInMarketReferenceCurrency,
      ),
    ).toString();
  }, [
    amount,
    currentReserve.chain,
    currentReserve.underlyingAsset,
    formattedPoolReservesAndIncentives,
    userSummary,
  ]);

  const afterAvailable = useMemo(() => {
    if (!amount || isZeroAmount(amount)) {
      return undefined;
    }
    const targetPool = formattedPoolReservesAndIncentives.find(item => {
      return isSameAddress(currentReserve.underlyingAsset, API_ETH_MOCK_ADDRESS)
        ? isSameAddress(
            item.underlyingAsset,
            wrapperToken?.[currentReserve.chain]?.address,
          )
        : isSameAddress(item.underlyingAsset, currentReserve.underlyingAsset);
    });
    if (!targetPool) {
      return undefined;
    }
    if (effectUserAvailable(userSummary, targetPool)) {
      return BigNumber(amount)
        .multipliedBy(
          currentReserve.reserve.formattedPriceInMarketReferenceCurrency,
        )
        .multipliedBy(currentReserve.reserve.formattedBaseLTVasCollateral)
        .plus(BigNumber(userSummary?.availableBorrowsUSD || '0'))
        .toString();
    } else {
      return userSummary?.availableBorrowsUSD || '0';
    }
  }, [
    amount,
    currentReserve.chain,
    currentReserve.reserve.formattedBaseLTVasCollateral,
    currentReserve.reserve.formattedPriceInMarketReferenceCurrency,
    currentReserve.underlyingAsset,
    formattedPoolReservesAndIncentives,
    userSummary,
  ]);

  // 检查approve额度
  const checkApproveStatus = useCallback(async () => {
    const requestId = ++approveRequestIdRef.current;
    const isLatestRequest = () => requestId === approveRequestIdRef.current;

    if (!amount || isZeroAmount(amount) || !currentAccount) {
      setNeedApprove(false);
      return;
    }
    if (!selectedMarketData) {
      setNeedApprove(false);
      return;
    }

    try {
      if (!chainInfo) {
        setNeedApprove(false);
        return;
      }

      // 如果是原生代币，不需要approve
      if (
        isSameAddress(
          currentReserve.underlyingAsset,
          chainInfo.nativeTokenAddress,
        ) ||
        isNativeToken
      ) {
        if (isLatestRequest()) {
          setNeedApprove(false);
        }
        return;
      }

      // 获取当前approve额度
      const allowance = await getERC20Allowance(
        chainInfo.serverId,
        currentReserve.underlyingAsset,
        selectedMarketData.addresses.LENDING_POOL,
        currentAccount.address,
        currentAccount,
      );
      if (!isLatestRequest()) {
        return;
      }

      // 计算需要的额度（包含decimals）
      const requiredAmount = new BigNumber(amount)
        .multipliedBy(10 ** currentReserve.reserve.decimals)
        .toString();

      // 检查当前额度是否足够
      const isApproved = new BigNumber(allowance || '0').gte(requiredAmount);
      if (isLatestRequest()) {
        setNeedApprove(!isApproved);
      }
    } catch (error) {
      if (!isLatestRequest()) {
        return;
      }
      console.error('Check approve status error:', error);
      setNeedApprove(true); // 出错时默认需要approve
    }
  }, [
    amount,
    currentAccount,
    selectedMarketData,
    chainInfo,
    currentReserve.underlyingAsset,
    currentReserve.reserve.decimals,
    isNativeToken,
  ]);

  // 构建交易和估算gas
  const buildTransactions = useCallback(async () => {
    const requestId = ++buildTransactionsRequestIdRef.current;
    const isLatestRequest = () =>
      requestId === buildTransactionsRequestIdRef.current;

    setSupplyTx(null);
    setApproveTxs(null);

    if (!amount || isZeroAmount(amount) || !currentAccount?.address) {
      setIsLoading(false);
      return;
    }
    if (!selectedMarketData || !pools) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      if (!chainInfo) {
        return;
      }

      const txs: any[] = [];

      // 实时检查approve状态，避免依赖状态备份
      let actualNeedApprove = false;
      let allowance = '0';
      if (
        !isSameAddress(
          currentReserve.underlyingAsset,
          chainInfo.nativeTokenAddress,
        ) &&
        !isNativeToken
      ) {
        allowance = await getERC20Allowance(
          chainInfo.serverId,
          currentReserve.underlyingAsset,
          selectedMarketData.addresses.LENDING_POOL,
          currentAccount.address,
          currentAccount,
        );
        if (!isLatestRequest()) {
          return;
        }

        const requiredAmount = new BigNumber(amount)
          .multipliedBy(10 ** currentReserve.reserve.decimals)
          .toString();

        actualNeedApprove = !new BigNumber(allowance || '0').gte(
          requiredAmount,
        );
      }

      if (actualNeedApprove && !isNativeToken) {
        const requiredAmount = new BigNumber(amount)
          .multipliedBy(10 ** currentReserve.reserve.decimals)
          .toFixed();

        // 检查是否需要两步approve（针对以太坊上的USDT）
        let shouldTwoStepApprove = false;
        if (
          isMainnet &&
          isSameAddress(currentReserve.underlyingAsset, ETH_USDT_CONTRACT) &&
          Number(allowance) !== 0 &&
          !new BigNumber(allowance || '0').gte(requiredAmount)
        ) {
          shouldTwoStepApprove = true;
        }

        // 如果需要两步approve，先执行0额度approve
        if (shouldTwoStepApprove) {
          const zeroApproveResult = await approveToken({
            chainServerId: chainInfo.serverId,
            id: currentReserve.underlyingAsset,
            spender: selectedMarketData.addresses.LENDING_POOL,
            amount: 0,
            account: currentAccount,
            isBuild: true,
          });
          if (!isLatestRequest()) {
            return;
          }

          const zeroApproveTxBuilt = {
            ...zeroApproveResult.params[0],
            from: zeroApproveResult.params[0].from || currentAccount.address,
            value: zeroApproveResult.params[0].value ?? '0x0',
            chainId: zeroApproveResult.params[0].chainId || chainInfo.id,
          };

          txs.push(zeroApproveTxBuilt);
        }

        // 执行正常额度的approve
        const approveResult = await approveToken({
          chainServerId: chainInfo.serverId,
          id: currentReserve.underlyingAsset,
          spender: selectedMarketData.addresses.LENDING_POOL,
          amount: requiredAmount,
          account: currentAccount,
          isBuild: true,
        });
        if (!isLatestRequest()) {
          return;
        }

        const approveTxBuilt = {
          ...approveResult.params[0],
          from: approveResult.params[0].from || currentAccount.address,
          value: approveResult.params[0].value ?? '0x0',
          chainId: approveResult.params[0].chainId || chainInfo.id,
        };

        txs.push(approveTxBuilt);
      }

      // 构建supply交易
      const supplyResult = await buildSupplyTx({
        poolBundle: pools.poolBundle,
        amount: parseUnits(amount, currentReserve.reserve.decimals).toString(),
        address: currentAccount.address,
        reserve: currentReserve.underlyingAsset,
        useOptimizedPath: optimizedPath(selectedMarketData.chainId),
      });
      if (!isLatestRequest()) {
        return;
      }
      delete supplyResult.gasLimit;

      const formattedSupplyResult = {
        ...supplyResult,
        from: supplyResult.from || currentAccount.address,
        value: supplyResult.value?.toHexString() || '0x0',
        chainId: chainInfo.id,
      };
      setApproveTxs(txs.length ? txs : null);
      setSupplyTx(formattedSupplyResult);
    } catch (error) {
      if (!isLatestRequest()) {
        return;
      }
      console.error('Build transactions error:', error);
      toast.error('something error');
      setSupplyTx(null);
      setApproveTxs(null);
    } finally {
      if (isLatestRequest()) {
        setIsLoading(false);
      }
    }
    //currentAccount is not stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    amount,
    currentAccount?.address,
    selectedMarketData,
    pools,
    chainInfo,
    currentReserve.underlyingAsset,
    currentReserve.reserve.decimals,
    isNativeToken,
    isMainnet,
  ]);

  const supplyAmount = useMemo(() => {
    const myAmount = BigNumber(currentReserve.walletBalance || '0');
    const poolAmount = BigNumber(currentReserve.reserve.supplyCap)
      .minus(BigNumber(currentReserve.reserve.totalLiquidity))
      .multipliedBy(SUPPLY_UI_SAFE_MARGIN);
    const formattedPoolAmount = poolAmount.lt(0) ? BigNumber(0) : poolAmount;
    const miniAmount = myAmount.gte(formattedPoolAmount)
      ? formattedPoolAmount
      : myAmount;
    const usdValue = miniAmount
      .multipliedBy(
        BigNumber(
          currentReserve.reserve.formattedPriceInMarketReferenceCurrency || '0',
        ),
      )
      .toString();
    return {
      isLteZero: miniAmount.lte(0),
      amount: miniAmount.toString(),
      usdValue,
    };
  }, [
    currentReserve.walletBalance,
    currentReserve.reserve.supplyCap,
    currentReserve.reserve.totalLiquidity,
    currentReserve.reserve.formattedPriceInMarketReferenceCurrency,
  ]);

  const showToSwap = useMemo(() => {
    return (
      new BigNumber(currentReserve.walletBalance || '0').lte(0) &&
      BigNumber(currentReserve.reserve.supplyCap)
        .minus(BigNumber(currentReserve.reserve.totalLiquidity))
        .gt(0)
    );
  }, [
    currentReserve.walletBalance,
    currentReserve.reserve.supplyCap,
    currentReserve.reserve.totalLiquidity,
  ]);

  const swapTokenId = useMemo(() => {
    if (isNativeToken) {
      return (
        chainInfo?.nativeTokenAddress || currentReserve.reserve.underlyingAsset
      );
    }
    return currentReserve.reserve.underlyingAsset;
  }, [
    chainInfo?.nativeTokenAddress,
    currentReserve.reserve.underlyingAsset,
    isNativeToken,
  ]);

  const openSwap = useCallback(async () => {
    if (!currentAccount || !swapTokenId) {
      return;
    }

    if (onBeforeSwapNavigate) {
      onBeforeSwapNavigate();
    }

    await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.SwapBridge,
      params: {
        activeTab: 'swap',
        chainEnum: chainEnum || CHAINS_ENUM.ETH,
        tokenId: swapTokenId,
        type: 'Buy',
      },
    });
  }, [chainEnum, currentAccount, onBeforeSwapNavigate, swapTokenId]);

  const handleOpenSwap = useMemo(
    () =>
      debounce(openSwap, 800, {
        leading: true,
        trailing: false,
      }),
    [openSwap],
  );

  useEffect(() => {
    return () => {
      handleOpenSwap.cancel();
    };
  }, [handleOpenSwap]);

  const txsForMiniApproval: Tx[] = useMemo(() => {
    const list: any[] = [];
    if (approveTxs?.length) {
      list.push(...approveTxs);
    }
    if (supplyTx) {
      list.push(supplyTx);
    }
    return list as Tx[];
  }, [approveTxs, supplyTx]);

  const {
    openDirect,
    prefetch: prefetchMiniSigner,
    instance: miniSignInstance,
  } = useMiniSigner({
    account: currentAccount!,
    chainServerId: txsForMiniApproval.length
      ? txsForMiniApproval?.[0]?.chainId + ''
      : '',
    autoResetGasStoreOnChainChange: true,
  });

  const { ctx } = useSignatureStoreOf(miniSignInstance);

  // 执行supply交易
  const handleSupply = useCallback(
    async (forceFullSign?: boolean) => {
      if (!currentAccount || !supplyTx || !amount || isZeroAmount(amount)) {
        return;
      }

      try {
        setIsLoading(true);
        if (!txsForMiniApproval?.length) {
          toast.info('please retry');
          throw new Error('no txs');
        }
        let results: string[] = [];
        const signType =
          canShowDirectSubmit && !forceFullSign
            ? LendingSignType.Simplified
            : LendingSignType.Full;
        if (canShowDirectSubmit && !forceFullSign) {
          try {
            results = await openDirect({
              txs: txsForMiniApproval,
              ga: {
                customAction: CUSTOM_HISTORY_ACTION.LENDING,
                customActionTitleType: CUSTOM_HISTORY_TITLE_TYPE.LENDING_SUPPLY,
              },
            });
          } catch (error) {
            if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
              setAmount(undefined);
              onClose?.();
            }
            if (error === MINI_SIGN_ERROR.PREFETCH_FAILURE) {
              handleSupply(true);
            }
            return;
          }
        } else {
          for (const tx of txsForMiniApproval) {
            const result = await sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [tx],
                $ctx: {
                  ga: {
                    customAction: CUSTOM_HISTORY_ACTION.LENDING,
                    customActionTitleType:
                      CUSTOM_HISTORY_TITLE_TYPE.LENDING_SUPPLY,
                  },
                },
              },
              session: INTERNAL_REQUEST_SESSION,
              account: currentAccount,
            });
            results.push(result);
          }
        }
        const txId = last(results);
        if (txId && txsForMiniApproval[0]?.chainId) {
          transactionHistoryService.setCustomTxItem(
            currentAccount.address,
            txsForMiniApproval[0].chainId,
            txId,
            { actionType: CUSTOM_HISTORY_TITLE_TYPE.LENDING_SUPPLY },
          );
        }

        const usdValue = new BigNumber(amount || '0')
          .multipliedBy(
            BigNumber(
              currentReserve.reserve.formattedPriceInMarketReferenceCurrency ||
                '0',
            ),
          )
          .toString();

        stats.report('aaveInternalTx', {
          tx_type: LendingReportType.Supply,
          chain: chainInfo?.serverId || '',
          tx_id: txId || '',
          user_addr: currentAccount.address || '',
          address_type: currentAccount.type || '',
          usd_value: usdValue,
          create_at: Date.now(),
          app_version: APP_VERSIONS.fromNative || '0',
          signType,
        });

        refresh();
        toast.success(
          `${t('page.Lending.supplyDetail.actions')} ${t(
            'page.Lending.submitted',
          )}`,
        );
        setAmount(undefined);
        onClose?.();
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentAccount,
      supplyTx,
      amount,
      txsForMiniApproval,
      canShowDirectSubmit,
      currentReserve.reserve.formattedPriceInMarketReferenceCurrency,
      chainInfo?.serverId,
      refresh,
      t,
      onClose,
      openDirect,
    ],
  );

  useEffect(() => {
    checkApproveStatus();
  }, [checkApproveStatus]);

  useEffect(() => {
    buildTransactions();
  }, [buildTransactions]);

  useEffect(() => {
    if (currentAccount?.address && canShowDirectSubmit) {
      prefetchMiniSigner({
        txs: txsForMiniApproval?.length ? txsForMiniApproval : [],
        synGasHeaderInfo: true,
      });
    }
  }, [
    canShowDirectSubmit,
    currentAccount?.address,
    txsForMiniApproval,
    prefetchMiniSigner,
  ]);

  const emptyAmount = !supplyAmount.amount || supplyAmount.amount === '0';

  return (
    <SignatureInstanceProvider instance={miniSignInstance}>
      <AutoLockView as="View" style={styles.container}>
        <Text style={styles.title}>
          {t('page.Lending.supplyDetail.actions')}{' '}
          {currentReserve.reserve.symbol}
        </Text>
        <View style={styles.amountHeader}>
          <Text style={styles.amountHeaderTitle}>
            {t('page.Lending.popup.amount')}
          </Text>
          <View style={styles.amountHeaderRight}>
            <Text
              style={[
                styles.amountValueDescription,
                emptyAmount && styles.amountValueDescriptionDanger,
              ]}>{`${formatTokenAmount(supplyAmount.amount || '0')}${
              currentReserve.reserve.symbol
            }($${
              supplyAmount.isLteZero
                ? '0'
                : formatAmountValueKMB(supplyAmount.usdValue || '0')
            }) ${t('page.Lending.popup.available')}`}</Text>
            {showToSwap ? (
              <TouchableOpacity activeOpacity={1} onPress={handleOpenSwap}>
                <Text style={styles.toSwapText}>
                  {t('page.Lending.popup.toSwap')}→
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <TokenAmountInput
          value={amount}
          onChange={v => {
            if (directSignBtnRef.current?.isAuthInProgress()) {
              return;
            }
            setAmount(v);
          }}
          symbol={currentReserve.reserve.symbol}
          handleClickMaxButton={() => {
            setAmount(supplyAmount.amount || '0');
          }}
          tokenAmount={Number(supplyAmount.amount || '0')}
          tokenDecimals={currentReserve.reserve.decimals}
          price={Number(
            currentReserve.reserve.formattedPriceInMarketReferenceCurrency ||
              '0',
          )}
          style={styles.amountInput}
          chain={chainEnum || CHAINS_ENUM.ETH}
          tokenSelectContent={
            tokenOptions?.length ? (
              <PositionTokenSelector
                type="balance"
                triggerVariant="pill"
                activeUnderlyingAsset={activeUnderlyingAsset}
                options={tokenOptions as BalancePositionTokenOption[]}
                symbol={currentReserve.reserve.symbol}
                chain={currentReserve.chain}
                onChange={handleChangeActiveUnderlyingAsset}
              />
            ) : undefined
          }
        />
        <BottomSheetScrollView
          style={styles.bottomSheetScrollView}
          contentContainerStyle={styles.transactionContainer}>
          <SupplyActionOverView
            reserve={currentReserve}
            userSummary={userSummary}
            afterHF={afterHF}
            afterAvailable={afterAvailable}
          />

          {!!amount && !isZeroAmount(amount) && canShowDirectSubmit && (
            <View style={styles.gasPreContainer}>
              <DirectSignGasInfo
                supportDirectSign={true}
                loading={false}
                openShowMore={noop}
                chainServeId={chainInfo?.serverId || ''}
                textColor={colors2024['neutral-title-1']}
              />
            </View>
          )}

          <ReserveErrorTip
            reserve={currentReserve}
            style={styles.reserveErrorTip}
          />
        </BottomSheetScrollView>

        <View style={styles.buttonContainer}>
          {canShowDirectSubmit ? (
            <DirectSignBtn
              ref={directSignBtnRef}
              loading={isLoading}
              loadingType="circle"
              key={`${currentReserve.underlyingAsset}-${amount}-${needApprove}`}
              showTextOnLoading
              wrapperStyle={styles.directSignBtn}
              authTitle={t('page.Lending.supplyDetail.actions')}
              title={`${t('page.Lending.supplyDetail.actions')} ${
                currentReserve.reserve.symbol
              }`}
              onFinished={() => handleSupply()}
              disabled={
                !amount ||
                isZeroAmount(amount) ||
                !supplyTx ||
                isLoading ||
                !currentAccount ||
                !!ctx?.disabledProcess
              }
              type="aave"
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              titleStyle={BOTTOM_BUTTON_WITH_ICON_TITLE_STYLE}
              iconColor={
                isLight ? colors2024['neutral-InvertHighlight'] : '#192945'
              }
              syncUnlockTime
              account={currentAccount}
              showHardWalletProcess
            />
          ) : (
            <Button
              type="aave"
              loadingType="circle"
              showTextOnLoading
              containerStyle={styles.fullWidthButton}
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
              onPress={() => handleSupply()}
              title={t('page.Lending.supplyDetail.actions')}
              loading={isLoading}
              disabled={
                !amount ||
                isZeroAmount(amount) ||
                !supplyTx ||
                isLoading ||
                !currentAccount
              }
            />
          )}
        </View>
      </AutoLockView>
    </SignatureInstanceProvider>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    // paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    paddingHorizontal: 20,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 36,
  },
  amountHeaderTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  amountValueDescription: {
    fontSize: 14,
    lineHeight: 18,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    flexShrink: 1,
    textAlign: 'right',
  },
  amountValueDescriptionDanger: {
    color: ctx.colors2024['red-default'],
  },
  amountHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  toSwapText: {
    color: ctx.colors2024['brand-default'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    flexShrink: 0,
  },
  amountInput: {
    marginTop: 12,
  },
  card: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    padding: 12,
    borderRadius: 16,
    width: '100%',
  },
  contentContainer: {
    paddingHorizontal: 16,
    width: '100%',
  },
  bottomSheetScrollView: {
    width: '100%',
  },
  transactionContainer: {
    gap: 12,
    width: '100%',
  },
  gasPreContainer: {
    paddingHorizontal: 8,
  },
  poolInfoContainer: {
    marginTop: 16,
  },
  userInfoContainer: {
    marginTop: 12,
    gap: 24,
  },
  tokenInfos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reserveErrorTip: {
    marginTop: 30,
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 0,
    fontFamily: 'SF Pro Rounded',
  },
  sectionContainer: {
    paddingBottom: 32,
    width: '100%',
  },
  section: {
    marginTop: 28,
    lineHeight: 24,
  },
  buttonContainer: {
    height:
      BOTTOM_BUTTON_TOP_OFFSET +
      BOTTOM_BUTTON_SINGLE_HEIGHT +
      getBottomButtonBottomOffset(ctx.safeAreaInsets.bottom),
    marginTop: 'auto',
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingBottom: getBottomButtonBottomOffset(ctx.safeAreaInsets.bottom),
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  fullWidthButton: {
    flex: 1,
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
  },
  directSignBtn: {
    width: '100%',
  },
  button: {
    flex: 1,
  },
  leftTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repayButton: {
    borderWidth: 0,
    backgroundColor: ctx.colors2024['neutral-line'],
  },
}));
