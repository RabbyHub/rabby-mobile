import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';

export const OneKeyProcessActions: React.FC<Props> = props => {
  const { disabledProcess } = props;
  const { t } = useTranslation();

  return (
    <ProcessActions
      {...props}
      submitText={t('page.signFooterBar.oneKeySign')}
      disabledProcess={disabledProcess}
    />
  );
};
