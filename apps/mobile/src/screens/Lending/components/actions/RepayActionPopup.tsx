import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { PopupDetailProps } from '../../type';
import { formatAmountValueKMB } from '@/screens/TokenDetail/util';
import { TokenAmountInput } from './TokenAmountInput';
import { CHAINS_ENUM } from '@debank/common';
import { useLendingSummary } from '../../hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { buildRepayTx } from '../../poolService';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { findChain } from '@/utils/chain';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { toast } from '@/components2024/Toast';
import RepayActionOverView from './RepayActionOverView';
import { parseUnits } from 'viem';
import { calculateHFAfterRepay } from '../../utils/hfUtils';
import { getERC20Allowance } from '@/core/apis/provider';
import { CustomMarket, marketsData } from '../../config/market';
import { approveToken } from '@/core/apis/approvals';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import { useMiniSigner } from '@/hooks/useSigner';
import { last, noop } from 'lodash';
import { formatTokenAmount } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import { transactionHistoryService } from '@/core/services/shared';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import { useRefreshHistoryId } from '../../hooks';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { apiProvider } from '@/core/apis';
import { Button } from '@/components2024/Button';
import {
  MINI_SIGN_ERROR,
  useSignatureStore,
} from '@/components2024/MiniSignV2/state/SignatureManager';

