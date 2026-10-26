import React, { useCallback, useState } from 'react';
import { PerpsProPositionTpSlSheet } from './PerpsProPositionTpSlSheet';
import { PerpsProPositionTpSlConfirmationSheet } from './PerpsProPositionTpSlConfirmationSheet';

type MainProps = React.ComponentProps<typeof PerpsProPositionTpSlSheet>;
type ConfirmationProps = React.ComponentProps<
  typeof PerpsProPositionTpSlConfirmationSheet
>;

/** Presentation coordination only; submission settlement remains controller-owned. */
export const PerpsProPositionTpSlSheets = ({
  review,
  onCloseReview,
  onConfirm,
  onToggleSkipConfirmation,
  skipConfirmation,
  ...main
}: Omit<MainProps, 'coveredByReview'> &
  Pick<
    ConfirmationProps,
    'review' | 'onConfirm' | 'onToggleSkipConfirmation' | 'skipConfirmation'
  > & { onCloseReview: () => void }) => {
  const [reviewPresented, setReviewPresented] = useState(false);
  const onPresented = useCallback(() => setReviewPresented(true), []);
  const onDismissed = useCallback(() => setReviewPresented(false), []);
  return (
    <>
      <PerpsProPositionTpSlSheet
        {...main}
        coveredByReview={!!review || reviewPresented}
      />
      <PerpsProPositionTpSlConfirmationSheet
        amountUnit={main.amountUnit}
        market={main.market}
        position={main.position}
        pending={main.pending}
        review={review}
        onClose={onCloseReview}
        onConfirm={onConfirm}
        onToggleSkipConfirmation={onToggleSkipConfirmation}
        skipConfirmation={skipConfirmation}
        onPresented={onPresented}
        onDismissed={onDismissed}
      />
    </>
  );
};
