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
import { last, noop } from 'lodash';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMiniApproval } from '@/hooks/useMiniApproval';
import { toast } from '@/components2024/Toast';
import { useAtom } from 'jotai';
import { directSigningAtom } from '@/hooks/useMiniApprovalDirectSign';
import RepayActionOverView from './RepayActionOverView';
import { parseUnits } from 'viem';
import { calculateHFAfterRepay } from '../../utils/hfUtils';
import { getERC20Allowance } from '@/core/apis/provider';
import { CustomMarket, marketsData } from '../../config/market';
import { approveToken } from '@/core/apis/approvals';
import { ETH_USDT_CONTRACT } from '@/constant/swap';

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
  const [approveTxs, setApproveTxs] = useState<any>(null);

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { formattedPoolReservesAndIncentives } = useLendingSummary();
  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );
  const [isDirectSigning, setDirectSigning] = useAtom(directSigningAtom);

  const { prepareMiniTransactions, sendPrepareMiniTransactions } =
    useMiniApproval();

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
      usdPrice: reserve.reserve.priceInUSD,
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

  const handleRepay = useCallback(async () => {
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
      if (isDirectSigning) {
        return;
      } else {
        setDirectSigning(true);
      }

      const res = await sendPrepareMiniTransactions({
        directSubmit: true,
      });
      last(res)?.txHash || '';

      setAmount(undefined);
      onClose?.();
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, [
    currentAccount,
    txsForMiniApproval?.length,
    amount,
    isDirectSigning,
    sendPrepareMiniTransactions,
    onClose,
    setDirectSigning,
  ]);

  const repayAmount = useMemo(() => {
    const miniAmount = BigNumber(reserve?.walletBalance || '0').gt(
      reserve.variableBorrows,
    )
      ? reserve.variableBorrows
      : reserve.walletBalance;
    const usdValue = BigNumber(miniAmount || '0')
      .multipliedBy(reserve.reserve.priceInUSD)
      .toString();
    return {
      amount: miniAmount,
      usdValue,
    };
  }, [
    reserve.walletBalance,
    reserve.variableBorrows,
    reserve.reserve.priceInUSD,
  ]);

  const afterRepayAmount = useMemo(() => {
    return BigNumber(reserve.variableBorrows)
      .minus(amount || '0')
      .toString();
  }, [amount, reserve.variableBorrows]);

  const afterRepayUsdValue = useMemo(() => {
    return BigNumber(afterRepayAmount || '0')
      .multipliedBy(reserve.reserve.priceInUSD)
      .toString();
  }, [afterRepayAmount, reserve.reserve.priceInUSD]);

  useEffect(() => {
    checkApproveStatus();
  }, [checkApproveStatus]);

  useEffect(() => {
    buildTransactions();
  }, [buildTransactions]);

  useEffect(() => {
    if (currentAccount && canShowDirectSubmit && amount && amount !== '0') {
      prepareMiniTransactions({
        txs: txsForMiniApproval?.length ? txsForMiniApproval : [],
        directSubmit: true,
        account: currentAccount!,
        checkGasFee: true,
        showMaskLoading: true,
      });
    }
  }, [
    prepareMiniTransactions,
    canShowDirectSubmit,
    currentAccount,
    amount,
    txsForMiniApproval,
  ]);

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>Repay {reserve.reserve.symbol}</Text>
      <View style={styles.amountHeader}>
        <Text style={styles.amountHeaderTitle}>Amount</Text>
        <Text style={styles.amountValueDescription}>{`${formatAmountValueKMB(
          repayAmount.amount || '0',
        )} ${reserve.reserve.symbol} ($${formatAmountValueKMB(
          repayAmount.usdValue || '0',
        )}) available`}</Text>
      </View>
      <TokenAmountInput
        value={amount}
        onChange={setAmount}
        symbol={reserve.reserve.symbol}
        handleClickMaxButton={() => {
          setAmount(repayAmount.amount || '0');
        }}
        tokenAmount={Number(repayAmount.amount || '0')}
        price={Number(reserve.reserve.priceInUSD || '0')}
        style={styles.amountInput}
        chain={CHAINS_ENUM.ETH}
      />
      <BottomSheetScrollView
        contentContainerStyle={styles.transactionContainer}>
        <RepayActionOverView
          reserve={reserve}
          userSummary={userSummary}
          afterRepayAmount={afterRepayAmount}
          afterRepayUsdValue={afterRepayUsdValue}
          afterHF={afterHF}
        />

        {!!amount && amount !== '0' && (
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
        <DirectSignBtn
          loading={isLoading}
          loadingType="circle"
          key={`${amount}-${needApprove}`}
          showTextOnLoading
          wrapperStyle={styles.directSignBtn}
          authTitle="Repay"
          title={
            !amount || amount === '0'
              ? 'Enter Amount'
              : needApprove
              ? 'Approve and Repay'
              : 'Repay'
          }
          onFinished={handleRepay}
          disabled={
            !amount ||
            amount === '0' ||
            !txsForMiniApproval?.length ||
            isLoading ||
            !currentAccount
          }
          type="primary"
          syncUnlockTime
          account={currentAccount}
          showHardWalletProcess
        />
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
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  amountValueDescription: {
    fontSize: 14,
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
  transactionContainer: {
    gap: 12,
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
  symbol: {
    fontSize: 17,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenInfos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  poolInfoItems: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  poolInfoItem: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  poolInfoItemTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  poolInfoItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 0,
    fontFamily: 'SF Pro Rounded',
  },
  supplyItemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  supplyItemValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  userInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfoItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  userInfoItemValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
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
  sectionTitle: {
    marginBottom: 5,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  sectionDesc: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: ctx.colors2024['neutral-foot'],
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
  gasInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gasInfoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  gasInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  gasInfoNote: {
    fontSize: 12,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 4,
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
  repayButtonTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  borrowButtonTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