export const RepayActionPopup: React.FC<PopupDetailProps> = ({
  reserve,
  userSummary,
  onClose,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [amount, setAmount] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [needApprove, setNeedApprove] = useState(false);
  const [repayTx, setRepayTx] = useState<any>(null);
  const { refresh } = useRefreshHistoryId();
  const [approveTxs, setApproveTxs] = useState<any>(null);

  const { t } = useTranslation();

  const { ctx } = useSignatureStore();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const { formattedPoolReservesAndIncentives } = useLendingSummary();
  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );

  const afterHF = useMemo(() => {
    if (!amount || amount === '0') {
      return undefined;
    }
    const targetPool = formattedPoolReservesAndIncentives.find(item =>
      isSameAddress(item.underlyingAsset, reserve.underlyingAsset),
    );
    if (!targetPool) {
      return undefined;
    }
    return calculateHFAfterRepay({
      user: userSummary,
      amount,
      debt: reserve.variableBorrows,
      usdPrice: reserve.reserve.formattedPriceInMarketReferenceCurrency,
    }).toString();
  }, [amount, formattedPoolReservesAndIncentives, reserve, userSummary]);

  const checkApproveStatus = useCallback(async () => {
    if (!amount || amount === '0' || !currentAccount) {
      setNeedApprove(false);
      return;
    }

    try {
      const chainInfo = findChain({ serverId: 'eth' });
      if (!chainInfo) {
        return;
      }

      // 如果是原生代币，不需要approve
      if (
        isSameAddress(reserve.underlyingAsset, chainInfo.nativeTokenAddress)
      ) {
        setNeedApprove(false);
        return;
      }

      // 获取当前approve额度
      const allowance = await getERC20Allowance(
        chainInfo.serverId,
        reserve.underlyingAsset,
        marketsData[CustomMarket.proto_mainnet_v3].addresses.LENDING_POOL,
        currentAccount.address,
        currentAccount,
      );

      // 计算需要的额度（包含decimals）
      const requiredAmount = new BigNumber(amount)
        .multipliedBy(10 ** reserve.reserve.decimals)
        .toString();

      // 检查当前额度是否足够
      const isApproved = new BigNumber(allowance || '0').gte(requiredAmount);
      setNeedApprove(!isApproved);
    } catch (error) {
      console.error('Check approve status error:', error);
      setNeedApprove(true); // 出错时默认需要approve
    }
  }, [
    amount,
    reserve.underlyingAsset,
    reserve.reserve.decimals,
    currentAccount,
  ]);

  const buildTransactions = useCallback(async () => {
    if (!amount || amount === '0' || !currentAccount) {
      setRepayTx(null);
      setApproveTxs(null);
      return;
    }

    try {
      setIsLoading(true);
      const chainInfo = findChain({ serverId: 'eth' });
      if (!chainInfo) {
        return;
      }

      const targetPool = formattedPoolReservesAndIncentives.find(item =>
        isSameAddress(item.underlyingAsset, reserve.underlyingAsset),
      );

      const txs: any[] = [];

      let actualNeedApprove = false;
      let allowance = '0';
      if (
        !isSameAddress(reserve.underlyingAsset, chainInfo.nativeTokenAddress)
      ) {
        allowance = await getERC20Allowance(
          chainInfo.serverId,
          reserve.underlyingAsset,
          marketsData[CustomMarket.proto_mainnet_v3].addresses.LENDING_POOL,
          currentAccount.address,
          currentAccount,
        );

        const requiredAmount = new BigNumber(amount)
          .multipliedBy(10 ** reserve.reserve.decimals)
          .toString();

        actualNeedApprove = !new BigNumber(allowance || '0').gte(
          requiredAmount,
        );
      }

      // 如果需要approve，构建approve交易
      if (actualNeedApprove) {
        const requiredAmount = new BigNumber(amount)
          .multipliedBy(10 ** reserve.reserve.decimals)
          .toString();

        // 检查是否需要两步approve（针对以太坊上的USDT）
        let shouldTwoStepApprove = false;
        if (
          chainInfo?.enum === CHAINS_ENUM.ETH &&
          isSameAddress(reserve.underlyingAsset, ETH_USDT_CONTRACT) &&
          Number(allowance) !== 0 &&
          !new BigNumber(allowance || '0').gte(requiredAmount)
        ) {
          shouldTwoStepApprove = true;
        }

        // 如果需要两步approve，先执行0额度approve
        if (shouldTwoStepApprove) {
          const zeroApproveResult = await approveToken({
            chainServerId: chainInfo.serverId,
            id: reserve.underlyingAsset,
            spender:
              marketsData[CustomMarket.proto_mainnet_v3].addresses.LENDING_POOL,
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

        // 执行正常额度的approve
        const approveResult = await approveToken({
          chainServerId: chainInfo.serverId,
          id: reserve.underlyingAsset,
          spender:
            marketsData[CustomMarket.proto_mainnet_v3].addresses.LENDING_POOL,
          amount: requiredAmount,
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
        setApproveTxs(txs);
      }

      if (!targetPool?.aTokenAddress) {
        return;
      }
      const repayResult = await buildRepayTx({
        amount: parseUnits(amount, targetPool.decimals).toString(),
        address: currentAccount.address,
        reserve: reserve.underlyingAsset,
      });
      delete repayResult.gasLimit;

      setRepayTx({
        ...repayResult,
        chainId: chainInfo.id,
      });
    } catch (error) {
      console.error('Build transactions error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    amount,
    currentAccount,
    formattedPoolReservesAndIncentives,
    reserve.reserve.decimals,
    reserve.underlyingAsset,
  ]);

  const txsForMiniApproval: Tx[] = useMemo(() => {
    const list: any[] = [];
    if (approveTxs?.length) {
      list.push(...approveTxs);
    }
    if (repayTx) {
      list.push(repayTx);
    }
    return list as Tx[];
  }, [approveTxs, repayTx]);

  const { openDirect, prefetch: prefetchMiniSigner } = useMiniSigner({
    account: currentAccount!,
    chainServerId: txsForMiniApproval.length
      ? txsForMiniApproval?.[0]?.chainId + ''
      : '',
    autoResetGasStoreOnChainChange: true,
  });

  const handleRepay = useCallback(
    async (forceFullSign?: boolean) => {
      if (
        !currentAccount ||
        !txsForMiniApproval?.length ||
        !amount ||
        amount === '0'
      ) {
        return;
      }

      try {
        setIsLoading(true);
        if (!txsForMiniApproval?.length) {
          toast.info('please retry');
          throw new Error('no txs');
        }
        let results: string[] = [];
        if (canShowDirectSubmit && !forceFullSign) {
          try {
            results = await openDirect({
              txs: txsForMiniApproval,
              ga: {
                customAction: CUSTOM_HISTORY_ACTION.LENDING,
                customActionTitleType: CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY,
              },
            });
          } catch (error) {
            if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
              setAmount(undefined);
              onClose?.();
              return;
            }
            if (error === MINI_SIGN_ERROR.PREFETCH_FAILURE) {
              handleRepay(true);
              return;
            }
          }
        } else {
          for (const tx of txsForMiniApproval) {
            const result = await apiProvider.sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [tx],
                $ctx: {
                  ga: {
                    customAction: CUSTOM_HISTORY_ACTION.LENDING,
                    customActionTitleType:
                      CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY,
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
        if (txId) {
          transactionHistoryService.setCustomTxItem(
            currentAccount.address,
            txsForMiniApproval[0].chainId,
            txId,
            { actionType: CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY },
          );
        }
        refresh();
        toast.success(
          `${t('page.Lending.repayDetail.actions')} ${t(
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
      txsForMiniApproval,
      amount,
      canShowDirectSubmit,
      refresh,
      t,
      onClose,
      openDirect,
    ],
  );

  const repayAmount = useMemo(() => {
    const miniAmount = BigNumber(reserve?.walletBalance || '0').gt(
      reserve.variableBorrows,
    )
      ? reserve.variableBorrows
      : reserve.walletBalance;
    const usdValue = BigNumber(miniAmount || '0')
      .multipliedBy(reserve.reserve.formattedPriceInMarketReferenceCurrency)
      .toString();
    return {
      amount: miniAmount,
      usdValue,
    };
  }, [
    reserve.walletBalance,
    reserve.variableBorrows,
    reserve.reserve.formattedPriceInMarketReferenceCurrency,
  ]);

  const afterRepayAmount = useMemo(() => {
    return BigNumber(reserve.variableBorrows)
      .minus(amount || '0')
      .toString();
  }, [amount, reserve.variableBorrows]);

  const afterRepayUsdValue = useMemo(() => {
    return BigNumber(afterRepayAmount || '0')
      .multipliedBy(reserve.reserve.formattedPriceInMarketReferenceCurrency)
      .toString();
  }, [
    afterRepayAmount,
    reserve.reserve.formattedPriceInMarketReferenceCurrency,
  ]);

  useEffect(() => {
    checkApproveStatus();
  }, [checkApproveStatus]);

  useEffect(() => {
    buildTransactions();
  }, [buildTransactions]);

  useEffect(() => {
    if (currentAccount && canShowDirectSubmit && amount && amount !== '0') {
      prefetchMiniSigner({
        txs: txsForMiniApproval?.length ? txsForMiniApproval : [],
        synGasHeaderInfo: true,
      });
    }
  }, [
    canShowDirectSubmit,
    currentAccount,
    amount,
    txsForMiniApproval,
    prefetchMiniSigner,
  ]);

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>
        {t('page.Lending.repayDetail.actions')} {reserve.reserve.symbol}
      </Text>
      <View style={styles.amountHeader}>
        <Text style={styles.amountHeaderTitle}>
          {t('page.Lending.popup.amount')}
        </Text>
        <Text style={styles.amountValueDescription}>{`${formatTokenAmount(
          repayAmount.amount || '0',
        )} ${reserve.reserve.symbol} ($${formatAmountValueKMB(
          repayAmount.usdValue || '0',
        )}) ${t('page.Lending.popup.available')}`}</Text>
      </View>
      <TokenAmountInput
        value={amount}
        onChange={setAmount}
        symbol={reserve.reserve.symbol}
        handleClickMaxButton={() => {
          setAmount(repayAmount.amount || '0');
        }}
        tokenAmount={Number(repayAmount.amount || '0')}
        price={Number(
          reserve.reserve.formattedPriceInMarketReferenceCurrency || '0',
        )}
        style={styles.amountInput}
        chain={CHAINS_ENUM.ETH}
      />
      <BottomSheetScrollView
        style={styles.bottomSheetScrollView}
        contentContainerStyle={styles.transactionContainer}>
        <RepayActionOverView
          reserve={reserve}
          amount={amount}
          userSummary={userSummary}
          afterRepayAmount={afterRepayAmount}
          afterRepayUsdValue={afterRepayUsdValue}
          afterHF={afterHF}
        />

        {!!amount && amount !== '0' && canShowDirectSubmit && (
          <View style={styles.gasPreContainer}>
            <DirectSignGasInfo
              supportDirectSign={true}
              loading={isLoading}
              openShowMore={noop}
              chainServeId="eth"
            />
          </View>
        )}
      </BottomSheetScrollView>

      <View style={styles.buttonContainer}>
        {canShowDirectSubmit ? (
          <DirectSignBtn
            loading={isLoading}
            loadingType="circle"
            key={`${amount}-${needApprove}`}
            showTextOnLoading
            wrapperStyle={styles.directSignBtn}
            authTitle={t('page.Lending.repayDetail.actions')}
            title={`${t('page.Lending.repayDetail.actions')} ${
              reserve.reserve.symbol
            }`}
            onFinished={() => handleRepay()}
            disabled={
              !amount ||
              amount === '0' ||
              !txsForMiniApproval?.length ||
              isLoading ||
              !currentAccount ||
              !!ctx?.disabledProcess
            }
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
            title={`${t('page.Lending.repayDetail.actions')} ${
              reserve.reserve.symbol
            }`}
            loading={isLoading}
            disabled={
              !amount ||
              amount === '0' ||
              !txsForMiniApproval?.length ||
              isLoading ||
              !currentAccount
            }
          />
        )}
      </View>
    </AutoLockView>
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
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 0,
    fontFamily: 'SF Pro Rounded',
  },
  buttonContainer: {
    height: 116,
    paddingTop: 12,
    marginTop: 'auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
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
  fullWidthButton: {
    flex: 1,
  },
}));
