import { useTheme2024 } from '@/hooks/theme';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import React from 'react';
import {
  isAccountSupportDirectSign,
  isHardWareAccountAccountSupportMiniApproval,
} from '@/utils/account';
import { useMemoizedFn } from 'ahooks';
import IconLoadingCC from '@/assets2024/icons/gas-account/loading-cc.svg';
import { Account } from '@/core/services/preference';
import { MiniSignTypedDate } from './MiniTypedData';
import { MiniWaiting } from '../MiniSignTx/MiniWaiting';
import { sendSignTypedData } from '@/utils/sendTypedData';
import {
  MiniTypedData,
  useMiniTypedDataApprovalTask,
} from '@/hooks/useMiniSignTypedDataApprovalTask';
import {
  useGetMiniSigningTypedData,
  useResetMiniSigningTypedData,
  useSetMiniSigningTypedData,
} from '@/hooks/useMiniApprovalDirectSignTypedData';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import AutoLockView from '@/components/AutoLockView';

export const MiniDirectSubmitTypedDataApproval = ({
  txs,
  // visible,
  onResolve,
  onReject,
  onVisibleChange,
  ga,
  onSubmitting,
  onSubmitted,
  id,
  account,
  autoSign,
}: {
  txs?: MiniTypedData[];
  visible?: boolean;
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendSignTypedData>>[]) => void;
  onVisibleChange?: (v: boolean) => void;
  ga?: Record<string, any>;
  onSubmitting?: () => void;
  onSubmitted?: (isSuccess: boolean) => void;
  id?: string;
  account: Account;
  autoSign?: boolean;
}) => {
  const { styles } = useTheme2024({
    getStyle: getSheetStyles,
  });

  const dismissedByCodeRef = useRef(false);

  const [overlayLoading, setOverlayLoading] = React.useState(false);
  const currentAccount = account;

  const onSubmittingCb = useCallback(() => {
    onSubmitting?.();
    if (isAccountSupportDirectSign(currentAccount?.type)) {
      setOverlayLoading(true);
    }
  }, [currentAccount?.type, onSubmitting]);

  const onSubmittedCb = useCallback(
    (isSuccess: boolean) => {
      onSubmitted?.(isSuccess);
      setOverlayLoading(false);
    },
    [onSubmitted],
  );

  const cancelOverlayLoading = useMemoizedFn(() => {
    setOverlayLoading?.(false);
  });

  const resetSignTypedData = useResetMiniSigningTypedData();

  const handleClearTask = useMemoizedFn((e: any) => {
    sheetModalRef.current?.dismiss();
    task.clear();
    resetSignTypedData();
    onVisibleChange?.(false);
    cancelOverlayLoading();
    onReject?.(e);
  });

  const task = useMiniTypedDataApprovalTask({
    ga,
  });

  const isSignTypedDataSigning = useGetMiniSigningTypedData();
  const setMiniSigningTypedData = useSetMiniSigningTypedData();

  useEffect(() => {
    resetSignTypedData();
  }, [resetSignTypedData, txs]);

  useEffect(() => {
    if (isSignTypedDataSigning) {
      setOverlayLoading?.(true);
    }
  }, [isSignTypedDataSigning]);

  useEffect(() => {
    if (task.error) {
      setOverlayLoading?.(false);
    }
  }, [task.error]);

  const transAnim = React.useRef(new Animated.Value(0));

  React.useEffect(() => {
    if (overlayLoading) {
      Animated.loop(
        Animated.timing(transAnim.current, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      transAnim.current.resetAnimation();
    }
  }, [overlayLoading]);

  const rotate = transAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const { sheetModalRef } = useSheetModal();

  useEffect(() => {
    if (!isSignTypedDataSigning && txs?.length && autoSign) {
      // sheetModalRef.current?.present();
      setMiniSigningTypedData(true);
      console.log('setMiniSigningTypedData true');
    }
  }, [
    autoSign,
    txs,
    isSignTypedDataSigning,
    setMiniSigningTypedData,
    sheetModalRef,
  ]);

  const isHardwareWallet = useMemo(
    () => isHardWareAccountAccountSupportMiniApproval(account.type),
    [account.type],
  );

  console.log('txs', txs?.length, task.status);

  const pressBackdropRef = useRef(false);

  const indexRef = useRef(-1);

  const onChange = useCallback(
    (index: number) => {
      if (index === -1 && indexRef.current > -1) {
        if (!dismissedByCodeRef.current) {
          const reason = pressBackdropRef.current
            ? 'PRESS_BACKDROP'
            : undefined;

          handleClearTask?.(reason);
          pressBackdropRef.current = false;
        }
        dismissedByCodeRef.current = false;
      }

      indexRef.current = index;
    },
    [handleClearTask],
  );

  useEffect(() => {
    if (txs?.length) {
      sheetModalRef.current?.present();
    } else {
      // sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, txs]);

  useEffect(() => {
    if (isSignTypedDataSigning) {
      if (txs?.length) {
        sheetModalRef.current?.present();
      }
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [isSignTypedDataSigning, sheetModalRef, txs?.length]);

  return (
    <>
      <AppBottomSheetModal
        index={
          isHardwareWallet &&
          isSignTypedDataSigning &&
          txs?.length &&
          task.status === 'active'
            ? 0
            : -1
        }
        ref={sheetModalRef}
        // enableDismissOnClose={false}
        style={styles.sheet}
        handleStyle={styles.handleStyle}
        handleIndicatorStyle={styles.handleIndicatorStyle}
        enableDynamicSizing
        backgroundStyle={styles.sheetBg}
        backdropProps={{
          onPress() {
            pressBackdropRef.current = true;
          },
        }}
        onChange={onChange}>
        {txs?.length ? (
          <BottomSheetView>
            <AutoLockView
              style={{
                minHeight: 164,
              }}>
              <MiniSignTypedDate
                directSubmit
                task={task}
                txs={txs}
                // ga={ga}
                key={`${currentAccount?.type}-${currentAccount?.address}-${id}`}
                onVisibleChange={v => {
                  onVisibleChange?.(v);
                }}
                onReject={handleClearTask}
                onResolve={onResolve}
                onSubmitting={onSubmittingCb}
                onSubmitted={onSubmittedCb}
                account={account}
              />
            </AutoLockView>
          </BottomSheetView>
        ) : (
          <BottomSheetView>
            <>{null}</>
          </BottomSheetView>
        )}
      </AppBottomSheetModal>

      <MiniWaiting
        visible={!!task.error}
        error={task.error}
        onCancel={handleClearTask}
        onRetry={async () => {
          try {
            onSubmittingCb?.();
            const res = await task.retry();
            // todo check this
            onResolve?.(res || []);
            onSubmittedCb?.(true);
            dismissedByCodeRef.current = true;
          } catch (e) {
            console.error(e);
            onSubmittedCb?.(false);
          }
        }}
        account={account}
      />

      {overlayLoading && !isHardwareWallet ? (
        <Modal
          visible={overlayLoading && !isHardwareWallet}
          transparent
          animationType="fade"
          onRequestClose={cancelOverlayLoading}
          statusBarTranslucent>
          <Pressable style={styles.overlay}>
            <View style={styles.loadingContainer}>
              <Animated.View
                style={[
                  {
                    transform: [
                      {
                        rotate,
                      },
                    ],
                  },
                ]}>
                <IconLoadingCC color={'white'} width={24} height={24} />
              </Animated.View>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
};

const getSheetStyles = createGetStyles2024(({ colors2024 }) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sheetBg: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  handleStyle: {
    paddingTop: 10,
    backgroundColor: colors2024['neutral-bg-1'],
    height: 36,
  },
  handleIndicatorStyle: {
    backgroundColor: colors2024['neutral-line'],
    height: 6,
    width: 50,
  },
  sheet: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
}));
