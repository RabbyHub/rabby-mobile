import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Dimensions, Modal, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { MiniWaiting } from '@/components/Approval/components/MiniSignTx/MiniWaiting';
import { useSignatureStore } from '../state/SignatureManager';
import { signatureStore } from '../state';
import MiniSignTxV2 from '@/components/Approval/components/MiniSignTx/MiniSignTxV2';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import AutoLockView from '@/components/AutoLockView';

export const GlobalSignerPortal: React.FC = () => {
  const state = useSignatureStore();
  const { config, ctx, status, error } = state;
  console.log('useSignatureStore state', state);
  const { styles, colors2024 } = useTheme2024({
    getStyle: getSheetStyles,
  });
  const handleRetry = () => {
    signatureStore.retry().catch(() => undefined);
  };

  const handleCancel = () => {
    signatureStore.close();
  };

  const { sheetModalRef } = useSheetModal();
  const pressBackdropRef = useRef(false);
  const indexRef = useRef(-1);
  const dismissedByCodeRef = useRef(false);

  const onChange = useCallback((index: number) => {
    if (index === -1 && indexRef.current > -1) {
      if (!dismissedByCodeRef.current) {
        handleCancel?.();
        pressBackdropRef.current = false;
      }
      dismissedByCodeRef.current = false;
    }

    indexRef.current = index;
  }, []);

  const visible = (ctx?.txs?.length || 0) > 0;

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, visible]);

  const showUI = React.useMemo(() => {
    if (ctx?.mode === 'ui') {
      return ['ui-open', 'signing', 'error'].includes(status);
    }

    return false;
  }, [ctx?.mode, status]);
  const [showCheckSecurity, setShowCheckSecurity] = useState(false);

  const onToggleCheckSecurity = useCallback(() => {
    setShowCheckSecurity(e => !e);
  }, []);

  useEffect(() => {
    if (config?.account || state.status === 'idle' || !ctx?.txs.length) {
      setShowCheckSecurity(false);
    }
  }, [config?.account, state.status, ctx?.txs.length]);

  if (!config?.account || state.status === 'idle' || !ctx?.txs.length) {
    return null;
  }

  return (
    <>
      <AppBottomSheetModal
        index={!showUI ? -1 : 0}
        ref={sheetModalRef}
        style={styles.sheet}
        handleStyle={[
          styles.handleStyle,
          showCheckSecurity && {
            backgroundColor: colors2024['neutral-bg-0'],
          },
        ]}
        handleIndicatorStyle={styles.handleIndicatorStyle}
        enableDynamicSizing
        maxDynamicContentSize={Dimensions.get('screen').height * 0.9}
        backgroundStyle={styles.sheetBg}
        backdropProps={{
          onPress() {
            pressBackdropRef.current = true;
          },
        }}
        // containerStyle={{ zIndex: 2001 }}
        onChange={onChange}>
        <BottomSheetView>
          <AutoLockView
            style={{
              minHeight: 164,
            }}>
            {ctx?.txs?.length ? (
              <MiniSignTxV2
                showCheckSecurity={showCheckSecurity}
                onToggleCheckSecurity={onToggleCheckSecurity}
              />
            ) : null}
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>

      <MiniWaiting
        visible={!!error && !!ctx?.signInfo?.status}
        error={error}
        onCancel={handleCancel}
        onRetry={handleRetry}
        account={config?.account}
      />
      {ctx?.mode === 'direct' && status !== 'ready' && status !== 'error' ? (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          statusBarTranslucent>
          <View style={styles.transparentOverlay} />
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
  transparentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0)',
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
  hiddenPortal: {
    width: 0,
    height: 0,
    position: 'absolute',
    left: -9999,
    top: -9999,
    zIndex: -9999,
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

  simulateChangeContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginBottom: 16,
    gap: 16,
  },
  balanceChangeContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginTop: 0,
    marginBottom: 16,
    paddingVertical: 16,
    paddingTop: 12,
    paddingBottom: 0,
    borderRadius: 8,
  },
}));
