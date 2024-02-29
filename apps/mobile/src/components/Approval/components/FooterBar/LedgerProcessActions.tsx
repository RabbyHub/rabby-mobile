import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';

export const LedgerProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;
  const { status } = useLedgerStatus(account.address);
  const { t } = useTranslation();

  return (
    <ProcessActions
      {...props}
      submitText={t('page.signFooterBar.ledgerSign')}
      disabledProcess={status !== 'CONNECTED' || disabledProcess}
    />
  );
};
