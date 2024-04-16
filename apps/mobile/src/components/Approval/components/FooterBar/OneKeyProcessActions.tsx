import { useOneKeyStatus } from '@/hooks/onekey/useOneKeyStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';

export const OneKeyProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;
  const { status, onClickConnect } = useOneKeyStatus(account.address);
  const { t } = useTranslation();

  const handleSubmit = React.useCallback(() => {
    if (status !== 'CONNECTED') {
      onClickConnect(() => {
        props.onSubmit();
      });
      return;
    }
    props.onSubmit();
  }, [status, onClickConnect, props]);

  return (
    <ProcessActions
      {...props}
      onSubmit={handleSubmit}
      submitText={t('page.signFooterBar.oneKeySign')}
      disabledProcess={disabledProcess}
    />
  );
};
