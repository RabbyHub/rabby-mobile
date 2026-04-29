import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  MODAL_NAMES,
  type MODAL_ID,
} from '@/components2024/GlobalBottomSheetModal/types';
import type { DisplayPoolReserveInfo, UserSummary } from '../type';

type LendingActionPopupType = 'supply' | 'repay';

type LendingActionPopupDescriptor = {
  popup: LendingActionPopupType;
  tokenAddress: string;
  source?: string;
};

const popupRuntime = {
  activeModalId: null as MODAL_ID | null,
  activeDescriptor: null as LendingActionPopupDescriptor | null,
  shouldRestoreOnFocus: false,
  isHidingForBlur: false,
};

const handleLendingActionPopupDismiss = (id: MODAL_ID) => {
  if (popupRuntime.activeModalId !== id) {
    return;
  }

  const shouldRestore = popupRuntime.isHidingForBlur;
  popupRuntime.activeModalId = null;
  popupRuntime.isHidingForBlur = false;
  popupRuntime.shouldRestoreOnFocus = shouldRestore;

  if (!shouldRestore) {
    popupRuntime.activeDescriptor = null;
  }
};

export const openLendingActionPopup = ({
  popup,
  reserve,
  userSummary,
  colors2024,
  source,
  onBeforeSwapNavigate,
}: {
  popup: LendingActionPopupType;
  reserve: DisplayPoolReserveInfo;
  userSummary: UserSummary;
  colors2024: Record<string, string>;
  source?: string;
  onBeforeSwapNavigate?: () => void;
}) => {
  const descriptor: LendingActionPopupDescriptor = {
    popup,
    tokenAddress: reserve.reserve.underlyingAsset,
    ...(source ? { source } : {}),
  };

  const modalName =
    popup === 'supply'
      ? MODAL_NAMES.SUPPLY_ACTION_DETAIL
      : MODAL_NAMES.REPAY_ACTION_DETAIL;

  const modalId = createGlobalBottomSheetModal2024({
    name: modalName,
    reserve,
    userSummary,
    source: source === 'Portfolio Defi' ? source : undefined,
    ...(popup === 'supply' && onBeforeSwapNavigate
      ? { onBeforeSwapNavigate }
      : {}),
    onClose: () => {
      removeGlobalBottomSheetModal2024(modalId);
    },
    bottomSheetModalProps: {
      enableContentPanningGesture: true,
      enablePanDownToClose: true,
      enableDismissOnClose: true,
      ...(popup === 'repay' ? { rootViewType: 'View' as const } : {}),
      handleStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
      onDismiss: () => {
        handleLendingActionPopupDismiss(modalId);
      },
    },
  });

  popupRuntime.activeModalId = modalId;
  popupRuntime.activeDescriptor = descriptor;
  popupRuntime.shouldRestoreOnFocus = false;
  popupRuntime.isHidingForBlur = false;

  return modalId;
};

export const hideActiveLendingActionPopupForBlur = () => {
  if (!popupRuntime.activeModalId) {
    return;
  }

  popupRuntime.isHidingForBlur = true;
  removeGlobalBottomSheetModal2024(popupRuntime.activeModalId);
};

export const peekLendingActionPopupToRestore = () => {
  if (!popupRuntime.shouldRestoreOnFocus || !popupRuntime.activeDescriptor) {
    return null;
  }

  return popupRuntime.activeDescriptor;
};

export const consumeLendingActionPopupToRestore = () => {
  popupRuntime.shouldRestoreOnFocus = false;
};

export const clearLendingActionPopupState = () => {
  popupRuntime.activeModalId = null;
  popupRuntime.activeDescriptor = null;
  popupRuntime.shouldRestoreOnFocus = false;
  popupRuntime.isHidingForBlur = false;
};
