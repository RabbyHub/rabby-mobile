import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GasAccountDepositSelect } from './GasAccountDepositSelect';
import { GasAccountDepositTokenForm } from './GasAccountDepositTokenForm';
import { GasAccountDepositWithPay } from './GasAccountDepositWithPay';
import { GasAccountTopUpWaitCallback } from './topUpContinuation';

export const GasAccountDepositPopup: React.FC<{
  type?: 'token' | 'pay';
  visible?: boolean;
  gasAccountAddress?: string;
  onEnsurePayGasAccountAddress?(): Promise<string>;
  onClose?(): void;
  onDeposit?(): void;
  minDepositPrice?: number;
  /**
   * When provided, after the deposit tx is sent the form will poll
   * `openapi.getGasAccountBridgeStatus` and wait for the deposit to
   * be confirmed on-chain.  The button stays in loading state during
   * polling. On success the popup auto-closes; on failure a toast is
   * shown.
   */
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
}> = props => {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [step, setStep] = useState<'token' | 'pay' | undefined>(props.type);
  // Track whether we're transitioning to token step so we don't
  // fire onClose when the outer modal is dismissed intentionally.
  const isTransitioningToTokenRef = useRef(false);
  const showSelectSheet = props.visible && step !== 'token';
  const showTokenForm = props.visible && step === 'token';

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

  // Dismiss the outer modal first, then change the step.
  // This avoids two BottomSheetModal instances fighting for the
  // react-native-gesture-handler context, which breaks BottomSheetTextInput.
  const handleSelect = useCallback((type: 'token' | 'pay') => {
    if (type === 'token') {
      isTransitioningToTokenRef.current = true;
      modalRef.current?.dismiss();
      // Let the outer modal fully dismiss before the inner modal presents
      setTimeout(() => {
        setStep(type);
      }, 100);
    } else {
      setStep(type);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    if (isTransitioningToTokenRef.current) {
      isTransitioningToTokenRef.current = false;
      return;
    }
    props?.onClose?.();
  }, [props]);

  const snapPoints = useMemo(() => {
    if (step === 'pay') {
      return [355];
    } else if (step !== 'token') {
      return [256];
    } else {
      return [256];
    }
  }, [step]);

  return (
    <>
      {showSelectSheet ? (
        <AppBottomSheetModal
          snapPoints={snapPoints}
          onDismiss={handleDismiss}
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
                minDepositPrice={props.minDepositPrice}
                visible={props.visible}
                onDeposit={props.onDeposit}
                onClose={props.onClose}
                onWaitDepositResult={props.onWaitDepositResult}
                gasAccountAddress={props.gasAccountAddress}
                onEnsureGasAccountAddress={props.onEnsurePayGasAccountAddress}
              />
            </BottomSheetScrollView>
          ) : (
            <BottomSheetScrollView style={styles.popup}>
              <GasAccountDepositSelect
                onSelect={handleSelect}
                minDepositPrice={props.minDepositPrice}
              />
            </BottomSheetScrollView>
          )}
        </AppBottomSheetModal>
      ) : null}
      {showTokenForm ? (
        <GasAccountDepositTokenForm
          visible={showTokenForm}
          onDeposit={props.onDeposit}
          onClose={props.onClose}
          onWaitDepositResult={props.onWaitDepositResult}
          minDepositPrice={props.minDepositPrice}
        />
      ) : null}
    </>
  );
};

const getStyles = createGetStyles2024(() => ({
  popup: {
    margin: 0,
    height: '100%',
    paddingVertical: 10,
  },
}));
