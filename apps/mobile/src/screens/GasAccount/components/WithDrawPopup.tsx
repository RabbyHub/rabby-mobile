import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatUsdValue } from '@/utils/number';
import { openapi } from '@/core/request';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  useGasAccountHistoryRefresh,
  useGasAccountSign,
  useGasBalanceRefresh,
} from '../hooks/atom';
import { toast } from '@/components/Toast';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { Button } from '@/components2024/Button';
import { DestinationChain, RecipientAddress } from './WithdrawSelectPopup';
import { useWithdrawData } from '../hooks/withdraw';
import {
  RechargeChainItem,
  WithdrawListAddressItem,
} from '@rabby-wallet/rabby-api/dist/types';
import RcHelpCC from '@/assets2024/icons/common/help.svg';

const WithDrawInitContent = ({
  balance,
  onClose,
  onAfterConfirm,
}: {
  balance: number;
  onClose: () => void;
  onAfterConfirm: () => void;
}) => {
  const { t } = useTranslation();
  const { sig, accountId } = useGasAccountSign();
  const [loading, setLoading] = useState(false);
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { refresh: refreshGasAccountBalance } = useGasBalanceRefresh();

  const { refresh: refreshGasAccountHistory } = useGasAccountHistoryRefresh();

  const [chain, setChain] = useState<RechargeChainItem>();

  const { withdrawList, loading: withdrawDataLoading } = useWithdrawData();

  const [selectAddressChainList, setSelectAddressChainList] =
    useState<WithdrawListAddressItem>();

  const changeSelectedWithdraw = React.useCallback(
    (item: WithdrawListAddressItem) => {
      setSelectAddressChainList(pre => {
        if (pre?.recharge_addr !== item.recharge_addr) {
          setChain(undefined);
        }
        return item;
      });
    },
    [],
  );

  if (!selectAddressChainList && withdrawList?.length) {
    setSelectAddressChainList(withdrawList[0]);
  }

  const withdraw = async () => {
    if (!sig || !accountId || loading) {
      return;
    }
    if (balance <= 0 || !selectAddressChainList || !chain) {
      onClose();
      onAfterConfirm?.();
      return;
    }
    try {
      setLoading(true);
      onAfterConfirm?.();
      const amount = Math.min(balance, chain.withdraw_limit);
      const res: any = await openapi.withdrawGasAccount({
        sig: sig!,
        account_id: accountId!,
        amount,
        user_addr: selectAddressChainList.recharge_addr,
        fee: chain.withdraw_fee,
        chain_id: chain.chain_id,
      });
      if (!res.success) {
        throw new Error(res?.msg || 'withdraw failed');
      }
      refreshGasAccountHistory();
      refreshGasAccountBalance();
      onClose();
      onAfterConfirm?.();
    } catch (error) {
      toast.info((error as any)?.message || String(error));
      console.error((error as any)?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  const BalanceSuffix = useMemo(() => {
    if (!chain) {
      return '';
    } else {
      const withdrawTotal = Math.min(balance, chain.withdraw_limit);
      const usdValue = formatUsdValue(withdrawTotal);
      return ` ${usdValue}`;
    }
  }, [balance, chain]);

  const withdrawBtnDisabledTips = useMemo(() => {
    if (!chain) {
      return '';
    }

    const withdrawTotal = Math.min(balance, chain.withdraw_limit);
    if (withdrawTotal < chain.withdraw_fee) {
      return `${t(
        'page.gasAccount.withdrawPopup.noEnoughGas',
      )} (~$${chain?.withdraw_fee.toFixed(2)})`;
    }

    if (withdrawTotal > chain.l1_balance) {
      return t('page.gasAccount.withdrawPopup.noEnoughValuetBalance');
    }

    return '';
  }, [t, chain, balance]);

  // const receiveTips = () => {
  //   const modalId = createGlobalBottomSheetModal2024({
  //     name: MODAL_NAMES.DESCRIPTION,
  //     title: t('page.gasAccount.withdrawPopup.riskMessageFromChain'),
  //     sections: [],
  //     bottomSheetModalProps: {
  //       enableContentPanningGesture: true,
  //       enablePanDownToClose: true,
  //       enableDismissOnClose: true,
  //       snapPoints: ['30%'],
  //     },
  //     titleStyle: styles.tips,
  //     nextButtonProps: {
  //       title: (
  //         <Text style={styles.closeModalBtnText}>
  //           {t('page.gasAccount.withdrawPopup.tipsBtn')}
  //         </Text>
  //       ),
  //       onPress: () => {
  //         removeGlobalBottomSheetModal2024(modalId);
  //       },
  //     },
  //   });
  // };

  return (
    <View style={styles.container}>
      <View style={styles.paddingContainer}>
        <Text style={styles.title}>
          {t('page.gasAccount.withdrawPopup.title')}
        </Text>

        <Text style={[styles.label, { marginTop: 0 }]}>
          {t('page.gasAccount.withdrawPopup.recipientAddress')}
        </Text>

        <View style={styles.labelContent}>
          <RecipientAddress
            address={selectAddressChainList?.recharge_addr}
            onChange={changeSelectedWithdraw}
            list={withdrawList}
          />
        </View>

        <Text style={styles.label}>
          {t('page.gasAccount.withdrawPopup.destinationChain')}
        </Text>

        <View style={styles.labelContent}>
          <DestinationChain
            chain={chain}
            onSelect={setChain}
            list={selectAddressChainList?.recharge_chain_list}
          />
        </View>

        {!!withdrawBtnDisabledTips && (
          <View
            style={[
              styles.receiveTipsRow,
              {
                marginTop: 44,
              },
            ]}>
            <Text style={[styles.receiveTips, styles.errorTips]}>
              {withdrawBtnDisabledTips}
            </Text>
            <RcHelpCC width={20} color={colors2024['neutral-info']} />
          </View>
        )}

        {!!BalanceSuffix && (
          <View
            style={[
              styles.receiveTipsRow,
              {
                marginTop: 30,
              },
            ]}>
            <Text style={styles.receiveTips}>
              {t('page.gasAccount.withdrawPopup.deductGasFees')}{' '}
              {` ~$${chain?.withdraw_fee.toFixed(2)}`}
            </Text>
            <RcHelpCC width={20} color={colors2024['neutral-info']} />
          </View>
        )}
      </View>
      <View style={styles.btnContainer}>
        <Button
          type="primary"
          containerStyle={styles.confirmButton}
          onPress={withdraw}
          loading={loading}
          disabled={
            !!withdrawBtnDisabledTips || !chain || !selectAddressChainList
          }
          title={`${t('page.gasAccount.withdrawPopup.title')} ${BalanceSuffix}`}
        />
      </View>
    </View>
  );
};

export const WithDrawPopup = props => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const confirmModalRef = useRef<AppBottomSheetModal>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!props?.visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [props?.visible]);

  useEffect(() => {
    if (!showConfirm) {
      confirmModalRef.current?.close();
    } else {
      modalRef.current?.close();
      confirmModalRef.current?.present();
    }
  }, [showConfirm]);

  const onAfterConfirm = () => {
    setShowConfirm(true);
  };

  return (
    <>
      <AppBottomSheetModal
        snapPoints={[492]}
        onDismiss={props.onCancel || props.onClose}
        ref={modalRef}
        {...makeBottomSheetProps({
          linearGradientType: 'linear',
          colors: colors2024,
        })}>
        <BottomSheetView style={styles.popup}>
          <WithDrawInitContent
            balance={props.balance}
            onAfterConfirm={onAfterConfirm}
            onClose={props.onCancel || props.onClose}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    width: '100%',
    flex: 1,
    backgroundColor: colors['neutral-bg-1'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  paddingContainer: {
    width: '100%',
    flex: 1,
    backgroundColor: colors['neutral-bg-1'],
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 20,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    color: colors['green-default'],
  },
  description: {
    textAlign: 'center',
    fontSize: 14,
    color: colors['neutral-body'],
  },
  label: {
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
  },
  labelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 30,
    width: '100%',
    height: 62,
    paddingHorizontal: 20,
  },
  textContent: {
    fontSize: 15,
    color: colors['neutral-title1'],
    fontWeight: '500',
  },
  btnContainer: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 35,
  },
  confirmButton: {
    width: '100%',
    height: 52,
  },
  debankBtn: {
    color: colors['neutral-title2'],
    backgroundColor: '#FF7C60', //colors['orange-dbk'],
    fontSize: 16,
    fontWeight: '500',
  },
  jumpBtnIcon: {
    width: 16,
    height: 16,
  },
  popup: {
    // justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    // paddingVertical: 10,
  },
  confirmIcon: {
    marginTop: 16,
    width: 32,
    height: 32,
  },
  receiveTipsRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    marginTop: 30,
  },

  receiveTips: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },

  errorTips: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
  },

  tips: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'left',
  },

  closeModalBtnText: {
    fontSize: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
