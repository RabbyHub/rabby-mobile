import React from 'react';
import { BottomSheetModalTokenDetail } from './BottomSheetModalTokenDetail';
import { useTokenDetailSheetModalOnApprovals } from './hooks';

export default function ApprovalTokenDetailSheetModalStub() {
  const { focusingToken, onFocusToken, sheetModalRef, selectedAccount } =
    useTokenDetailSheetModalOnApprovals();

  return (
    <>
      <BottomSheetModalTokenDetail
        __shouldSwitchSceneAccountBeforeRedirect__={false}
        nextTxRedirectAccount={null}
        canClickToken={false}
        hideOperationButtons
        ref={sheetModalRef}
        token={focusingToken}
        onDismiss={() => {
          onFocusToken(null);
        }}
        address={selectedAccount}
      />
    </>
  );
}
