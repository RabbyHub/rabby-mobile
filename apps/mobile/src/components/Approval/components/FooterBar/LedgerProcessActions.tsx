import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { apiLedger } from '@/core/apis';

export const LedgerProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;
  const { t } = useTranslation();
  const isSubmittingRef = React.useRef(false);
  const setSubmitting = React.useCallback((value: boolean) => {
    isSubmittingRef.current = value;
  }, []);
  const { onClickConnect } = useLedgerStatus(account.address, {
    onDismiss: () => {
      setSubmitting(false);
    },
    autoConnect: false,
  });

  const handleSubmit = React.useCallback(async () => {
    if (isSubmittingRef.current) {
      return;
    }
    setSubmitting(true);

    let waitingForConnectModal = false;

    try {
      const [isConnected] = await apiLedger.isConnected(account.address);
      if (!isConnected) {
        onClickConnect(
          async () => {
            try {
              await props.onSubmit();
            } finally {
              setSubmitting(false);
            }
          },
          () => setSubmitting(false),
        );
        waitingForConnectModal = true;
        return;
      }

      await props.onSubmit();
    } finally {
      if (!waitingForConnectModal) {
        setSubmitting(false);
      }
    }
  }, [account.address, props, onClickConnect, setSubmitting]);

  return (
    <ProcessActions
      {...props}
      onSubmit={handleSubmit}
      submitText={t('page.signFooterBar.ledgerSign')}
      disabledProcess={disabledProcess}
      buttonIcon={<LedgerSVG width={22} height={22} viewBox="0 0 28 28" />}
    />
  );
};
