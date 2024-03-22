import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';

export const KeystoneProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;
  const { t } = useTranslation();

  return (
    <ProcessActions
      {...props}
      submitText={t('page.signFooterBar.qrcode.signWith', {
        brand: account.brandName,
      })}
      disabledProcess={disabledProcess}
    />
  );
};
