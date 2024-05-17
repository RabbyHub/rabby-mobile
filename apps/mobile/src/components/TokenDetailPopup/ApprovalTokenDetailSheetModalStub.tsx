import React from 'react';
import { BottomSheetModalTokenDetail } from './BottomSheetModalTokenDetail';
import { useTokenDetailSheetModalOnApprovals } from './hooks';

export default function ApprovalTokenDetailSheetModalStub() {
  const { focusingToken, onFocusToken, sheetModalRef } =
    useTokenDetailSheetModalOnApprovals();

  return (
    <>
      <BottomSheetModalTokenDetail
        canClickToken={false}
        hideOperationButtons
        ref={sheetModalRef}
        token={focusingToken}
        onDismiss={() => {
          onFocusToken(null);
        }}
      />
    </>
  );
}
