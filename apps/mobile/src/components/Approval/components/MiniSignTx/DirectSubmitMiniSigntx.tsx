import { useTheme2024 } from '@/hooks/theme';
import { sendTransaction } from '@/utils/sendTransaction';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  View,
} from 'react-native';
import { MiniWaiting } from './MiniWaiting';
import { createGetStyles2024 } from '@/utils/styles';
import { useCallback, useEffect, useRef } from 'react';
import React from 'react';
import { isAccountSupportDirectSign } from '@/utils/account';
import { useMemoizedFn } from 'ahooks';
import {
  AbortedDirectSubmitError,
  directSigningAtom,
  useDirectSigningDisabledProcess,
  useGetDirectSubmitInnerError,
  useResetMiniApprovalDirectSignState,
} from '@/hooks/useMiniApprovalDirectSign';
import { useMiniApprovalTask } from '@/hooks/useMiniApprovalTask';
import { useAtom } from 'jotai';
import { MiniSignTx } from './MiniSignTx';
import IconLoadingCC from '@/assets2024/icons/gas-account/loading-cc.svg';
import { DirectSubmitReject } from '@/hooks/useMiniApproval';
import { Account } from '@/core/services/preference';

export const MiniDirectSubmitApproval = ({
  txs,
  visible,
  onResolve,
  onReject,
  onVisibleChange,
  ga,
  onSubmitting,
  onSubmitted,
  id,
  account,
}: {
  txs?: Tx[];
  visible?: boolean;
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendTransaction>>[]) => void;
  onVisibleChange?: (v: boolean) => void;
  ga?: Record<string, any>;
  onSubmitting?: () => void;
  onSubmitted?: (isSuccess: boolean) => void;
  id?: string;
  account: Account;
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

  const resetMiniApprovalDirectSignState =
    useResetMiniApprovalDirectSignState();

  const handleClearTask = useMemoizedFn((e: any) => {
    task.clear();
    resetMiniApprovalDirectSignState();
    onVisibleChange?.(false);
    cancelOverlayLoading();

    if (!visible) {
      onReject?.(e);
    }
  });

  const task = useMiniApprovalTask({
    ga,
  });

  const [isDirectSigning] = useAtom(directSigningAtom);
  const directSubmitInnerError = useGetDirectSubmitInnerError();

  useEffect(() => {
    resetMiniApprovalDirectSignState();
  }, [resetMiniApprovalDirectSignState, txs]);

  useEffect(() => {
    if (isDirectSigning) {
      setOverlayLoading?.(true);
    }
  }, [isDirectSigning]);

  useEffect(() => {
    if (overlayLoading && directSubmitInnerError) {
      setOverlayLoading?.(false);
      DirectSubmitReject?.(new AbortedDirectSubmitError('abort'));
    }
  }, [overlayLoading, directSubmitInnerError]);

  useEffect(() => {
    if (task.error) {
      setOverlayLoading?.(false);
    }
  }, [task.error]);
  const cantSubmit = useDirectSigningDisabledProcess();

  useEffect(() => {
    if (overlayLoading && cantSubmit) {
      setOverlayLoading?.(false);
      DirectSubmitReject?.(new AbortedDirectSubmitError('abort'));
    }
  }, [cantSubmit, overlayLoading]);

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

  return (
    <>
      {txs?.length ? (
        <View
          style={{
            width: 0,
            height: 0,
            position: 'absolute',
            left: -9999,
            top: -9999,
            zIndex: -9999,
          }}>
          <MiniSignTx
            directSubmit
            task={task}
            txs={txs}
            ga={ga}
            key={`${currentAccount?.type}-${currentAccount?.address}-${id}`}
            onVisibleChange={v => {
              onVisibleChange?.(v);
            }}
            onReject={handleClearTask}
            onResolve={res => {
              onResolve?.(res);
            }}
            onSubmitting={onSubmittingCb}
            onSubmitted={onSubmittedCb}
            account={account}
          />
        </View>
      ) : null}

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

      <Modal
        visible={overlayLoading}
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
}));
