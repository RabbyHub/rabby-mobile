import React, {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import { toast } from '@/components2024/Toast';
import {
  approveWalletConnectProposal,
  getWalletConnectDebugState,
  rejectWalletConnectProposal,
  subscribeWalletConnectDebugState,
} from '@/core/walletconnect';
import { getWalletConnectErrorMessage } from '@/core/walletconnect/error';
import type { Account } from '@/types/account';
import type { WalletConnectProposalViewModel } from '@/core/walletconnect/types';
import { useTheme2024 } from '@/hooks/theme';

const WALLETCONNECT_PAIRING_SINGLETON_KEY = 'walletconnect-pairing';
const WALLETCONNECT_CONNECT_SINGLETON_KEY = 'walletconnect-connect';

export function WalletConnectModalHost() {
  const { isLight, colors2024 } = useTheme2024();
  const walletConnectState = useSyncExternalStore(
    subscribeWalletConnectDebugState,
    getWalletConnectDebugState,
    getWalletConnectDebugState,
  );
  const modalIdsRef = useRef<{
    loading: MODAL_ID | null;
    connect: MODAL_ID | null;
    proposalId: number | null;
  }>({
    loading: null,
    connect: null,
    proposalId: null,
  });
  const lastErrorToastRef = useRef({ message: '', ts: 0 });

  const closeLoading = useCallback(() => {
    const id = modalIdsRef.current.loading;
    if (!id) {
      return;
    }
    modalIdsRef.current.loading = null;
    removeGlobalBottomSheetModal2024(id, { waitMaxtime: 0 });
  }, []);

  const closeConnect = useCallback(() => {
    const id = modalIdsRef.current.connect;
    if (!id) {
      return;
    }
    modalIdsRef.current.connect = null;
    modalIdsRef.current.proposalId = null;
    removeGlobalBottomSheetModal2024(id, { waitMaxtime: 0 });
  }, []);

  const showErrorToast = useCallback((message?: string) => {
    const nextMessage = message || 'WalletConnect pairing failed.';
    const now = Date.now();
    const last = lastErrorToastRef.current;

    if (last.message === nextMessage && now - last.ts < 1000) {
      return;
    }

    lastErrorToastRef.current = {
      message: nextMessage,
      ts: now,
    };
    toast.error(nextMessage, {
      duration: 3000,
      hideOnPress: true,
    });
  }, []);

  const openLoading = useCallback(() => {
    if (modalIdsRef.current.loading) {
      return;
    }

    modalIdsRef.current.loading = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.WALLETCONNECT_PAIRING,
      singletonKey: WALLETCONNECT_PAIRING_SINGLETON_KEY,
      bottomSheetModalProps: {
        enablePanDownToClose: false,
      },
    });
  }, []);

  const openConnect = useCallback(
    (proposal: WalletConnectProposalViewModel) => {
      if (
        modalIdsRef.current.connect &&
        modalIdsRef.current.proposalId === proposal.id
      ) {
        return;
      }

      closeConnect();
      modalIdsRef.current.proposalId = proposal.id;
      modalIdsRef.current.connect = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.WALLETCONNECT_CONNECT,
        singletonKey: WALLETCONNECT_CONNECT_SINGLETON_KEY,
        proposal,
        bottomSheetModalProps: {
          enablePanDownToClose: false,
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
          backgroundStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
        onApprove: async (account: Account) => {
          try {
            closeLoading();
            await approveWalletConnectProposal({
              proposalId: proposal.id,
              account,
            });
            toast.success('Wallet connected', {
              duration: 3000,
              hideOnPress: true,
            });
            closeConnect();
          } catch (error: unknown) {
            showErrorToast(getWalletConnectErrorMessage(error));
          }
        },
        onReject: async () => {
          try {
            closeLoading();
            await rejectWalletConnectProposal(proposal.id);
            closeConnect();
          } catch (error: unknown) {
            showErrorToast(getWalletConnectErrorMessage(error));
          }
        },
      });
    },
    [closeConnect, closeLoading, colors2024, isLight, showErrorToast],
  );

  useEffect(() => {
    const { pairing, proposal } = walletConnectState;

    if (proposal) {
      closeLoading();
      openConnect(proposal);
      return;
    }

    closeConnect();

    if (pairing.status === 'pairing') {
      openLoading();
      return;
    }

    closeLoading();

    if (pairing.status === 'error' && pairing.error) {
      showErrorToast(pairing.error);
    }
  }, [
    closeConnect,
    closeLoading,
    openConnect,
    openLoading,
    showErrorToast,
    walletConnectState,
  ]);

  useEffect(() => {
    return () => {
      closeLoading();
      closeConnect();
    };
  }, [closeConnect, closeLoading]);

  return null;
}
