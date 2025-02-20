import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GasAccountDepositSelect } from './GasAccountDepositSelect';
import { GasAccountDepositWithPay } from './GasAccountDepositWithPay';
import { GasAccountDepositWithToken } from './GasAccountDepositWithToken';

export const GasAccountDepositPopup: React.FC<{
  type?: 'token' | 'pay';
  visible?: boolean;
  onCancel?(): void;
  onClose?(): void;
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

  const snapPoints = useMemo(() => {
    if (step === 'pay') {
      return [355];
    } else if (step === 'token') {
      return ['90%'];
    } else {
      return [355];
    }
  }, [step]);

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
          <GasAccountDepositWithPay onClose={props.onCancel || props.onClose} />
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
  container: {
    width: '100%',
    flex: 1,
  },
  containerHorizontal: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    marginBottom: 18,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 10,
  },
  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: 52,
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8,
    height: 60,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors['blue-light1'],
    borderColor: colors['blue-default'],
  },
  amountText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  input: {
    flex: 1,
    height: 60,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 10,
    color: colors2024['neutral-body'],
  },
  tokenLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors['neutral-card2'],
    borderRadius: 30,
    width: '100%',
    height: 62,
    paddingHorizontal: 20,
  },
  flatList: {
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  tokenListItem: {
    paddingVertical: 14,
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
  },
  tokenContent: { flexDirection: 'row', alignItems: 'center' },
  tokenSymbol: {
    marginLeft: 12,
    color: colors['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  tokenPlaceholder: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    marginBottom: 35,
  },
  popup: {
    margin: 0,
    height: '100%',
    paddingVertical: 10,
  },
  btnContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'flex-end',
    flex: 1,
  },

  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  errorTips: {
    textAlign: 'left',
    width: '100%',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 20,
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
  },

  insufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientDivider: {
    position: 'absolute',
    top: 18,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['red-light-2'],
  },

  insufficientTip: {
    color: colors2024['red-default'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: colors['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  tokenInsufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },

  tokenInsufficientDivider: {
    position: 'absolute',
    top: 9,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },

  tokenInsufficientTip: {
    color: colors2024['neutral-info'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: colors['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  searchInputContainer: {
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    borderColor: 'transparent',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchIconWrapperStyle: {
    paddingLeft: 0,
  },
  inputStyle: {
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
    color: colors2024['neutral-title-1'],
  },

  accountItem: {
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 96,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    paddingHorizontal: 24,
  },

  pinnedWrapper: {
    flexShrink: 0,
    marginLeft: 4,
    borderRadius: 6,
    width: 33,
    height: 20,
    flexWrap: 'nowrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-light-1'],
  },
  pinText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },
  walletName: {
    color: colors2024['neutral-title-1'],

    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
}));
