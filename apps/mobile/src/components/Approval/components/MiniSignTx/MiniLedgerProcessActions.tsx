import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from '../FooterBar/ActionsContainer';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { MiniProcessActions } from './MiniProcessActions';

export const MiniLedgerProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;

  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { status, onClickConnect } = useLedgerStatus(account.address, {
    onDismiss: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = React.useCallback(() => {
    if (status !== 'CONNECTED') {
      if (isSubmitting) {
        return;
      }
      setIsSubmitting(true);

      onClickConnect(() => {
        props.onSubmit();
        setIsSubmitting(false);
      });
      return;
    }
    props.onSubmit();
    setIsSubmitting(false);
  }, [status, props, isSubmitting, onClickConnect]);

  return (
    <MiniProcessActions
      {...props}
      onSubmit={handleSubmit}
      submitText={t('page.signFooterBar.ledgerConfirm')}
      disabledProcess={disabledProcess}
      buttonIcon={<LedgerSVG width={22} height={22} viewBox="0 0 28 28" />}
    />
  );
};
