import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GasAccountDepositSelect } from './GasAccountDepositSelect';
import { GasAccountDepositWithPay } from './GasAccountDepositWithPay';
import { GasAccountDepositWithToken } from './GasAccountDepositWithToken';
import { useWindowDimensions } from 'react-native';

export const GasAccountDepositPopup: React.FC<{
  type?: 'token' | 'pay';
  visible?: boolean;
  gasAccountAddress: string;
  onClose?(): void;
  onDeposit?(): void;
}> = props => {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [step, setStep] = useState<'token' | 'pay' | undefined>(props.type);

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

  const { height } = useWindowDimensions();

  const snapPoints = useMemo(() => {
    if (step === 'pay') {
      return [355];
    } else if (step === 'token') {
      // return [Math.min(height - 200, 652)];
      return [height - 200];
      // return ['90%'];
    } else {
      return [355];
    }
  }, [height, step]);

  return (
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
        linearGradientType: 'bg1',
        colors: colors2024,
      })}>
      {step === 'pay' ? (
        <BottomSheetScrollView style={styles.popup}>
          <GasAccountDepositWithPay
            visible={props.visible}
            onDeposit={props.onDeposit}
            gasAccountAddress={props.gasAccountAddress}
          />
        </BottomSheetScrollView>
      ) : step === 'token' ? (
        <GasAccountDepositWithToken onClose={props.onClose} />
      ) : (
        <BottomSheetScrollView style={styles.popup}>
          <GasAccountDepositSelect onSelect={setStep} />
        </BottomSheetScrollView>
      )}
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  popup: {
    margin: 0,
    height: '100%',
    paddingVertical: 10,
  },
}));
