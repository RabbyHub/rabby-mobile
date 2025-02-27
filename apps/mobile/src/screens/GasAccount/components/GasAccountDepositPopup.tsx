import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GasAccountDepositSelect } from './GasAccountDepositSelect';
import { GasAccountDepositWithPay } from './GasAccountDepositWithPay';
import { GasAccountDepositWithToken } from './GasAccountDepositWithToken';
import { useWindowDimensions } from 'react-native';
import { min } from 'lodash';

export const GasAccountDepositPopup: React.FC<{
  type?: 'token' | 'pay';
  visible?: boolean;
  gasAccountAddress: string;
  onCancel?(): void;
  onClose?(): void;
  onDeposit?(): void;
}> = props => {
  const { styles, colors2024 } = useTheme2024({
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
      return [Math.min(height - 200, 652)];
    } else {
      return [355];
    }
  }, [height, step]);

  return (
    <AppBottomSheetModal
      snapPoints={snapPoints}
      onDismiss={props.onCancel || props.onClose}
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
            onDeposit={props.onDeposit}
            gasAccountAddress={props.gasAccountAddress}
          />
        ) : step === 'token' ? (
          <GasAccountDepositWithToken
            onClose={props.onCancel || props.onClose}
          />
        ) : (
          <GasAccountDepositSelect onSelect={setStep} />
        )}
      </BottomSheetView>
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
