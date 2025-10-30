import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { PopupDetailProps } from '../../type';
import { formatAmountValueKMB } from '@/screens/TokenDetail/util';
import { TokenAmountInput } from './TokenAmountInput';
import { CHAINS_ENUM } from '@debank/common';
import { calculateHFAfterWithdraw } from '../../utils/hfUtils';
import { useLendingSummary } from '../../hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { buildWithdrawTx } from '../../poolService';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { findChain } from '@/utils/chain';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { last, noop } from 'lodash';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { toast } from '@/components2024/Toast';
import WithdrawActionOverView from './WithdrawActionOverView';
import {
  API_ETH_MOCK_ADDRESS,
  HF_RISK_CHECKBOX_THRESHOLD,
  MAX_CLICK_WITHDRAW_HF_THRESHOLD,
} from '../../utils/constant';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useMiniSigner } from '@/hooks/useSigner';
import { formatTokenAmount } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import { transactionHistoryService } from '@/core/services/shared';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import { useRefreshHistoryId } from '../../hooks';
import wrapperToken from '../../config/wrapperToken';
import { calculateMaxWithdrawAmount } from '../../utils/calculateMaxWithdrawAmount';

export const WithdrawActionPopup: React.FC<PopupDetailProps> = ({
  reserve,
  userSummary,
  onClose,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [amount, setAmount] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [withdrawTxs, setWithdrawTxs] = useState<Tx[]>([]);
  const [isChecked, setIsChecked] = useState(false);
  const { refresh } = useRefreshHistoryId();
  const { t } = useTranslation();
  const isNativeToken = useMemo(() => {
    return isSameAddress(reserve.underlyingAsset, API_ETH_MOCK_ADDRESS);
  }, [reserve.underlyingAsset]);

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { formattedPoolReservesAndIncentives, wrapperPoolReserve } =
    useLendingSummary();
  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );
  const { openDirect, prefetch: prefetchMiniSigner } = useMiniSigner({
    account: currentAccount!,
    chainServerId: withdrawTxs.length ? withdrawTxs?.[0]?.chainId + '' : '',
    autoResetGasStoreOnChainChange: true,
  });

  const afterHF = useMemo(() => {
    if (!amount || amount === '0') {
      return undefined;
    }
    const targetPool = formattedPoolReservesAndIncentives.find(item => {
      return isSameAddress(reserve.underlyingAsset, API_ETH_MOCK_ADDRESS)
        ? isSameAddress(
            item.underlyingAsset,
            wrapperToken[reserve.chain].address,
          )
        : isSameAddress(item.underlyingAsset, reserve.underlyingAsset);
    });
    if (!targetPool) {
      return undefined;
    }
    return calculateHFAfterWithdraw({
      user: userSummary,
      userReserve: reserve,
      poolReserve: targetPool,
      withdrawAmount: amount,
    }).toString();
  }, [amount, formattedPoolReservesAndIncentives, reserve, userSummary]);

  const withdrawAmount = useMemo(() => {
    const targetPool = formattedPoolReservesAndIncentives.find(item => {
      return isSameAddress(reserve.underlyingAsset, API_ETH_MOCK_ADDRESS)
        ? isSameAddress(
            item.underlyingAsset,
            wrapperToken[reserve.chain].address,
          )
        : isSameAddress(item.underlyingAsset, reserve.underlyingAsset);
    });
    if (!targetPool) {
      return 0;
    }
    return calculateMaxWithdrawAmount(
      userSummary,
      reserve,
      targetPool,
      MAX_CLICK_WITHDRAW_HF_THRESHOLD,
    ).toNumber();
  }, [formattedPoolReservesAndIncentives, userSummary, reserve]);

  const isRisky = useMemo(() => {
    if (!afterHF) {
      return false;
    }
    return Number(afterHF) < HF_RISK_CHECKBOX_THRESHOLD;
  }, [afterHF]);

  const afterSupply = useMemo(() => {
    if (!amount || amount === '0') {
      return undefined;
    }
    const balance = BigNumber(reserve.underlyingBalance || '0').minus(
      BigNumber(amount),
    );
    const balanceUSD = BigNumber(balance).multipliedBy(
      BigNumber(reserve.reserve.formattedPriceInMarketReferenceCurrency),
    );
    return {
      balance: balance.toString(),
      balanceUSD: balanceUSD.toString(),
    };
  }, [
    amount,
    reserve.reserve.formattedPriceInMarketReferenceCurrency,
    reserve.underlyingBalance,
  ]);

  const buildTransactions = useCallback(async () => {
    if (!amount || amount === '0' || !currentAccount) {
      setWithdrawTxs([]);
      return;
    }

    try {
      setIsLoading(true);
      const chainInfo = findChain({ serverId: 'eth' });
      if (!chainInfo) {
        return;
      }

      const targetPool = isNativeToken
        ? wrapperPoolReserve
        : formattedPoolReservesAndIncentives.find(item =>
            isSameAddress(item.underlyingAsset, reserve.underlyingAsset),
          );

      if (!targetPool?.aTokenAddress) {
        return;
      }
      const withdrawResult = await buildWithdrawTx({
        amount,
        address: currentAccount.address,
        reserve: targetPool.underlyingAsset,
        aTokenAddress: targetPool?.aTokenAddress || '',
      });
      const txs = await Promise.all(withdrawResult.map(i => i.tx()));
      const formatTxs = txs.map(item => {
        delete item.gasLimit;
        return {
          ...item,
          chainId: chainInfo.id,
        };
      });

      setWithdrawTxs(formatTxs as unknown as Tx[]);
    } catch (error) {
      console.error('Build transactions error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    amount,
    currentAccount,
    formattedPoolReservesAndIncentives,
    isNativeToken,
    reserve.underlyingAsset,
    wrapperPoolReserve,
  ]);

  // 执行withdraw交易
  const handleWithdraw = useCallback(async () => {
    if (!currentAccount || !withdrawTxs.length || !amount || amount === '0') {
      return;
    }

    try {
      setIsLoading(true);
      if (!withdrawTxs?.length) {
        toast.info('please retry');
        throw new Error('no txs');
      }
      const result = await openDirect({
        txs: withdrawTxs,
        ga: {
          customAction: CUSTOM_HISTORY_ACTION.LENDING,
          customActionTitleType: CUSTOM_HISTORY_TITLE_TYPE.LENDING_WITHDRAW,
        },
      });
      const txId = last(result);
      if (txId) {
        transactionHistoryService.setCustomTxItem(
          currentAccount.address,
          withdrawTxs[0].chainId,
          txId,
          { actionType: CUSTOM_HISTORY_TITLE_TYPE.LENDING_WITHDRAW },
        );
      }
      refresh();
      toast.success(
        `${t('page.Lending.withdrawDetail.actions')} ${t(
          'page.Lending.submitted',
        )}`,
      );

      setAmount(undefined);
      onClose?.();
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount, withdrawTxs, amount, openDirect, t, onClose, refresh]);

  useEffect(() => {
    buildTransactions();
  }, [buildTransactions]);

  useEffect(() => {
    if (currentAccount && canShowDirectSubmit && amount && amount !== '0') {
      prefetchMiniSigner({
        txs: withdrawTxs?.length ? withdrawTxs : [],
        synGasHeaderInfo: true,
      });
    }
  }, [
    canShowDirectSubmit,
    currentAccount,
    amount,
    withdrawTxs,
    prefetchMiniSigner,
  ]);

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>
        {t('page.Lending.withdrawDetail.actions')} {reserve.reserve.symbol}
      </Text>
      <View style={styles.amountHeader}>
        <Text style={styles.amountHeaderTitle}>
          {t('page.Lending.popup.amount')}
        </Text>
        <Text style={styles.amountValueDescription}>{`${formatTokenAmount(
          withdrawAmount.toString() || '0',
        )}${reserve.reserve.symbol}($${formatAmountValueKMB(
          BigNumber(withdrawAmount)
            .multipliedBy(
              BigNumber(
                reserve.reserve.formattedPriceInMarketReferenceCurrency,
              ),
            )
            .toString(),
        )}) ${t('page.Lending.popup.available')}`}</Text>
      </View>
      <TokenAmountInput
        value={amount}
        onChange={setAmount}
        symbol={reserve.reserve.symbol}
        handleClickMaxButton={() => {
          setAmount(withdrawAmount.toString() || '0');
        }}
        tokenAmount={withdrawAmount}
        price={Number(
          reserve.reserve.formattedPriceInMarketReferenceCurrency || '0',
        )}
        style={styles.amountInput}
        chain={CHAINS_ENUM.ETH}
      />
      <BottomSheetScrollView
        style={styles.bottomSheetScrollView}
        contentContainerStyle={styles.transactionContainer}>
        <WithdrawActionOverView
          reserve={reserve}
          userSummary={userSummary}
          afterHF={afterHF}
          amount={amount}
          afterSupply={afterSupply}
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
        {isRisky && (
          <>
            <View style={styles.warningContainer}>
              <RcIconWarningCircleCC
                width={15}
                height={15}
                color={colors2024['red-default']}
              />
              <Text style={styles.warningText}>
                {t('page.Lending.risk.withdrawWarning')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => {
                setIsChecked(prev => !prev);
              }}>
              <CheckBoxRect size={16} checked={isChecked} />
              <Text style={styles.checkboxText}>
                {t('page.Lending.risk.checkbox')}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <DirectSignBtn
          loading={isLoading}
          loadingType="circle"
          key={`${amount}`}
          showTextOnLoading
          wrapperStyle={styles.directSignBtn}
          authTitle={t('page.Lending.withdrawDetail.actions')}
          title={`${t('page.Lending.withdrawDetail.actions')} ${
            reserve.reserve.symbol
          }`}
          onFinished={handleWithdraw}
          disabled={
            !amount ||
            amount === '0' ||
            !withdrawTxs.length ||
            isLoading ||
            !currentAccount ||
            (isRisky && !isChecked)
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
    fontWeight: '900',
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
    paddingTop: 12,
    marginBottom: 48,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
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
  checkbox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  checkboxText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-foot'],
  },
  warningContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: ctx.colors2024['red-light-1'],
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
}));
