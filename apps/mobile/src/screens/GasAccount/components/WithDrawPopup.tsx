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
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Button } from '@/components2024/Button';
import { DestinationChain, RecipientAddress } from './WithdrawSelectPopup';
import { useWithdrawData } from '../hooks/withdraw';
import IconHelp from '@/assets2024/icons/gas-account/help.svg';
import {
  RechargeChainItem,
  WithdrawListAddressItem,
} from '@rabby-wallet/rabby-api/dist/types';
import LinearGradient from 'react-native-linear-gradient';
import { GiftInfoModal } from './GiftInfoModal';

const WithDrawInitContent = ({
  balance,
  onClose,
  onAfterConfirm,
  nonWithdrawableBalance,
}: {
  balance: number;
  nonWithdrawableBalance: number;
  onClose: () => void;
  onAfterConfirm: () => void;
}) => {
  const { t } = useTranslation();
  const { sig, accountId } = useGasAccountSign();
  const [loading, setLoading] = useState(false);
  const [showGiftInfo, setShowGiftInfo] = useState(false);
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { refresh: refreshGasAccountBalance } = useGasBalanceRefresh();

  const { refresh: refreshGasAccountHistory } = useGasAccountHistoryRefresh();

  const [chain, setChain] = useState<RechargeChainItem>();

  const { withdrawList, loading: withdrawLoading } = useWithdrawData();

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

  const withdraw = React.useCallback(async () => {
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
  }, [
    sig,
    accountId,
    loading,
    balance,
    selectAddressChainList,
    chain,
    onClose,
    onAfterConfirm,
    refreshGasAccountHistory,
    refreshGasAccountBalance,
  ]);

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
      return t('page.gasAccount.withdrawPopup.noEnoughValueBalance');
    }

    return '';
  }, [t, chain, balance]);

  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
      locations={[0.0745, 0.2242]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1, position: 'relative' }}>
      <View style={styles.container}>
        <View style={styles.paddingContainer}>
          <Text style={styles.title}>
            {t('page.gasAccount.withdrawPopup.title')}
          </Text>
          <View style={styles.tipText}>
            <Text style={styles.tipTextContent}>
              {t('page.gasAccount.withdrawPopup.availableBalance', {
                balance: formatUsdValue(balance),
              })}
            </Text>
            {nonWithdrawableBalance ? (
              <IconHelp
                width={16}
                height={16}
                onPress={() => {
                  setShowGiftInfo(true);
                }}
              />
            ) : null}
          </View>

          <Text style={[styles.label, { marginTop: 0 }]}>
            {t('page.gasAccount.withdrawPopup.recipientAddress')}
          </Text>

          <View style={styles.labelContent}>
            <RecipientAddress
              address={selectAddressChainList?.recharge_addr}
              onChange={changeSelectedWithdraw}
              list={withdrawList}
              loading={withdrawLoading}
            />
          </View>

          <Text style={styles.label}>
            {t('page.gasAccount.withdrawPopup.destinationChain')}
          </Text>

          <View style={[styles.labelContent]}>
            <DestinationChain
              chain={chain}
              onSelect={setChain}
              list={selectAddressChainList?.recharge_chain_list}
            />
          </View>
        </View>
        <View style={styles.btnContainer}>
          {!!withdrawBtnDisabledTips && (
            <View
              style={[
                styles.receiveTipsRow,
                {
                  marginBottom: 18,
                },
              ]}>
              <Text style={[styles.receiveTips, styles.errorTips]}>
                {withdrawBtnDisabledTips}
              </Text>
            </View>
          )}

          {!withdrawBtnDisabledTips && !!BalanceSuffix && (
            <View
              style={[
                styles.receiveTipsRow,
                {
                  marginBottom: 22,
                },
              ]}>
              <Text style={styles.receiveTips}>
                {t('page.gasAccount.withdrawPopup.deductGasFees')}{' '}
                {` ~$${chain?.withdraw_fee.toFixed(2)}`}
              </Text>
              {nonWithdrawableBalance ? (
                <IconHelp
                  width={20}
                  height={20}
                  onPress={() => {
                    setShowGiftInfo(true);
                  }}
                />
              ) : null}
            </View>
          )}
          <Button
            type="primary"
            containerStyle={styles.confirmButton}
            onPress={withdraw}
            loading={loading}
            disabled={
              !!withdrawBtnDisabledTips || !chain || !selectAddressChainList
            }
            title={`${t(
              'page.gasAccount.withdrawPopup.title',
            )} ${BalanceSuffix}`}
          />
        </View>
      </View>
      <GiftInfoModal
        snapPoints={[270]}
        visible={showGiftInfo}
        onClose={() => setShowGiftInfo(false)}
        header={
          <Text style={styles.giftInfoHeader}>
            {t('component.gasAccount.giftInfo.noWithdrawableBalanceTitle', {
              amount: formatUsdValue(nonWithdrawableBalance),
            })}
          </Text>
        }
        description={
          <Text style={styles.giftInfoDescription}>
            {t(
              'component.gasAccount.giftInfo.noWithdrawableBalanceDescription',
              {
                amount: formatUsdValue(nonWithdrawableBalance),
              },
            )}
          </Text>
        }
      />
    </LinearGradient>
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
          linearGradientType: 'bg1',
          colors: colors2024,
        })}>
        <BottomSheetView style={styles.popup}>
          <WithDrawInitContent
            balance={props.balance}
            nonWithdrawableBalance={props.nonWithdrawableBalance}
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
    // backgroundColor: colors['neutral-bg-1'],
    justifyContent: 'center',
    alignItems: 'center',
  },

  paddingContainer: {
    width: '100%',
    flex: 1,
    // backgroundColor: colors['neutral-bg-1'],
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  giftInfoHeader: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 8,
  },
  giftInfoDescription: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    textAlign: 'center',
  },
  tipText: {
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tipTextContent: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
  },
  title: {
    marginTop: 12,
    marginBottom: 16,
    color: colors['neutral-title1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
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

  btnContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 35,
  },

  confirmButton: {
    width: '100%',
    height: 52,
  },

  popup: {
    margin: 0,
    height: '100%',
  },

  receiveTipsRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
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
}));
