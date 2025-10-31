import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from '../FooterBar/ActionsContainer';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { MiniProcessActions } from './MiniProcessActions';
import { useMemoizedFn } from 'ahooks';
import { apiLedger } from '@/core/apis';

export const MiniLedgerProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;

  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { onClickConnect } = useLedgerStatus(account.address, {
    onDismiss: () => {
      setIsSubmitting(false);
    },
    autoConnect: false,
  });

  const isConnectedPromise = React.useMemo(
    () => apiLedger.isConnected(account.address),
    [account.address],
  );

  const handleSubmit = useMemoizedFn(() => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    isConnectedPromise
      .then(([isConnected]) => {
        if (!isConnected) {
          onClickConnect(
            () => {
              setIsSubmitting(false);
              props.onSubmit();
            },
            () => {
              setIsSubmitting(false);
              props.onCancel?.();
            },
          );
          return;
        } else {
          props.onSubmit();
          setIsSubmitting(false);
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  });

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
