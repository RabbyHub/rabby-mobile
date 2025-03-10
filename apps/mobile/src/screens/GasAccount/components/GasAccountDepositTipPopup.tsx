import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GasAccountDepositTipSelect } from './GasAccountDepositTipSelect';
import { GasAccountDepositWithPay } from './GasAccountDepositWithPay';
import { GasAccountDepositWithTokenAlertModal } from './GasAccountDepositWithTokenAlertModal';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';

export const GasAccountDepositTipPopup: React.FC<{
  type?: 'token' | 'pay';
  visible?: boolean;
  gasAccountAddress: string;
  onClose?(): void;
  onGotoGasAccount?(): void;
  onDeposit?(): void;
  minDepositPrice?: number;
}> = props => {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [step, setStep] = useState<'token' | 'pay' | undefined>(props.type);
  const [isShowAlertModal, setIsShowAlertModal] = useState(false);
  const { t } = useTranslation();

  const handleSelect = useMemoizedFn((type: 'token' | 'pay') => {
    if (type === 'pay') {
      setStep('pay');
    } else {
      setIsShowAlertModal(true);
    }
  });

  useEffect(() => {
    if (!props?.visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [props?.visible]);

  useEffect(() => {
    if (props.visible) {
      setStep(props.type);
    }
  }, [props.type, props.visible]);

  const snapPoints = useMemo(() => {
    if (step === 'pay') {
      return [355];
    } else if (step === 'token') {
      return ['90%'];
    } else {
      return [304];
    }
  }, [step]);

  return (
    <>
      <AppBottomSheetModal
        snapPoints={snapPoints}
        onDismiss={() => {
          props.onClose?.();
          // toast.error(t('page.gasAccount.depositCanceled'), {
          //   position: toast.positions.CENTER,
          // });
        }}
        ref={modalRef}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        {...makeBottomSheetProps({
          linearGradientType: 'linear',
          colors: colors2024,
        })}>
        <BottomSheetView style={styles.popup}>
          {step === 'pay' ? (
            <GasAccountDepositWithPay
              visible={props.visible}
              minDepositPrice={props.minDepositPrice}
              gasAccountAddress={props.gasAccountAddress}
              onDeposit={props.onDeposit}
            />
          ) : step === 'token' ? null : (
            <GasAccountDepositTipSelect onSelect={handleSelect} />
          )}
        </BottomSheetView>
      </AppBottomSheetModal>

      <GasAccountDepositWithTokenAlertModal
        visible={isShowAlertModal}
        onCancel={() => {
          setIsShowAlertModal(false);
        }}
        onConfirm={() => {
          setIsShowAlertModal(false);
          props.onGotoGasAccount?.();
        }}
      />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  popup: {
    margin: 0,
    height: '100%',
    paddingVertical: 10,
  },
}));
