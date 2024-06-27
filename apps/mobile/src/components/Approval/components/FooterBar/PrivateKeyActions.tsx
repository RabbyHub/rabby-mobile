import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';

export const PrivateKeyActions: React.FC<Props> = props => {
  const { disabledProcess } = props;
  const { t } = useTranslation();

  const handleSubmit = React.useCallback(() => {
    props.onSubmit();
  }, [props]);

  return (
    <ProcessActions
      {...props}
      needHolding
      isPrimary
      onSubmit={handleSubmit}
      submitText={t('page.signFooterBar.privateKeySign')}
      disabledProcess={disabledProcess}
    />
  );
};
