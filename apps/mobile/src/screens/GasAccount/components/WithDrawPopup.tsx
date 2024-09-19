import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { formatUsdValue } from '@/utils/number';
import { openapi } from '@/core/request';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
// import { GasAccountCloseIcon } from './PopupCloseIcon';
import IconJumpBtn from '@/assets/icons/gas-account/IconJumpBtn.svg';
import RcIconHasConfirmed from '@/assets/icons/gas-account/IconHasConfirmed.svg';
import { useGasAccountSign, useGasBalanceRefresh } from '../hooks/atom';
import { GasAccountCurrentAddress } from './LogoutPopup';
import { toast } from '@/components/Toast';
import { gotoDeBankAppL2 } from '../hooks';

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
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { refresh: refreshGasAccountBalance } = useGasBalanceRefresh();

  const withdraw = async () => {
    if (!sig || !accountId || loading) {
      return;
    }
    if (balance <= 0) {
      onClose();
      onAfterConfirm?.();
      return;
    }
    try {
      setLoading(true);
      onAfterConfirm?.();
      await openapi.withdrawGasAccount({
        sig: sig!,
        account_id: accountId!,
        amount: balance,
      });
      refreshGasAccountBalance();
      onClose();
      onAfterConfirm?.();
    } catch (error) {
      toast.info((error as any)?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.paddingContainer}>
        <Text style={styles.title}>
          {t('component.gasAccount.withdrawPopup.title')}
        </Text>
        <Text style={styles.description}>
          {t('component.gasAccount.withdrawPopup.desc')}
        </Text>

        <Text style={styles.label}>
          {t('component.gasAccount.withdrawPopup.amount')}
        </Text>

        <View style={styles.labelContent}>
          <Text style={styles.textContent}>{formatUsdValue(balance)}</Text>
        </View>

        <Text style={styles.label}>
          {t('component.gasAccount.withdrawPopup.to')}
        </Text>

        <View style={[styles.labelContent, { paddingLeft: 0 }]}>
          <GasAccountCurrentAddress transparent />
        </View>
      </View>
      <View style={styles.btnContainer}>
        <Button
          type="primary"
          containerStyle={styles.confirmButton}
          onPress={withdraw}
          loading={loading}
          title={t('global.confirm')}
        />
      </View>
    </View>
  );
};

const WithDrawConfirm = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.paddingContainer}>
        <RcIconHasConfirmed style={styles.confirmIcon} />

        <Text style={styles.confirmTitle}>
          {t('component.gasAccount.withdrawConfirmModal.title')}
        </Text>

        <View
          style={[
            styles.labelContent,
            {
              width: 'auto',
              height: 48,
              paddingVertical: 0,
              paddingHorizontal: 0,
              marginTop: 16,
            },
          ]}>
          <GasAccountCurrentAddress transparent />
        </View>
      </View>

      <View style={styles.btnContainer}>
        <Button
          type="primary"
          containerStyle={styles.confirmButton}
          onPress={gotoDeBankAppL2}
          buttonStyle={styles.debankBtn}
          icon={<IconJumpBtn style={styles.jumpBtnIcon} />}
          iconRight={true}
          title={t('component.gasAccount.withdrawConfirmModal.button')}
        />
      </View>
    </View>
  );
};

export const WithDrawPopup = props => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
        snapPoints={[440]}
        onDismiss={props.onCancel || props.onClose}
        ref={modalRef}>
        <BottomSheetView style={styles.popup}>
          <WithDrawInitContent
            balance={props.balance}
            onAfterConfirm={onAfterConfirm}
            onClose={props.onCancel || props.onClose}
          />
        </BottomSheetView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        snapPoints={[350]}
        onDismiss={() => setShowConfirm(false)}
        ref={confirmModalRef}>
        <BottomSheetView style={styles.popup}>
          <WithDrawConfirm />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyles = createGetStyles(colors => ({
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 12,
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
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
    color: colors['neutral-body'],
  },
  labelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 6,
    width: '100%',
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 15,
  },
  textContent: {
    fontSize: 15,
    color: colors['neutral-title1'],
    fontWeight: '500',
  },
  btnContainer: {
    marginTop: 15,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    // borderTopWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0.5,
    backgroundColor: colors['neutral-bg1'],
    paddingHorizontal: 20,
    marginBottom: 15,
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
    justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    // paddingVertical: 10,
  },
  confirmIcon: {
    marginTop: 16,
    width: 32,
    height: 32,
  },
}));
