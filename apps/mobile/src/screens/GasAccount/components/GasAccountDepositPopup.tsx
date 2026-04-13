import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GasAccountDepositSelect } from './GasAccountDepositSelect';
import { GasAccountDepositTokenForm } from './GasAccountDepositTokenForm';
import { GasAccountDepositWithPay } from './GasAccountDepositWithPay';
import { GasAccountTopUpWaitCallback } from './topUpContinuation';
import { setGasAccountDepositFlowActive } from '../utils/depositFlowRuntime';

export const GasAccountDepositPopup: React.FC<{
  type?: 'token' | 'pay';
  visible?: boolean;
  gasAccountAddress?: string;
  onEnsurePayGasAccountAddress?(): Promise<string>;
  onClose?(): void;
  onDeposit?(): void;
  minDepositPrice?: number;
  disableL2Deposit?: boolean;
  /**
   * When provided, after the deposit tx is sent the form will poll
   * `openapi.getGasAccountBridgeStatus` and wait for the deposit to
   * be confirmed on-chain.  The button stays in loading state during
   * polling. On success the popup auto-closes; on failure a toast is
   * shown.
   */
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
}> = props => {
  const {
    type,
    visible,
    gasAccountAddress,
    onEnsurePayGasAccountAddress,
    onClose,
    onDeposit,
    minDepositPrice,
    disableL2Deposit: disableL2DepositProp,
    onWaitDepositResult,
  } = props;
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const disableL2Deposit = disableL2DepositProp ?? false;
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [step, setStep] = useState<'token' | 'pay' | undefined>(type);
  const resetStep = useCallback(() => {
    setStep(type);
  }, [type]);

  const handleClose = useCallback(() => {
    resetStep();
    onClose?.();
  }, [onClose, resetStep]);

  useEffect(() => {
    setGasAccountDepositFlowActive(!!visible);

    if (!visible) {
      modalRef.current?.close();
      resetStep();
    } else {
      modalRef.current?.present();
    }

    return () => {
      setGasAccountDepositFlowActive(false);
    };
  }, [resetStep, visible]);

  useEffect(() => {
    if (visible) {
      setStep(type);
    }
  }, [type, visible]);

  return (
    <AppBottomSheetModal
      enableDynamicSizing
      onDismiss={handleClose}
      ref={modalRef}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}>
      {step === 'token' ? (
        <GasAccountDepositTokenForm
          key="token"
          visible={visible}
          onDeposit={onDeposit}
          onClose={handleClose}
          onWaitDepositResult={onWaitDepositResult}
          minDepositPrice={minDepositPrice}
          disableL2Deposit={disableL2Deposit}
        />
      ) : step === 'pay' ? (
        <BottomSheetScrollView key="pay" contentContainerStyle={styles.content}>
          <GasAccountDepositWithPay
            minDepositPrice={minDepositPrice}
            visible={visible}
            onDeposit={onDeposit}
            onClose={handleClose}
            onWaitDepositResult={onWaitDepositResult}
            gasAccountAddress={gasAccountAddress}
            onEnsureGasAccountAddress={onEnsurePayGasAccountAddress}
          />
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView key="select" style={styles.content}>
          <GasAccountDepositSelect
            onSelect={setStep}
            minDepositPrice={minDepositPrice}
            disableL2Deposit={disableL2Deposit}
          />
        </BottomSheetView>
      )}
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(() => ({
  content: {
    margin: 0,
  },
}));
