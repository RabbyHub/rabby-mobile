import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Dimensions, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { MiniWaiting } from '@/components/Approval/components/MiniSignTx/MiniWaiting';
import { useSignatureStore } from '@/components2024/MiniSignV2/state/useSignatureStore';
import {
  SignatureInstanceProvider,
  useSignatureInstance,
} from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import { useRegistryInstances } from '@/components2024/MiniSignV2/state/SignatureManagerRegistry';
import MiniSignTxV2 from '@/components/Approval/components/MiniSignTx/MiniSignTxV2';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import AutoLockView from '@/components/AutoLockView';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { TrackedModal } from '@/components/Modal/TrackedModal';

/**
 * Renders the signing UI for a single SignatureManager instance.
 * Must be wrapped in <SignatureInstanceProvider>.
 */
const SignerPortalItem: React.FC = () => {
  const instance = useSignatureInstance();
  const state = useSignatureStore();
  const { config, ctx, status, error } = state;
  const { styles, colors2024 } = useTheme2024({
    getStyle: getSheetStyles,
  });
  const handleRetry = useCallback(() => {
    instance.retry().catch(() => undefined);
  }, [instance]);

  const handleCancel = useCallback(() => {
    instance.close();
  }, [instance]);

  const sheetModalRef = useRef<BottomSheetModal>(null);

  const pressBackdropRef = useRef(false);
  const indexRef = useRef(-1);
  const dismissedByCodeRef = useRef(false);

  const onChange = useCallback(
    (index: number) => {
      if (index === -1 && indexRef.current > -1) {
        if (!dismissedByCodeRef.current) {
          handleCancel?.();
          pressBackdropRef.current = false;
        }
        dismissedByCodeRef.current = false;
      }

      indexRef.current = index;
    },
    [handleCancel],
  );

  const visible = (ctx?.txs?.length || 0) > 0;

  const showUI = React.useMemo(() => {
    if (ctx?.mode === 'ui' && visible) {
      return ['ui-open', 'signing'].includes(status);
    }

    return false;
  }, [ctx?.mode, status, visible]);

  useEffect(() => {
    if (showUI) {
      sheetModalRef.current?.present();
    }
  }, [sheetModalRef, showUI]);

  const [showCheckSecurity, setShowCheckSecurity] = useState(false);

  const onToggleCheckSecurity = useCallback(() => {
    setShowCheckSecurity(e => !e);
  }, []);

  useEffect(() => {
    if (!config?.account || state.status === 'idle' || !ctx?.txs.length) {
      setShowCheckSecurity(false);
    }
  }, [config?.account, state.status, ctx?.txs.length]);

  const showDirectTransparentOverlay =
    ctx?.mode === 'direct' && status !== 'ready' && status !== 'error';

  if (!config?.account || state.status === 'idle' || !ctx?.txs.length) {
    return null;
  }

  return (
    <>
      {config?.synGasHeaderInfo ? (
        <MiniSignTxV2
          showCheckSecurity={showCheckSecurity}
          onToggleCheckSecurity={onToggleCheckSecurity}
          synGasHeaderInfo
          instanceOverride={instance}
          stateOverride={state}
        />
      ) : null}
      <AppBottomSheetModal
        enableDynamicSizing
        enableDismissOnClose
        ref={sheetModalRef}
        style={styles.sheet}
        handleStyle={[
          styles.handleStyle,
          showCheckSecurity && {
            backgroundColor: colors2024['neutral-bg-0'],
          },
        ]}
        handleIndicatorStyle={styles.handleIndicatorStyle}
        maxDynamicContentSize={Dimensions.get('screen').height * 0.9}
        backgroundStyle={styles.sheetBg}
        backdropProps={{
          onPress() {
            pressBackdropRef.current = true;
          },
        }}
        onChange={onChange}>
        <SignatureInstanceProvider instance={instance}>
          <BottomSheetView>
            <AutoLockView
              style={{
                minHeight: 164,
              }}>
              <MiniSignTxV2
                showCheckSecurity={showCheckSecurity}
                onToggleCheckSecurity={onToggleCheckSecurity}
                instanceOverride={instance}
                stateOverride={state}
              />
            </AutoLockView>
          </BottomSheetView>
        </SignatureInstanceProvider>
      </AppBottomSheetModal>

      <MiniWaiting
        visible={!!error && !!ctx?.signInfo?.status}
        error={error}
        onCancel={handleCancel}
        onRetry={handleRetry}
        account={config?.account}
        ga={config?.ga}
      />
      {showDirectTransparentOverlay ? (
        <TrackedModal
          modalId={MODAL_GATE_IDS.miniSignDirectOverlay}
          visible={true}
          transparent
          animationType="fade"
          statusBarTranslucent>
          <View style={styles.transparentOverlay} />
        </TrackedModal>
      ) : null}
    </>
  );
};

/**
 * Top-level portal that renders a SignerPortalItem for each active instance.
 */
export const GlobalSignerPortal: React.FC = () => {
  const instances = useRegistryInstances();

  return (
    <>
      {instances.map(inst => (
        <SignatureInstanceProvider key={inst.instanceId} instance={inst}>
          <SignerPortalItem />
        </SignatureInstanceProvider>
      ))}
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
