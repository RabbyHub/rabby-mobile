import { useLedgerStatus } from '@/hooks/ledger/useLedgerStatus';
import React from 'react';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';

export const LedgerProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;
  const { status } = useLedgerStatus(account.address);

  return (
    <ProcessActions
      {...props}
      disabledProcess={status !== 'CONNECTED' || disabledProcess}
    />
  );
};
