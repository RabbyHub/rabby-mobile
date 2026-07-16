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
  const isSubmittingRef = React.useRef(false);
  const setSubmitting = React.useCallback((value: boolean) => {
    isSubmittingRef.current = value;
    setIsSubmitting(value);
  }, []);
  const { onClickConnect } = useLedgerStatus(account.address, {
    onDismiss: () => {
      setSubmitting(false);
    },
    autoConnect: false,
  });

  const handleSubmit = useMemoizedFn(async () => {
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
          () => {
            setSubmitting(false);
            props.onCancel?.();
          },
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
  });

  return (
    <MiniProcessActions
      {...props}
      onSubmit={handleSubmit}
      submitText={t('page.signFooterBar.ledgerConfirm')}
      disabledProcess={disabledProcess}
      buttonIcon={<LedgerSVG width={22} height={22} viewBox="0 0 28 28" />}
      loading={isSubmitting}
    />
  );
};
